const ACCEPTED_TYPES = new Set(['number', 'string', 'boolean']);
const isBool = (valueToCheck) => typeof valueToCheck === 'boolean';
const areValuesValid = (jsonSchema) => {
    try {
        for (const eventSchema of Object.values(jsonSchema.eventSchemas)) {
            if (eventSchema.acceptOnlySchemaProps && !isBool(eventSchema.acceptOnlySchemaProps)) {
                return false;
            }
            for (const prop of Object.values(eventSchema.schema)) {
                if ((prop.required && !isBool(prop.required)) || !ACCEPTED_TYPES.has(prop.type)) {
                    return false;
                }
            }
        }
        if (jsonSchema.onlyIngestEventsFromFile) {
            return isBool(jsonSchema.onlyIngestEventsFromFile);
        }
        return true;
    }
    catch {
        return false;
    }
};
const isValidSchemaFile = (jsonSchema) => {
    const checks = [
        {
            validate: (jsonSchema) => !!jsonSchema['eventSchemas'],
            errorMessage: 'Your file has no specified schemas. Please specify at least one.',
        },
        {
            validate: areValuesValid,
            errorMessage: 'Your file has invalid option values.',
        },
    ];
    for (const check of checks) {
        if (!check.validate(jsonSchema)) {
            throw new Error(check.errorMessage);
        }
    }
};

function setupPlugin({ attachments, global }) {
    try {
        global.schemaFile = JSON.parse(attachments.eventSchemaFile.contents.toString());
    }
    catch {
        throw new Error('Invalid JSON! Make sure your file has valid JSON.');
    }
    isValidSchemaFile(global.schemaFile);
}
function processEvent(event, { global }) {
    const schema = global.schemaFile;
    const eventSchema = schema.eventSchemas[event.event];
    if (!eventSchema) {
        if (schema.onlyIngestEventsFromFile) {
            return;
        }
        return event;
    }
    const schemaPropsOnly = eventSchema.acceptOnlySchemaProps;
    let validProps = {};
    for (const [propName, propSchema] of Object.entries(eventSchema.schema)) {
        const eventPropertyVal = event.properties[propName];
        if ((!eventPropertyVal && propSchema.required) ||
            typeof eventPropertyVal !== propSchema.type.toLowerCase()) {
            return;
        }
        validProps[propName] = eventPropertyVal;
    }
    if (schemaPropsOnly) {
        event.properties = validProps;
    }
    return event;
}

export { processEvent, setupPlugin };
