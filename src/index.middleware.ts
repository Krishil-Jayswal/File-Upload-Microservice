import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { verify } from "hono/utils/jwt/jwt";

export const authenticateClient = createMiddleware(async (c, next) => {
  try {
    // Fetch token
    const token = getCookie(c, "jwt");
    // Checking presence of token
    if (!token) {
      return c.json({ message: "Unauthorized - No token provided." });
    }
    // Verify the token
    const payload = await verify(token, c.env.JWT_SECRET);
    // Setting the userId
    c.set("userId", payload.id);
    // next
    await next();
  } catch (error: any) {
    if (error.message.includes("Jwt")) {
      return c.json({ message: "Unauthorized - Invalid token." }, 400);
    }
    console.log("Error in auth middleware: " + error.message);
    return c.json({ message: "Internal server error." }, 500);
  }
});
