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

export type { AuthSessionRecord, AuthSessionSchema, TokensObject };
