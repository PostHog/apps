import { RetryError } from '@posthog/plugin-scaffold';
import fetch from 'node-fetch';

const filterEvents = (events, config) => {
    if (!config.allowedEventTypes) {
        return events;
    }
    let allowedEventTypes = config.allowedEventTypes.split(",");
    allowedEventTypes = allowedEventTypes.map((eventType) => eventType.trim());
    const allowedEventTypesSet = new Set(allowedEventTypes);
    let filteredEvents = events.filter((event) => allowedEventTypesSet.has(event.event));
    return filteredEvents;
};
async function setupPlugin({ config }) {
    console.log("Loaded Patterns app.");
}
const exportEvents = async (events, { config }) => {
    let filteredEvents = filterEvents(events, config);
    console.log(`Exporting events to Patterns webhook... ${filteredEvents.length}/${events.length} events`);
    if (!filteredEvents.length) {
        return;
    }
    let response;
    response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filteredEvents),
    });
    if (response.status != 200) {
        const data = await response.json();
        throw new RetryError(`Export events failed: ${JSON.stringify(data)}`);
    }
    console.log("Export Success.");
};

export { exportEvents, setupPlugin };
