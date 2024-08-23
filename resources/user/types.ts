type UserSchema = {
    name: string;
    email: string;
    password: string;
    address_line: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
};

type UserRecord = UserSchema & {
    id: string;
    created_at: string;
    updated_at: string;
};

type UpdateUserReqBody = {
    fieldToUpdate: string;
    valueToUpdate: string;
};

export type { UpdateUserReqBody, UserRecord, UserSchema };
