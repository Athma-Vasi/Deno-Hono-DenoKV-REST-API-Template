import { HttpRequestJSONBody, HttpResult } from "../../types.ts";
import { UserRecord } from "../user/types.ts";

type AuthSessionSchema = {
    refresh_tokens_deny_list: string[];
    user_id: string;
};

type AuthSessionRecord = AuthSessionSchema & {
    id: string;
    created_at: string;
    updated_at: string;
};

type TokensObject = { accessToken: string; refreshToken: string };
type LoginServiceData = {
    user: UserRecord;
    tokens: TokensObject;
};

type ReqBodyAuthPOST = HttpRequestJSONBody & {
    password: string;
};

type ReqBodyLoginPOST = {
    email: string;
    password: string;
};

export type {
    AuthSessionRecord,
    AuthSessionSchema,
    LoginServiceData,
    ReqBodyAuthPOST,
    ReqBodyLoginPOST,
    TokensObject,
};
