function processEvent(event, { config }) {
    if (event.properties && event.properties[config.property_key]) {
        if (!config.property_values || config.property_values == '') {
            return null;
        }
        const values = config.property_values.split(',');
        if (values.indexOf(event.properties[config.property_key]) > -1) {
            return null;
        }
    }
    return event;
}

export { processEvent };
