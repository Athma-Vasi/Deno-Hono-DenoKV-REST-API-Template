import { Err, ErrImpl, Ok, OkImpl, Result } from "../../ts-results/result.ts";
import { HttpResult, ServicesOutput } from "../../types.ts";
import { UserSchema } from "./user-model.ts";

async function createUserService(
    user: UserSchema,
): ServicesOutput<UserSchema> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err<HttpResult>({
                data: [],
                kind: "error",
                message: "Error opening database",
                status: 500,
            });
        }

        const result = await denoDB.set(["users", user.id], user);
        denoDB.close();

        return result.ok
            ? new Ok<HttpResult<UserSchema>>({
                data: [user],
                kind: "success",
                message: "User created",
                status: 201,
            })
            : new Err<HttpResult>({
                data: [],
                kind: "error",
                message: "Error creating user",
                status: 500,
            });
    } catch (error) {
        return new Err<HttpResult>({
            data: [],
            kind: "error",
            message: `Error creating user: ${error ?? "Unknown error"}`,
            status: 500,
        });
    }
}

async function getUserService(
    id: string,
): Promise<ErrImpl<string> | OkImpl<UserSchema>> {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err("Error opening database");
        }

        const result = await denoDB.get(["users", id]);
        denoDB.close();

        return result.value !== null
            ? new Ok(result.value as UserSchema)
            : new Err("User not found");
    } catch (error) {
        return new Err(
            `Error getting user: ${error ?? "Unknown error"}`,
        );
    }
}

async function getUsersService() {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err("Error opening database");
        }

        const iter = denoDB.list({ prefix: ["users"] });
        const result = [];
        for await (const { key, value } of iter) {
            result.push({ key: key[1], value: value });
        }
        return result;
    } catch (error) {
        return new Err(
            `Error getting users: ${error ?? "Unknown error"}`,
        );
    }
}

async function updateUserService(user: UserSchema) {
    const denoDB = await Deno.openKv("user_db");
    return await denoDB.set(["users", user.id], user);
}

async function deleteUserService(id: string) {
    try {
        const denoDB = await Deno.openKv("user_db");
        if (denoDB === null || denoDB === undefined) {
            return new Err("Error opening database");
        }

        await denoDB.delete(["users", id]);
        denoDB.close();

        return new Ok("User deleted");
    } catch (error) {
        return new Err(
            `Error deleting user: ${error ?? "Unknown error"}`,
        );
    }
}

export {
    createUserService,
    deleteUserService,
    getUserService,
    getUsersService,
    updateUserService,
};

// app.get("/", (c: Context) => {
//     console.group("/");
//     console.log(c);
//     console.groupEnd();
//     return c.text("Hello Hono!");
// });

// app.get("/kv", async (c: Context) => {
//     const iter = kv.list({ prefix: ["books"] });
//     const result = [];
//     for await (const { key, value } of iter) {
//         result.push({ key: key[1], value: value });
//     }
//     return c.json(result);
// });

// app.post("/kv", async (c: Context) => {
//     const body = await c.req.json();
//     const result = await kv.set(["books", body.key], body.value);
//     return c.json(result);
// });

// app.delete("/kv", async (c: Context) => {
//     const body = await c.req.json();
//     await kv.delete(["books", body.key]);
//     return c.json({ message: "deleted" });
// });
