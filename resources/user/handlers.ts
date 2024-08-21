import { Context } from "hono";
import { createUserService, getUserService } from "./services.ts";
import { UserSchema } from "./types.ts";

async function createUserHandler(c: Context) {
    const user = await c.req.json<UserSchema>();
    console.group("createUserHandler");
    console.log(user);
    console.groupEnd();

    if (!user) {
        console.error("User not found");
    }
    const result = await createUserService(user);

    if (result.ok) {
        return c.json(result);
    } else {
        console.error(result.toString());
    }
}

async function getUserByIdHandler(c: Context) {
    console.log("inside getUserHandler");
    const userId = c.req.query("userId") ?? "";

    const result = await getUserService(userId);

    console.group("getUserHandler");
    console.log(result);
    console.groupEnd();

    if (result.ok) {
        return c.json(result);
    } else {
        console.error(result.toString());
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
