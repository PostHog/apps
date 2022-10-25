import { RetryError } from '@posthog/plugin-scaffold';
import { Client } from 'pg';

const setupPlugin = async (meta) => {
    const { global, config } = meta;
    const requiredConfigOptions = ['clusterHost', 'clusterPort', 'dbName', 'dbUsername', 'dbPassword'];
    for (const option of requiredConfigOptions) {
        if (!(option in config)) {
            throw new Error(`Required config option ${option} is missing!`);
        }
    }
    if (!config.clusterHost.endsWith('redshift.amazonaws.com')) {
        throw new Error('Cluster host must be a valid AWS Redshift host');
    }
    Math.max(1, Math.min(parseInt(config.uploadMegabytes) || 1, 10));
    Math.max(1, Math.min(parseInt(config.uploadSeconds) || 1, 600));
    global.sanitizedTableName = sanitizeSqlIdentifier(config.tableName);
    const propertiesDataType = config.propertiesDataType === 'varchar' ? 'varchar(65535)' : 'super';
    const queryError = await executeQuery(`CREATE TABLE IF NOT EXISTS public.${global.sanitizedTableName} (
            uuid varchar(200),
            event varchar(200),
            properties ${propertiesDataType},
            elements varchar(65535),
            set ${propertiesDataType},
            set_once ${propertiesDataType},
            timestamp timestamp with time zone,
            team_id int,
            distinct_id varchar(200),
            ip varchar(200),
            site_url varchar(200)
        );`, [], config);
    if (queryError) {
        throw new Error(`Unable to connect to Redshift cluster and create table with error: ${queryError.message}`);
    }
    global.eventsToIgnore = new Set(config.eventsToIgnore ? config.eventsToIgnore.split(',').map((event) => event.trim()) : null);
};
async function exportEvents(events, meta) {
    const eventsToExport = events.filter((event) => !meta.global.eventsToIgnore.has(event.event));
    const parsedEvents = eventsToExport.map(parseEvent);
    await insertBatchIntoRedshift(parsedEvents, meta);
}
const parseEvent = (event) => {
    const { event: eventName, properties, $set, $set_once, distinct_id, team_id, uuid, timestamp, ..._discard } = event;
    const ip = properties?.['$ip'] || event.ip;
    let ingestedProperties = properties;
    let elements = [];
    if (eventName === '$autocapture' && properties && '$elements' in properties) {
        const { $elements, ...props } = properties;
        ingestedProperties = props;
        elements = $elements;
    }
    const parsedEvent = {
        uuid,
        eventName,
        properties: JSON.stringify(ingestedProperties || {}),
        elements: JSON.stringify(elements || {}),
        set: JSON.stringify($set || {}),
        set_once: JSON.stringify($set_once || {}),
        distinct_id,
        team_id,
        ip,
        site_url: '',
        timestamp: new Date(timestamp).toISOString(),
    };
    return parsedEvent;
};
const insertBatchIntoRedshift = async (events, { global, config }) => {
    let values = [];
    let valuesString = '';
    function getPropsInsertString(stringifiedValue) {
        return config.propertiesDataType === 'super' ? `JSON_PARSE(${stringifiedValue})` : stringifiedValue;
    }
    for (let i = 0; i < events.length; ++i) {
        const { uuid, eventName, properties, elements, set, set_once, distinct_id, team_id, ip, site_url, timestamp } = events[i];
        valuesString += ' (';
        for (let j = 1; j <= 11; ++j) {
            valuesString += `$${11 * i + j}${j === 11 ? '' : ', '}`;
        }
        valuesString += `)${i === events.length - 1 ? '' : ','}`;
        values = [
            ...values,
            ...[
                uuid,
                eventName,
                getPropsInsertString(properties),
                elements,
                getPropsInsertString(set),
                getPropsInsertString(set_once),
                distinct_id,
                team_id,
                ip,
                site_url,
                timestamp,
            ],
        ];
    }
    console.log(`Flushing ${events.length} event${events.length > 1 ? 's' : ''} to RedShift`);
    const queryError = await executeQuery(`INSERT INTO ${global.sanitizedTableName} (uuid, event, properties, elements, set, set_once, distinct_id, team_id, ip, site_url, timestamp)
        VALUES ${valuesString}`, values, config);
    if (queryError) {
        console.error(`Error uploading to Redshift: ${queryError.message}. Setting up retries...`);
        throw new RetryError();
    }
};
const executeQuery = async (query, values, config) => {
    const pgClient = new Client({
        user: config.dbUsername,
        password: config.dbPassword,
        host: config.clusterHost,
        database: config.dbName,
        port: parseInt(config.clusterPort),
    });
    let error = null;
    try {
        await pgClient.connect();
        await pgClient.query(query, values);
    }
    catch (err) {
        error = err;
    }
    finally {
        await pgClient.end();
    }
    return error;
};
const teardownPlugin = ({ global }) => {
    global.buffer.flush();
};
const sanitizeSqlIdentifier = (unquotedIdentifier) => {
    return unquotedIdentifier.replace(/[^\w\d_.]+/g, '');
};

export { exportEvents, insertBatchIntoRedshift, parseEvent, setupPlugin, teardownPlugin };
