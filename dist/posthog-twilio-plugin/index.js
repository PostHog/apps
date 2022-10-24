async function setupPlugin({ config, global }) {
    global.baseURL = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSID}/Messages.json`;

    global.token = Buffer.from(`${config.accountSID}:${config.authToken}`).toString('base64');

    global.options = {
        headers: {
            Authorization: `Basic ${global.token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    global.senderPhoneNumber = config.senderPhoneNumber;
    const maxTimeout = 365 * 24 * 60 * 60; // one year
    if (config.timeout <= 0 || config.timeout > maxTimeout) {
        throw new Error(`timeout is not supported`)
    } else {
        global.timeout = config.timeout;
    }

    const eventToNumberPairs = (config.triggeringEventsAndNumber || '').split(',').map((value) => value.trim());

    global.eventAndNumberMap = {};
    for (const pair of eventToNumberPairs) {
        const [event, num] = (pair || '').split(':').map((value) => value.trim());
        global.eventAndNumberMap[event] = num;
    }
}

async function fetchWithRetry(url, options = {}, method = 'GET', isRetry = false) {
    try {
        const res = await fetch(url, { method: method, ...options });
        return res
    } catch {
        if (isRetry) {
            throw new Error(`${method} request to ${url} failed.`)
        }
        const res = await fetchWithRetry(url, options, (method = method), (isRetry = true));
        return res
    }
}
const jobs = {
    sendMessageWithTwilio: async (request, { global, cache }) => {
        const number = global.eventAndNumberMap[request.eventName];
        let response = null;
        const cacheValue = await cache.get(`${request.eventName}-${number}`, null);
        console.log(cacheValue);
        if (cacheValue) {
            return response
        } else {
            await cache.set(`${request.eventName}-${number}`, true, global.timeout);
            global.options.body = `Body=Hi ${request.eventName} occured - PostHog&From=${global.senderPhoneNumber}&To=${number}`;

            response = await fetchWithRetry(global.baseURL, global.options, 'POST');
        }
        return response
    },
};

async function onEvent(event, { jobs, global }) {
    if (!global.eventAndNumberMap[event.event]) {
        return null
    } else {
        ({
            eventName: event.event,
        });
    }
await jobs.sendMessageWithTwilio(request).runNow();
}

var posthogTwilioPlugin = {
    setupPlugin,
    onEvent,
    jobs,
};

export { posthogTwilioPlugin as default };
