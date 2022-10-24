const setupPlugin = ({ config, global }) => {
    try {
        const eventPairs = extractEventsToTrack(config.eventsToTrack);
        let eventsToTrack = {};
        let firstStepEvents = new Set();
        eventPairs.forEach(([first, second]) => {
            firstStepEvents.add(first);
            if (eventsToTrack[second]) {
                eventsToTrack[second].add(first);
            }
            else {
                eventsToTrack[second] = new Set([first]);
            }
        });
        global.eventsToTrack = eventsToTrack;
        global.firstStepEvents = firstStepEvents;
    }
    catch {
        throw new Error('Unable to parse your config. Please make sure you are using the commas and parentheses correctly.');
    }
};
function extractEventsToTrack(eventsToTrack) {
    if (!/^((\([^\(\)\,]+\,[^\(\)\,]+\)\,?)*)(?<!\,)$/.test(eventsToTrack)) {
        throw new Error('Unable to extract events to track');
    }
    const pairs = eventsToTrack.substring(1, eventsToTrack.length - 1).split('),(');
    return pairs.map((pair) => {
        const [_, first, second] = /^(.+)\,(.+)$/.exec(pair);
        return [first.trim(), second.trim()];
    });
}
const processEvent = async (event, { config, global, storage }) => {
    const timestamp = new Date(event.timestamp || event.properties?.timestamp || event.now || event.sent_at || event.properties?.['$time']).getTime();
    if (timestamp) {
        if (global.firstStepEvents.has(event.event)) {
            const existingTimestamp = await storage.get(`${event.event}_${event.distinct_id}`, null);
            if (!existingTimestamp || (existingTimestamp && config.updateTimestamp === 'Yes')) {
                await storage.set(`${event.event}_${event.distinct_id}`, timestamp);
            }
        }
        if (global.eventsToTrack[event.event]) {
            for (let eventA of Array.from(global.eventsToTrack[event.event])) {
                const storedTimestamp = await storage.get(`${eventA}_${event.distinct_id}`, null);
                const propertyName = `time_since_${eventA.replace(' ', '_')}`;
                if (storedTimestamp) {
                    event.properties[propertyName] = timestamp - Number(storedTimestamp);
                }
            }
        }
    }
    event.properties['working'] = 'working';
    return event;
};

export { extractEventsToTrack, processEvent, setupPlugin };
