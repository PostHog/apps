function cleanUserEvent(eventDetails) {
    const refinedEvent = {};
    const $setParameters = Object.assign({}, eventDetails.properties.$set, eventDetails.properties.$set_once);
    for (const param in $setParameters) {
        if (param.startsWith('$')) {
            continue;
        }
        refinedEvent[param] = $setParameters[param];
    }
    if (eventDetails.event === '$identify') {
        if (eventDetails.properties.$device_id && (eventDetails.properties.$device_type.toLowerCase() === 'android' || eventDetails.properties.$device_type.toLowerCase() === 'ios')) {
            refinedEvent.device_token = eventDetails.properties.$device_id;
            refinedEvent.device_platform = `${eventDetails.properties.$os || ''} ${eventDetails.properties.$device_type || ''}`;
        }
        return refinedEvent;
    }
    return refinedEvent;
}
function formatUserObject(data) {
    const o = {};
    delete data.uid;
    if (data.first_name) {
        o.first_name = data.first_name;
        delete data.first_name;
    }
    if (data.last_name) {
        o.last_name = data.last_name;
        delete data.last_name;
    }
    if (data.email) {
        o.email = data.email;
        delete data.email;
    }
    if (data.number) {
        o.number = data.number;
        delete data.number;
    }
    if (data.created_at) {
        o.date = new Date(data.created_at);
        delete data.created_at;
    }
    if (data.device_token && data.device_platform) {
        o.device_token = data.device_token;
        o.device_platform = data.device_platform;
        delete data.device_platform;
        delete data.device_token;
    }
    if (data.name) {
        const [first, last] = data.name.split(' ');
        if (first && !o.first_name) {
            o.first_name = first.trim();
        }
        if (last && !o.last_name) {
            o.last_name = last.trim();
        }
        delete data.name;
    }
    o.meta = Object.assign({}, ...(function _flatten(o) { return [].concat(...Object.keys(o).map(k => typeof o[k] === 'object' ? _flatten(o[k]) : ({ [k]: o[k] }))); }(data)));
    if (!Object.keys(o.meta).length) {
        delete o.meta;
    }
    return o;
}
function formatEventProperty(data) {
    const o = {};
    if ('value' in data) {
        o.value = data.value;
        delete data.value;
    }
    o.properties = Object.assign({}, ...(function _flatten(o) { return [].concat(...Object.keys(o).map(k => typeof o[k] === 'object' ? _flatten(o[k]) : ({ [k]: o[k] }))); }(data)));
    if (!Object.keys(o.properties).length) {
        delete o.properties;
    }
    return o;
}
async function onEvent(_event, { config }) {
    if (_event.event.startsWith('$')) {
        if (_event.event !== '$identify') {
            return;
        }
    }
    if (_event.event.startsWith('plugin')) {
        return;
    }
    const auth = 'Basic ' + Buffer.from(`${config.publicKey}:${config.secret}`).toString('base64');
    const uid = _event.distinct_id;
    if (_event.event === '$identify') {
        const cleanEventData = cleanUserEvent(_event);
        const requestBody = formatUserObject(JSON.parse(JSON.stringify(cleanEventData)));
        fetch(`https://api.engage.so/v1/users/${uid}`, {
            method: 'put',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                Authorization: auth
            }
        }).then(() => Promise.resolve())
            .catch(() => { });
        return;
    }
    const event = _event.event;
    const cleanEventData = cleanUserEvent(_event);
    const requestBody = formatEventProperty(JSON.parse(JSON.stringify(cleanEventData)));
    requestBody.event = event;
    fetch(`https://api.engage.so/v1/users/${uid}/events`, {
        method: 'post',
        body: JSON.stringify(requestBody),
        headers: {
            'Content-Type': 'application/json',
            Authorization: auth
        }
    }).then(() => Promise.resolve())
        .catch(() => { });
}
var posthogEngageSoPlugin = {
    onEvent
};

export { posthogEngageSoPlugin as default };
