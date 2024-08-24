import { assertEquals } from "jsr:@std/assert@1.0.2";
import { HttpResult } from "../../types.ts";
import { AuthSessionRecord } from "./types.ts";
import { UserRecord, UserSchema } from "../user/types.ts";

const stagingUrl = Deno.env.get("STAGING_URL") ??
    "http://localhost:8000/api/v1";

Deno.test("GET /api/v1/auth/all", async () => {
    const response = await fetch(`${stagingUrl}/auth/all`);
    const data = await response.json() as HttpResult<AuthSessionRecord[]>;

    assertEquals(data.kind, "success");
    assertEquals(response.status, 200);
});

Deno.test("POST /api/v1/auth/register", async () => {
    const userSchema: UserSchema = {
        name: "John Doe",
        email: "email@email.com",
        password: "password",
        address_line: "123 Main St",
        city: "Toronto",
        province: "ON",
        postal_code: "M1M1M1",
        country: "Canada",
    };

    const requestInit: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(userSchema),
    };

    const response = await fetch(
        `${stagingUrl}/auth/register`,
        requestInit,
    );

    const result = await response.json() as HttpResult<UserRecord>;
    const { kind, status, triggerLogout } = result;

    // already present in db
    assertEquals(status, 400);
    assertEquals(kind, "error");
    assertEquals(triggerLogout, false);
});

Deno.test("POST /api/v1/auth/login", async () => {
    const email = "email@email.com";
    const password = "password";

    const requestInit: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    };

    const response = await fetch(
        `${stagingUrl}/auth/login`,
        requestInit,
    );

    const result = await response.json() as HttpResult<boolean>;
    const { kind, status, triggerLogout } = result;

    assertEquals(status, 200);
    assertEquals(kind, "success");
    assertEquals(triggerLogout, false);
});

Deno.test("POST /api/v1/auth/logout", async () => {
    const requestInit: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    };

    const response = await fetch(
        `${stagingUrl}/auth/logout`,
        requestInit,
    );

    const result = await response.json() as HttpResult<boolean>;
    const { kind, status, triggerLogout } = result;

    assertEquals(status, 200);
    assertEquals(kind, "success");
    assertEquals(triggerLogout, true);
});
