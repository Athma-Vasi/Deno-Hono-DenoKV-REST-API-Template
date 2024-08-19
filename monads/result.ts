type Ok<T> = { _type: "Ok"; value: T };
type Error<E> = { _type: "Error"; error: E };
type Result<T, E> = Ok<T> | Error<E>;

function ok<T>(value: T): Ok<T> {
    return { _type: "Ok", value };
}

function error<E>(error: E): Error<E> {
    return { _type: "Error", error };
}
