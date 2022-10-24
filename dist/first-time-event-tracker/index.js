async function setupPlugin({ config, global }) {
    global.eventsToTrack = new Set(config.events.split(','));
}

async function processEvent(event, { global, storage }) {
    if (global.eventsToTrack.has(event.event)) {
        if (!event.properties) {
            event.properties = {};
        }
        const eventSeenBefore = await storage.get(event.event);
        const eventSeenBeforeForUser = await storage.get(`${event.event}_${event.distinct_id}`);
        event.properties['is_first_event_ever'] = !eventSeenBefore;
        event.properties['is_first_event_for_user'] = !eventSeenBeforeForUser;

        if (!eventSeenBeforeForUser) {
            storage.set(`${event.event}_${event.distinct_id}`, true);
            if (!eventSeenBefore) {
                storage.set(event.event, true);
            }
        }


    }

    return event
}

var firstTimeEventTracker = {
    setupPlugin,
    processEvent,
};

export { firstTimeEventTracker as default };
