import { Hono } from "hono";
import { Bindings, Variables } from "./config";
import { authenticateClient, authenticateWebhook } from "./index.middleware";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

app.get("/", (c) => {
  return c.text("File Uploading Microservice.");
});

app.get("/generate-signed-url/:messageId", authenticateClient, (c) => {
  try {
    // TODO: A small validation of both Id.
    const userId = c.get("userId");
    const messageId = c.req.param("messageId");
    // Timestamp will only valid for 1 minute.
    const timestamp = Math.round(new Date().getTime() / 1000) - 59 * 60;
    // Custom parameters
    const context = `message_id=${messageId}`;
    // Generating the signature.
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: `user_uploads/${userId}`,
        context: context,
      },
      c.env.CLOUDINARY_API_SECRET
    );
    // return
    return c.json(
      {
        url: `https://api.cloudinary.com/v1_1/${c.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        signature,
        timestamp,
        api_key: c.env.CLOUDINARY_API_KEY,
        folder: `user_uploads/${userId}`,
        context,
      },
      200
    );
  } catch (error: any) {
    console.log("Error in generating signed url: ", error.message);
    return c.json({ message: "Internal server error." }, 500);
  }
});

// TODO: Publish this event to redis
app.post("/wh/image/:whsecret", authenticateWebhook, async (c) => {
  // Fetching the necessary data
  const {
    secure_url,
    asset_folder,
    context: {
      custom: { message_id },
    },
  } = await c.req.json();
  // Input validation
  if (
    !secure_url ||
    asset_folder === "" ||
    !asset_folder.includes("/") ||
    !message_id
  ) {
    return c.json({ message: "Invalid data" }, 400);
  }
  // Fetching the userId
  const userId = asset_folder.split("/")[1];
  // Store in database
  try {
    const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());

    await prisma.imageEntry.create({
      data: {
        userId,
        messageId: message_id,
        url: secure_url,
      },
    });
    // return
    return c.json({ message: "Message updated succesfully." }, 200);
  } catch (error: any) {
    console.log("Error in image webhook: ", error.message);
    return c.json({ message: "Internal server error." }, 500);
  }
});

export default app;
