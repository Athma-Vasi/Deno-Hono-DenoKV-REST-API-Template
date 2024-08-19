import { Hono } from "hono";

const authRouter = new Hono();

authRouter.get("/login", (c) => {
    return c.text("Login");
});

authRouter.get("/register", (c) => {
    return c.text("Register");
});

authRouter.get("/refresh", (c) => {
    return c.text("Refresh");
});

authRouter.get("/logout", (c) => {
    return c.text("Logout");
});

export { authRouter };
