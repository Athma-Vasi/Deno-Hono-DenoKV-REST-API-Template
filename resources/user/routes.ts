import { Hono } from "hono";

import { HttpResult } from "../../types.ts";
import { createHttpErrorResult } from "../../utils.ts";
import {
    deleteUserService,
    getAllUsersService,
    getUserByEmailService,
    getUserByIdService,
    updateUserService,
} from "./services.ts";
import { UpdateUserReqBody } from "./types.ts";

const userRouter = new Hono();

// @desc   Get all users
// @route  GET /api/v1/users/all
// @access Private
userRouter.get("/all", async (context) => {
    const usersResult = await getAllUsersService();
    if (usersResult.err) {
        return context.json<HttpResult>(usersResult.val);
    }

    return context.json<HttpResult>(usersResult.safeUnwrap());
});

// @desc   Get user by email
// @route  GET /api/v1/users/email
// @access Private
userRouter.get("/email", async (context) => {
    try {
        const email = context.req.query("email");
        if (email === null || email === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("Invalid email", 400),
            );
        }

        const usersResult = await getUserByEmailService(email);
        if (usersResult.err) {
            return context.json<HttpResult>(usersResult.val);
        }

        return context.json<HttpResult>(usersResult.safeUnwrap());
    } catch (error) {
        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error getting user by email: ${
                    error?.name ?? "Unknown error"
                }`,
                500,
            ),
        );
    }
});

// @desc   Update user
// @route  POST /api/v1/users/:id
// @access Private
userRouter.post("/:id", async (context) => {
    try {
        const updateUserReqBody = await context.req.json<
            UpdateUserReqBody
        >();
        if (updateUserReqBody === null || updateUserReqBody === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult(
                    "Error updating user: Invalid user data",
                    400,
                ),
            );
        }

        const { fieldToUpdate, valueToUpdate } = updateUserReqBody;
        const userId = context.req.param("id");

        const updateResult = await updateUserService({
            fieldToUpdate,
            userId,
            valueToUpdate,
        });
        if (updateResult.err) {
            return context.json<HttpResult>(updateResult.val);
        }

        return context.json<HttpResult>(updateResult.safeUnwrap());
    } catch (error) {
        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error updating user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
});

// @desc   Delete user by ID
// @route  DELETE /api/v1/users/:id
// @access Private
userRouter.delete("/:id", async (context) => {
    try {
        const id = context.req.param("id");

        if (id === null || id === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("Invalid user ID", 400),
            );
        }

        const deleteResult = await deleteUserService(id);
        if (deleteResult.err) {
            return context.json<HttpResult>(deleteResult.val);
        }

        return context.json<HttpResult>(deleteResult.safeUnwrap());
    } catch (error) {
        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error deleting user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
});

// @desc   Get user by ID
// @route  GET /api/v1/users/:id
// @access Private
userRouter.get("/:id", async (context) => {
    try {
        const id = context.req.param("id");

        console.log(`\n`);
        console.group("userRouter.get('/:id')");
        console.log("context:", context);
        console.log(`id: ${id}`);
        console.groupEnd();

        if (id === null || id === undefined) {
            return context.json<HttpResult>(
                createHttpErrorResult("Invalid user ID", 400),
            );
        }

        const usersResult = await getUserByIdService(id);
        if (usersResult.err) {
            return context.json<HttpResult>(usersResult.val);
        }

        return context.json<HttpResult>(usersResult.safeUnwrap());
    } catch (error) {
        return context.json<HttpResult>(
            createHttpErrorResult(
                `Error getting user: ${error?.name ?? "Unknown error"}`,
                500,
            ),
        );
    }
});

export { userRouter };
