import { Hono } from "hono";
import {
    loginHandler,
    logoutHandler,
    refreshHandler,
    registerHandler,
} from "./auth-handler.ts";

const authRouter = new Hono();

authRouter.get("/login", loginHandler);

authRouter.get("/register", registerHandler);

authRouter.get("/refresh", refreshHandler);

authRouter.get("/logout", logoutHandler);

export { authRouter };
