import { Result } from "./types.ts";

type None = { _type: "None" };
type Some<T> = { _type: "Some"; value: T };
type Option<T> = None | Some<T>;

const none: None = { _type: "None" };
function some<T>(value: T): Some<T> {
    return { _type: "Some", value };
}

function optionalCatch<T>(fn: () => T): Option<T> {
    try {
        return some(fn());
    } catch (_error) {
        return none;
    }
}

async function optionalResolve<T>(promise: Promise<T>): Promise<Option<T>> {
    try {
        return some(await promise);
    } catch (_error) {
        return none;
    }
}

function toOptional<Input, Output extends Input>(
    fn: (input: Input) => input is Output,
) {
    return function (arg: Input): Option<Output> {
        try {
            return fn(arg) ? some(arg) : none;
        } catch (_error) {
            return none;
        }
    };
}

const optionalDefined = toOptional(<T>(arg: T | undefined | null): arg is T =>
    arg !== undefined && arg !== null
);

function unwrap<T>(
    option: Option<T>,
): T {
    if (option._type === "Some") {
        return option.value;
    }
    throw new Error("Unwrapping None");
}

function unwrapOr<T>(
    option: Option<T>,
    defaultValue: T,
): T {
    return option._type === "Some" ? option.value : defaultValue;
}

function unwrapOrElse<T>(
    option: Option<T>,
    fn: () => T,
): T {
    return option._type === "Some" ? option.value : fn();
}

function unwrapExpect<T>(option: Option<T>, message: string): T {
    if (option._type === "Some") {
        return option.value;
    }
    throw new Error(message);
}

function unwrapWithResult<T, E>(
    option: Option<T>,
    error: E,
): Result<T, E> {
    return option._type === "Some"
        ? { _type: "Ok", value: option.value }
        : { _type: "Error", error };
}

export {
    none,
    optionalCatch,
    optionalDefined,
    optionalResolve,
    some,
    toOptional,
    unwrap,
    unwrapExpect,
    unwrapOr,
    unwrapOrElse,
    unwrapWithResult,
};
