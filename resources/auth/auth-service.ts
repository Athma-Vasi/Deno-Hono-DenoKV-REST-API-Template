import { Err } from "../../ts-results/result.ts";

async function loginService(username: string, password: string) {
    const denoDB = await Deno.openKv("user-db");
    if (denoDB === null || denoDB === undefined) {
        return new Err("Error opening database");
    }
}
