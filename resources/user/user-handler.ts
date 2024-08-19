import { Context } from "hono";
import { createUserService, getUserService } from "./user-service.ts";
import { UserSchema } from "./user-model.ts";

async function createUserHandler(c: Context) {
    const user = await c.req.json<UserSchema>();
    console.group("createUserHandler");
    console.log(user);
    console.groupEnd();

    if (!user) {
        return c.text("Invalid user data");
    }
    const result = await createUserService(user);
    return c.json(result);
}

async function getUserByIdHandler(c: Context) {
    try {
        console.log("inside getUserHandler");
        const userId = c.req.query("userId") ?? "";

        const user = await getUserService(userId);

        console.group("getUserHandler");
        console.log(user);
        console.groupEnd();

        if (user.value === null) {
            return c.text("User not found");
        }
        return c.json(user);
    } catch (error) {
        console.error(error);
    }
}

async function deleteUserHandler(c: Context) {
    return c.text("Delete User");
}

async function updateUserHandler(c: Context) {
    return c.text("Update User");
}

export {
    createUserHandler,
    deleteUserHandler,
    getUserByIdHandler,
    updateUserHandler,
};
