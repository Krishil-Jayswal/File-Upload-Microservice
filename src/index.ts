import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text("File Uploading Microservice.");
});

export default app;
