import { RetryError } from '@posthog/plugin-scaffold';
import { createBuffer } from '@posthog/plugin-contrib';

const makeLogger = (debugLoggingOn) => {
    return {
        error: console.error,
        log: console.log,
        debug: debugLoggingOn
            ? console.debug
            : () => {
            },
    };
};
const CACHE_TOKEN = 'SF_AUTH_TOKEN';
const CACHE_TTL = 60 * 60 * 5;
function verifyConfig({ config }) {
    if (!config.salesforceHost) {
        throw new Error('host not provided!');
    }
    if (!/https:\/\/(.+).my.salesforce.com$/.test(config.salesforceHost)) {
        throw new Error('Invalid salesforce host');
    }
    if (!config.username) {
        throw new Error('Username not provided!');
    }
    if (!config.password) {
        throw new Error('Password not provided!');
    }
    if (!config.eventsToInclude) {
        throw new Error('No events to include!');
    }
}
async function sendEventToSalesforce(event, meta) {
    try {
        const { config, global } = meta;
        global.logger.debug('processing event: ', event === null || event === void 0 ? void 0 : event.event);
        const token = await getToken(meta);
        const properties = getProperties(event, meta);
        const response = await fetch(`${config.salesforceHost}/${config.eventPath}`, {
            method: config.eventMethodType,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(properties),
        });
        const isOk = await statusOk(response, global.logger);
        if (!isOk) {
            throw new Error(`Not a 200 response from event hook ${response.status}. Response: ${response}`);
        }
    }
    catch (error) {
        meta.global.logger.error('error while sending event to salesforce. event: ', event, ' the error was ', error);
        throw error;
    }
}
async function getToken(meta) {
    const { cache } = meta;
    const token = await cache.get(CACHE_TOKEN, null);
    if (token == null) {
        await generateAndSetToken(meta);
        return await getToken(meta);
    }
    return token;
}
async function generateAndSetToken({ config, cache, global }) {
    const details = {
        grant_type: 'password',
        client_id: config.consumerKey,
        client_secret: config.consumerSecret,
        username: config.username,
        password: config.password,
    };
    const formBody = [];
    for (const property in details) {
        const encodedKey = encodeURIComponent(property);
        const encodedValue = encodeURIComponent(details[property]);
        formBody.push(encodedKey + '=' + encodedValue);
    }
    const response = await fetch(`${config.salesforceHost}/services/oauth2/token`, {
        method: 'post',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.join('&'),
    });
    if (!statusOk(response, global.logger)) {
        throw new Error(`Got bad response getting the token ${response.status}`);
    }
    const body = await response.json();
    cache.set(CACHE_TOKEN, body.access_token, CACHE_TTL);
    return body.access_token;
}
async function setupPlugin(meta) {
    const { global } = meta;
    const debugLoggingOn = meta.config.debugLogging === 'debug logging on';
    global.logger = makeLogger(debugLoggingOn);
    verifyConfig(meta);
    try {
        await getToken(meta);
    }
    catch (error) {
        global.logger.error('error in getToken', error);
        throw new RetryError('Failed to getToken. cache or salesforce is unavailable');
    }
    global.buffer = createBuffer({
        limit: 1024 * 1024,
        timeoutSeconds: 1,
        onFlush: async (events) => {
            for (const event of events) {
                await sendEventToSalesforce(event, meta);
            }
        },
    });
}
async function onEvent(event, { global, config }) {
    if (!global.buffer) {
        throw new Error(`there is no buffer. setup must have failed, cannot process event: ${event.event}`);
    }
    const types = (config.eventsToInclude || '').split(',');
    if (!types.includes(event.event) || !event.properties) {
        return;
    }
    const eventSize = JSON.stringify(event).length;
    global.buffer.add(event, eventSize);
}
function teardownPlugin({ global }) {
    global.buffer.flush();
}
async function statusOk(res, logger) {
    logger.debug('testing response for whether it is "ok". has status: ', res.status, ' debug: ', JSON.stringify(res));
    return String(res.status)[0] === '2';
}
function getProperties(event, { config }) {
    var _a;
    const { properties } = event;
    if (!properties) {
        return {};
    }
    if (!((_a = config.propertiesToInclude) === null || _a === void 0 ? void 0 : _a.trim())) {
        return properties;
    }
    const allParameters = config.propertiesToInclude.split(',');
    const propertyKeys = Object.keys(properties);
    const availableParameters = allParameters.reduce((acc, currentValue) => {
        const trimmedKey = currentValue.trim();
        if (propertyKeys.includes(trimmedKey)) {
            acc[trimmedKey] = properties[trimmedKey];
        }
        return acc;
    }, {});
    return availableParameters;
}

export { onEvent, setupPlugin, teardownPlugin };
