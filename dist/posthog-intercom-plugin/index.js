import { RetryError } from '@posthog/plugin-scaffold';
import fetch from 'node-fetch';

const jobs = {
    sendToIntercom: async (request, { global, config }) => {
        const isContactInIntercom = await searchForContactInIntercom(global.intercomUrl, config.intercomApiKey, request.email);
        if (!isContactInIntercom) {
            return;
        }
        await sendEventToIntercom(global.intercomUrl, config.intercomApiKey, request.email, request.event, request.userId, request.timestamp);
    },
};
async function setupPlugin({ config, global }) {
    global.intercomUrl =
        config.useEuropeanDataStorage === 'Yes' ? 'https://api.eu.intercom.com' : 'https://api.intercom.io';
}
async function onEvent(event, { config, jobs }) {
    if (!isTriggeringEvent(config.triggeringEvents, event.event)) {
        return;
    }
    const email = getEmailFromEvent(event);
    if (!email) {
        console.warn(`This event will not be sent to Intercom because no 'email' was found in the event properties.`);
        return;
    }
    if (isIgnoredEmailDomain(config.ignoredEmailDomains, email)) {
        return;
    }
    const timestamp = getTimestamp(event);
    await jobs
        .sendToIntercom({
        email,
        event: event.event,
        userId: event['distinct_id'],
        timestamp,
    })
        .runNow();
}
async function searchForContactInIntercom(url, apiKey, email) {
    const searchContactResponse = await fetchWithRetry(`${url}/contacts/search`, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            query: {
                field: 'email',
                operator: '=',
                value: email,
            },
        }),
    }, 'POST');
    const searchContactResponseJson = (await searchContactResponse.json());
    if (!statusOk(searchContactResponse) || searchContactResponseJson.errors) {
        const errorMessage = searchContactResponseJson.errors ? searchContactResponseJson.errors[0].message : '';
        console.error(`Unable to search contact ${email} in Intercom. Status Code: ${searchContactResponseJson.status}. Error message: ${errorMessage}`);
        return false;
    }
    else {
        const found = searchContactResponseJson['total_count'] > 0;
        console.log(`Contact ${email} in Intercom ${found ? 'found' : 'not found'}`);
        return found;
    }
}
async function sendEventToIntercom(url, apiKey, email, event, distinct_id, eventSendTime) {
    const sendEventResponse = await fetchWithRetry(`${url}/events`, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            event_name: event,
            created_at: eventSendTime,
            email,
            id: distinct_id,
        }),
    }, 'POST');
    if (!statusOk(sendEventResponse)) {
        let errorMessage = '';
        try {
            const sendEventResponseJson = await sendEventResponse.json();
            errorMessage = sendEventResponseJson.errors ? sendEventResponseJson.errors[0].message : '';
        }
        catch { }
        console.error(`Unable to send event ${event} for ${email} to Intercom. Status Code: ${sendEventResponse.status}. Error message: ${errorMessage}`);
    }
    else {
        console.log(`Sent event ${event} for ${email} to Intercom`);
    }
}
async function fetchWithRetry(url, options = {}, method = 'GET') {
    try {
        const res = await fetch(url, { method: method, ...options });
        return res;
    }
    catch {
        throw new RetryError('Service is down, retry later');
    }
}
function statusOk(res) {
    return String(res.status)[0] === '2';
}
function isEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}
function getEmailFromEvent(event) {
    if (isEmail(event.distinct_id)) {
        return event.distinct_id;
    }
    else if (event['$set'] && Object.keys(event['$set']).includes('email')) {
        if (isEmail(event['$set']['email'])) {
            return event['$set']['email'];
        }
    }
    else if (event['properties'] && Object.keys(event['properties']).includes('email')) {
        if (isEmail(event['properties']['email'])) {
            return event['properties']['email'];
        }
    }
    return null;
}
function isIgnoredEmailDomain(ignoredEmailDomains, email) {
    const emailDomainsToIgnore = (ignoredEmailDomains || '').split(',').map((e) => e.trim());
    return emailDomainsToIgnore.includes(email.split('@')[1]);
}
function isTriggeringEvent(triggeringEvents, event) {
    const validEvents = (triggeringEvents || '').split(',').map((e) => e.trim());
    return validEvents.indexOf(event) >= 0;
}
function getTimestamp(event) {
    try {
        if (event['timestamp']) {
            return Number(event['timestamp']);
        }
    }
    catch {
        console.error('Event timestamp cannot be parsed as a number');
    }
    const date = event['sent_at'] ? new Date(event['sent_at']) : new Date();
    return Math.floor(date.getTime() / 1000);
}

export { getEmailFromEvent, getTimestamp, isIgnoredEmailDomain, isTriggeringEvent, jobs, onEvent, setupPlugin };
