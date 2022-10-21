import fetch from 'node-fetch';

async function runEveryMinute({ config }) {
    if (!config.events) {
        config.events = 'heartbeat';
    }
    const timestamp = new Date().toISOString();
    const eventsArray = config.events.split(' + ');
    const capturePromises = [];
    if (eventsArray.includes('heartbeat')) {
        capturePromises.push(captureHeartbeat(timestamp));
    }
    if (eventsArray.includes('heartbeat_buffer')) {
        capturePromises.push(captureHeartbeatBuffer(timestamp));
    }
    if (eventsArray.includes('heartbeat_api')) {
        if (!config.host) {
            throw new Error('PostHog host needs to be configured for heartbeat_api to work!');
        }
        if (!config.project_api_key) {
            throw new Error('PostHog project API key needs to be configured for heartbeat_api to work!');
        }
        capturePromises.push(captureHeartbeatApi(timestamp, config.host, config.project_api_key));
    }
    await Promise.all(capturePromises);
    console.info(`Sent ${config.events} at ${timestamp}`);
}
async function captureHeartbeat(timestamp) {
    await posthog.capture('heartbeat', { $timestamp: timestamp });
}
async function captureHeartbeatBuffer(timestamp) {
    const randomDistinctId = `PostHog Heartbeat Plugin / Buffer ${Date.now()}`;
    await posthog.capture('heartbeat_buffer', { $timestamp: timestamp, distinct_id: randomDistinctId });
}
async function captureHeartbeatApi(timestamp, host, projectApiKey) {
    await fetch(`${host}/e`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            token: projectApiKey,
            event: 'heartbeat_api',
            distinct_id: 'PostHog Heartbeat Plugin',
            properties: { $timestamp: timestamp },
        }),
    });
}

export { runEveryMinute };
