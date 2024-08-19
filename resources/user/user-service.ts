import { UserSchema } from "./user-model.ts";

async function createUserService(user: UserSchema) {
    const kv = await Deno.openKv("user-db");
    const result = await kv.set(["users", user.id], user);
    kv.close();
    return result;
}

async function getUserService(id: string) {
    const kv = await Deno.openKv("user-db");
    const result = await kv.get(["users", id]);
    kv.close();
    return result;
}

async function getUsersService() {
    const kv = await Deno.openKv("user-db");
    const iter = kv.list({ prefix: ["users"] });
    const result = [];
    for await (const { key, value } of iter) {
        result.push({ key: key[1], value: value });
    }
    return result;
}

async function updateUserService(user: UserSchema) {
    const kv = await Deno.openKv("user-db");
    return await kv.set(["users", user.id], user);
}

async function deleteUserService(id: string) {
    const kv = await Deno.openKv("user-db");
    return await kv.delete(["users", id]);
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
