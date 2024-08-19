import { Context, Hono } from "hono";
import {
    createUserHandler,
    deleteUserHandler,
    getUserByIdHandler,
    updateUserHandler,
} from "./user-handler.ts";

const userRouter = new Hono();

userRouter.get("/", getUserByIdHandler);

userRouter.get("/:userId", async (c: Context) => {
    const user = await getUserByIdHandler(c);
    return c.json(user);
});

// userRouter.get("/:id", getUserByIdHandler).delete(
//     "/:id",
//     deleteUserHandler,
// );
// userRouter.post("/", createUserHandler);
// userRouter.put("/", updateUserHandler);

userRouter.get("*", (c: Context) => {
    return c.text("🫠 Not Found route reached");
});

export { userRouter };
