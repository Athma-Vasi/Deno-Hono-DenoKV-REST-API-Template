import { Context } from "hono";

async function loginHandler(c: Context) {
    return c.text("Login");
}

async function registerHandler(c: Context) {
    return c.text("Register");
}

async function refreshHandler(c: Context) {
    return c.text("Refresh");
}

async function logoutHandler(c: Context) {
    return c.text("Logout");
}

export { loginHandler, logoutHandler, refreshHandler, registerHandler };
