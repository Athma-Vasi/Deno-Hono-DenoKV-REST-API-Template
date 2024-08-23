import { Context, Hono } from "hono";
import {
    createUserHandler,
    deleteUserHandler,
    getAllUsersIdHandler,
    getUserByIdHandler,
    updateUserHandler,
} from "./handlers.ts";

const userRouter = new Hono();

userRouter.get("/", getUserByIdHandler);
userRouter.get("/all", getAllUsersIdHandler);
// userRouter.get("/email", getUserByEmailHandler);

userRouter.get("/:userId", async (c: Context) => {
    const user = await getUserByIdHandler(c);
    return c.json(user);
});

userRouter.get("*", (c: Context) => {
    return c.text("🫠 Not Found route reached");
});

export { userRouter };
