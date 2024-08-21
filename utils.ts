function updateFieldInObject({ fieldToUpdate, object, valueToUpdate }: {
    fieldToUpdate: string;
    object: Record<string, string>;
    valueToUpdate: string;
}) {
    return Object.entries(object).reduce((acc, [key, val]) => {
        if (key === fieldToUpdate) {
            acc[key] = valueToUpdate;
        } else {
            acc[key] = val;
        }

        return acc;
    }, Object.create(null));
}

export { updateFieldInObject };
