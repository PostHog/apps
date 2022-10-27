/* global posthog */
/* eslint no-undef: "error" */

import fetch from 'node-fetch'

export async function runEveryMinute({ config }) {
    if (!config.events) {
        config.events = 'heartbeat'
    }
    const timestamp = new Date().toISOString()
    const eventsArray = config.events.split(' + ')
    const capturePromises = []
    if (eventsArray.includes('heartbeat')) {
        capturePromises.push(captureHeartbeat(timestamp))
    }
    if (eventsArray.includes('heartbeat_buffer')) {
        capturePromises.push(captureHeartbeatBuffer(timestamp))
    }
    if (eventsArray.includes('heartbeat_api')) {
        if (!config.host) {
            throw new Error('PostHog host needs to be configured for heartbeat_api to work!')
        }
        if (!config.project_api_key) {
            throw new Error('PostHog project API key needs to be configured for heartbeat_api to work!')
        }
        capturePromises.push(captureHeartbeatApi(timestamp, config.host, config.project_api_key))
    }
    await Promise.all(capturePromises)
    console.info(`Sent ${config.events} at ${timestamp}`)
}

/** Capture `heartbeat` event, directly into the queue */
async function captureHeartbeat(timestamp: string) {
    await posthog.capture('heartbeat', { $timestamp: timestamp })
}

/** Capture `heartbeat` event, directly into the queue, but with a random distinct ID so that it goes via buffer */
async function captureHeartbeatBuffer(timestamp: string) {
    const randomDistinctId = `PostHog Heartbeat Plugin / Buffer ${Date.now()}`
    await posthog.capture('heartbeat_buffer', { $timestamp: timestamp, distinct_id: randomDistinctId })
}

/** Capture `heartbeat_api` event, via the API */
async function captureHeartbeatApi(timestamp: string, host: string, projectApiKey: string) {
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
    })
}
