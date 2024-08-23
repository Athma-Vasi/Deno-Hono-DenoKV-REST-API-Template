import { Hono } from "hono";
import {
    getAllAuthSessionsHandler,
    loginUserHandler,
    logoutUserHandler,
    refreshTokensHandler,
    registerUserHandler,
} from "./handlers.ts";

const authRouter = new Hono();

authRouter.get("/all", getAllAuthSessionsHandler);

authRouter.get("/login", loginUserHandler);

authRouter.post("/register", registerUserHandler);

authRouter.get("/refresh", refreshTokensHandler);

authRouter.get("/logout", logoutUserHandler);

export { authRouter };
