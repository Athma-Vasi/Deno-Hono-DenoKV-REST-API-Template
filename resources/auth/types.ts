type AuthSessionRecord = {
    created_at: string;
    id: string;
    refresh_tokens_deny_list: string[];
    updated_at: string;
    user_id: string;
};

type AuthSessionSchema = Omit<AuthSessionRecord, "id">;

export type { AuthSessionRecord };
