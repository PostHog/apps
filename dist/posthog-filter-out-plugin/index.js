const operations = {
    string: {
        is: (a, b) => a === b,
        is_not: (a, b) => a !== b,
        contains: (a, b) => a.includes(b),
        not_contains: (a, b) => !a.includes(b),
        regex: (a, b) => new RegExp(b).test(a),
        not_regex: (a, b) => !new RegExp(b).test(a),
    },
    number: {
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        gte: (a, b) => a >= b,
        lte: (a, b) => a <= b,
        eq: (a, b) => a === b,
        neq: (a, b) => a !== b,
    },
    boolean: {
        is: (a, b) => a === b,
        is_not: (a, b) => a !== b,
    },
};
function setupPlugin({ global, attachments }) {
    if (!attachments.filters)
        throw new Error("No filters attachment found");
    try {
        const filters = JSON.parse(attachments.filters.contents);
        if (!filters)
            throw new Error("No filters found");
        for (const filter of filters) {
            if (!operations[filter.type][filter.operator]) {
                throw new Error(`Invalid operator "${filter.operator}" for type "${filter.type}" in filter for "${filter.property}"`);
            }
        }
        global.filters = filters;
    }
    catch {
        throw new Error("Could not parse filters attachment");
    }
}
function processEvent(event, meta) {
    if (!event.properties)
        return event;
    const { filters } = meta.global;
    const keepEvent = filters.every((filter) => {
        const value = event.properties[filter.property];
        if (value === undefined)
            return false;
        const operation = operations[filter.type][filter.operator];
        if (!operation)
            throw new Error(`Invalid operator ${filter.operator}`);
        return operation(value, filter.value);
    });
    return keepEvent ? event : undefined;
}

export { processEvent, setupPlugin };
