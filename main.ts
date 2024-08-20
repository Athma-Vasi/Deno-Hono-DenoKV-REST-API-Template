import { Context, Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { bearerAuth } from "hono/bearer-auth";
import { jwt } from "hono/jwt";

import { authRouter } from "./resources/auth/auth-routes.ts";
import { userRouter } from "./resources/user/user-routes.ts";

const app = new Hono().basePath("/api/v1");
app.use("*", logger(), cors(), compress());

// app.use("*", bearerAuth(token));

app.route("/auth", authRouter);
app.route("/user", userRouter);

Deno.serve(app.fetch);
