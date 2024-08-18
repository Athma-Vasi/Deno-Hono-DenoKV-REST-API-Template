import { Context, Hono } from "hono";

const app = new Hono();
Deno.serve(app.fetch);
const kv = await Deno.openKv();

app.get("/", (c: Context) => {
  return c.text("Hello Hono!");
});

app.get("/kv", async (c: Context) => {
  const iter = kv.list({ prefix: ["books"] });
  const result = [];
  for await (const { key, value } of iter) {
    result.push({ key: key[1], value: value });
  }
});

app.post("/kv", async (c: Context) => {
  const body = await c.req.json();
  const result = await kv.set(["books", body.key], body.value);
  return c.json(result);
});
