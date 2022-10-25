import { createHash, randomUUID } from 'crypto';

const NAMESPACE_OID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';
const stringifyEvent = (event) => {
    return `(${randomUUID().toString()}; project #${event.team_id}). Event "${event.event}" @ ${event.timestamp} for user ${event.distinct_id}.`;
};
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function stringifyUUID(arr) {
    return (byteToHex[arr[0]] +
        byteToHex[arr[1]] +
        byteToHex[arr[2]] +
        byteToHex[arr[3]] +
        '-' +
        byteToHex[arr[4]] +
        byteToHex[arr[5]] +
        '-' +
        byteToHex[arr[6]] +
        byteToHex[arr[7]] +
        '-' +
        byteToHex[arr[8]] +
        byteToHex[arr[9]] +
        '-' +
        byteToHex[arr[10]] +
        byteToHex[arr[11]] +
        byteToHex[arr[12]] +
        byteToHex[arr[13]] +
        byteToHex[arr[14]] +
        byteToHex[arr[15]]).toLowerCase();
}
const plugin = {
    processEvent: async (event, { config }) => {
        stringifyEvent(event);
        if (!event.timestamp) {
            console.info('Received event without a timestamp, the event will not be processed because deduping will not work.');
            return event;
        }
        const stringifiedProps = config.dedupMode === 'All Properties' ? `_${JSON.stringify(event.properties)}` : '';
        const hash = createHash('sha1');
        const eventKeyBuffer = hash
            .update(`${NAMESPACE_OID}_${event.team_id}_${event.distinct_id}_${event.event}_${event.timestamp}${stringifiedProps}`)
            .digest();
        eventKeyBuffer[6] = (eventKeyBuffer[6] & 0x0f) | 0x50;
        eventKeyBuffer[8] = (eventKeyBuffer[8] & 0x3f) | 0x80;
        event.uuid = stringifyUUID(eventKeyBuffer);
        return event;
    },
};
module.exports = plugin;
