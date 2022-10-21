import { randomUUID } from 'crypto';
import fetch from 'node-fetch';

const setupPlugin = async ({ config, global }) => {
    global.defaultHeaders = {
        env: config.environment,
        'api-key': config.avoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
    };
};
const exportEvents = async (events, { config, global }) => {
    if (events.length === 0) {
        return;
    }
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const avoEvents = [];
    const baseEventPayload = {
        apiKey: config.avoApiKey,
        env: config.environment,
        appName: config.appName,
        sessionId: sessionId,
        createdAt: now,
        avoFunction: false,
        eventId: null,
        eventHash: null,
        appVersion: '1.0.0',
        libVersion: '1.0.0',
        libPlatform: 'node',
        messageId: '5875bc8b-a8e6-4f20-a499-8af557467a02',
        trackingId: '',
        samplingRate: 1,
        type: 'event',
        eventName: 'event_name',
        eventProperties: [],
    };
    for (const event of events) {
        if (!event.event.startsWith("$")) {
            avoEvents.push({
                ...baseEventPayload,
                eventName: event.event,
                messageId: event.uuid,
                eventProperties: event.properties ? convertPosthogPropsToAvoProps(event.properties) : [],
            });
        }
    }
    try {
        const sessionStartRes = await fetch('https://api.avo.app/inspector/posthog/v1/track', {
            method: 'POST',
            headers: global.defaultHeaders,
            body: JSON.stringify([
                {
                    apiKey: config.avoApiKey,
                    env: config.environment,
                    appName: config.appName,
                    createdAt: now,
                    sessionId: sessionId,
                    appVersion: '1.0.0',
                    libVersion: '1.0.1',
                    libPlatform: 'node',
                    messageId: randomUUID(),
                    trackingId: '',
                    samplingRate: 1,
                    type: 'sessionStarted',
                },
            ]),
        });
        if (sessionStartRes.status !== 200) {
            throw new Error(`sessionStarted request failed with status code ${sessionStartRes.status}`);
        }
        const trackEventsRes = await fetch('https://api.avo.app/inspector/posthog/v1/track', {
            method: 'POST',
            headers: global.defaultHeaders,
            body: JSON.stringify(avoEvents),
        });
        const trackEventsResJson = (await trackEventsRes.json());
        if (trackEventsRes.status !== 200 ||
            !trackEventsResJson ||
            ('ok' in trackEventsResJson && !trackEventsResJson.ok)) {
            throw new Error('track events request failed');
        }
        console.log(`Succesfully sent ${events.length} events to Avo`);
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Unable to send data to Avo with error:', errorMessage);
    }
};
const convertPosthogPropsToAvoProps = (properties) => {
    const avoProps = [];
    for (const [propertyName, propertyValue] of Object.entries(properties)) {
        if (!propertyName.startsWith("$")) {
            avoProps.push({ propertyName, propertyType: getPropValueType(propertyValue) });
        }
    }
    return avoProps;
};
const getPropValueType = (propValue) => {
    let propType = typeof propValue;
    if (propValue == null) {
        return 'null';
    }
    else if (propType === 'string') {
        return 'string';
    }
    else if (propType === 'number' || propType === 'bigint') {
        if ((propValue + '').indexOf('.') >= 0) {
            return 'float';
        }
        else {
            return 'int';
        }
    }
    else if (propType === 'boolean') {
        return 'boolean';
    }
    else if (propType === 'object') {
        if (Array.isArray(propValue)) {
            return 'list';
        }
        else {
            return 'object';
        }
    }
    else {
        return propType;
    }
};

export { exportEvents, setupPlugin };