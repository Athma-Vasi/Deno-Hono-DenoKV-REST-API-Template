import { assertEquals } from "jsr:@std/assert@1.0.2";
import { HttpResult } from "../../types.ts";
import { UserRecord } from "../user/types.ts";

const stagingUrl = Deno.env.get("STAGING_URL") ??
    "http://localhost:8000/api/v1";

Deno.test("GET /api/v1/user/all", async () => {
    const response = await fetch(`${stagingUrl}/user/all`);
    const data = await response.json() as HttpResult<UserRecord[]>;

    assertEquals(data.kind, "success");
    assertEquals(response.status, 200);
});

Deno.test("GET /api/v1/user/:id", async () => {
    const userId = "01J62YHFGBCC0HKTNJBH3AR370";
    const response = await fetch(`${stagingUrl}/user/${userId}`);
    const data = await response.json() as HttpResult<UserRecord>;

    assertEquals(data.kind, "success");
    assertEquals(response.status, 200);
});

Deno.test("GET /api/v1/user/email", async () => {
    const email = "email@email.com";
    const response = await fetch(`${stagingUrl}/user/email?email=${email}`);
    const data = await response.json() as HttpResult<UserRecord>;

    assertEquals(data.kind, "success");
    assertEquals(response.status, 200);
});

Deno.test("POST /api/v1/user/:id", async () => {
    const fieldToUpdate = "name";
    const valueToUpdate = "Jane Doe";
    const userId = "01J62YHFGBCC0HKTNJBH3AR370";

    const requestInit: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ fieldToUpdate, valueToUpdate }),
    };

    const response = await fetch(
        `${stagingUrl}/user/${userId}`,
        requestInit,
    );

    const data = await response.json() as HttpResult<UserRecord>;

    assertEquals(data.kind, "success");
    assertEquals(response.status, 200);
});

// Deno.test("DELETE /api/v1/user/:id", async () => {
//     const userId = "01J62YHFGBCC0HKTNJBH3AR370";

//     const requestInit: RequestInit = {
//         method: "DELETE",
//         headers: {
//             "Content-Type": "application/json",
//         },
//     };

//     const response = await fetch(
//         `${stagingUrl}/user/${userId}`,
//         requestInit,
//     );

//     const data = await response.json() as HttpResult<UserRecord>;

//     assertEquals(data.kind, "success");
//     assertEquals(response.status, 200);
// });
