import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { compress } from "hono/compress";

import { authRouter } from "./resources/auth/routes.ts";
import { userRouter } from "./resources/user/routes.ts";
import { verifyJWTs } from "./middlewares/verifyJWTs.ts";

const app = new Hono().basePath("/api/v1");
app.use("*", logger(), cors(), compress());

app.route("/auth", authRouter);

// app.use("/user/*", verifyJWTs);
app.route("/user", userRouter);

Deno.serve(app.fetch);
