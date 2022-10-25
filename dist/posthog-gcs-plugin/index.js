import { RetryError } from '@posthog/plugin-scaffold';
import { Storage } from '@google-cloud/storage';
import { PassThrough } from 'stream';
import { randomBytes } from 'crypto';

function transformEventToRow(fullEvent) {
    const { event, properties, $set, $set_once, distinct_id, team_id, site_url, now, sent_at, uuid, ...rest } = fullEvent;
    const ip = properties?.['$ip'] || fullEvent.ip;
    const timestamp = fullEvent.timestamp || properties?.timestamp || now || sent_at;
    let ingestedProperties = properties;
    let elements = [];
    if (event === '$autocapture' && properties?.['$elements']) {
        const { $elements, ...props } = properties;
        ingestedProperties = props;
        elements = $elements;
    }
    return {
        event,
        distinct_id,
        team_id,
        ip,
        site_url,
        timestamp,
        uuid: uuid,
        properties: JSON.stringify(ingestedProperties || {}),
        elements: JSON.stringify(elements || []),
        people_set: JSON.stringify($set || {}),
        people_set_once: JSON.stringify($set_once || {}),
    };
}
const setupPlugin = async ({ attachments, global, config }) => {
    if (!attachments.googleCloudKeyJson) {
        throw new Error('Credentials JSON file not provided!');
    }
    if (!config.bucketName) {
        throw new Error('Table Name not provided!');
    }
    let credentials;
    try {
        credentials = JSON.parse(attachments.googleCloudKeyJson.contents.toString());
    }
    catch {
        throw new Error('Credentials JSON file has invalid JSON!');
    }
    const storage = new Storage({
        projectId: credentials['project_id'],
        credentials,
        autoRetry: false,
    });
    global.bucket = storage.bucket(config.bucketName);
    global.eventsToIgnore = new Set((config.exportEventsToIgnore || '').split(',').map((event) => event.trim()));
};
const exportEvents = async (events, { global, config }) => {
    const rows = events.filter((event) => !global.eventsToIgnore.has(event.event.trim())).map(transformEventToRow);
    if (rows.length) {
        console.info(`Saving batch of ${rows.length} event${rows.length !== 1 ? 's' : ''} to GCS bucket ${config.bucketName}`);
    }
    else {
        console.info(`Skipping an empty batch of events`);
    }
    let csvString = 'uuid,event,properties,elements,people_set,people_set_once,distinct_id,team_id,ip,site_url,timestamp\n';
    for (let i = 0; i < rows.length; ++i) {
        const { uuid, event, properties, elements, people_set, people_set_once, distinct_id, team_id, ip, site_url, timestamp, } = rows[i];
        csvString += `${uuid},${event},${properties},${elements},${people_set},${people_set_once},${distinct_id},${team_id},${ip},${site_url},${timestamp}`;
        if (i !== rows.length - 1) {
            csvString += '\n';
        }
    }
    const date = new Date().toISOString();
    const [day, time] = date.split('T');
    const dayTime = `${day.split('-').join('')}-${time.split(':').join('')}`;
    const suffix = randomBytes(8).toString('hex');
    const fileName = `${day}/${dayTime}-${suffix}.csv`;
    const dataStream = new PassThrough();
    const gcFile = global.bucket.file(fileName);
    dataStream.push(csvString);
    dataStream.push(null);
    try {
        await new Promise((resolve, reject) => {
            dataStream
                .pipe(gcFile.createWriteStream({
                resumable: false,
                validation: false,
            }))
                .on('error', (error) => {
                reject(error);
            })
                .on('finish', () => {
                resolve(true);
            });
        });
    }
    catch {
        console.error(`Failed to upload ${rows.length} event${rows.length > 1 ? 's' : ''} to GCS. Retrying later.`);
        throw new RetryError();
    }
};

export { exportEvents, setupPlugin };
