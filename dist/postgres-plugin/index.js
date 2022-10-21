import { Client } from 'pg';

const randomBytes = () => {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
};
const generateUuid = () => {
    return (randomBytes() +
        randomBytes() +
        '-' +
        randomBytes() +
        '-3' +
        randomBytes().substr(0, 2) +
        '-' +
        randomBytes() +
        '-' +
        randomBytes() +
        randomBytes() +
        randomBytes()).toLowerCase();
};
const jobs = {
    uploadBatchToPostgres: async (payload, meta) => {
        await insertBatchIntoPostgres(payload, meta);
    },
};
const setupPlugin = async (meta) => {
    const { global, config } = meta;
    if (!config.databaseUrl) {
        const requiredConfigOptions = ['host', 'port', 'dbName', 'dbUsername', 'dbPassword'];
        for (const option of requiredConfigOptions) {
            if (!(option in config)) {
                throw new Error(`Required config option ${option} is missing!`);
            }
        }
    }
    global.sanitizedTableName = sanitizeSqlIdentifier(config.tableName);
    const queryError = await executeQuery(`CREATE TABLE IF NOT EXISTS public.${global.sanitizedTableName} (
            uuid varchar(200),
            event varchar(200),
            properties jsonb,
            elements jsonb,
            set jsonb,
            set_once jsonb,
            timestamp timestamp with time zone,
            team_id int,
            distinct_id varchar(200),
            ip varchar(200),
            site_url varchar(200)
        );`, [], config);
    if (queryError) {
        throw new Error(`Unable to connect to PostgreSQL instance and create table with error: ${queryError.message}`);
    }
    global.eventsToIgnore = new Set(config.eventsToIgnore ? config.eventsToIgnore.split(',').map((event) => event.trim()) : null);
};
async function exportEvents(events, { global, jobs }) {
    const batch = [];
    for (const event of events) {
        const { event: eventName, properties, $set, $set_once, distinct_id, team_id, site_url, now, sent_at, uuid, ..._discard } = event;
        if (global.eventsToIgnore.has(eventName)) {
            continue;
        }
        const ip = (properties === null || properties === void 0 ? void 0 : properties['$ip']) || event.ip;
        const timestamp = event.timestamp || (properties === null || properties === void 0 ? void 0 : properties.timestamp) || now || sent_at;
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
            site_url,
            timestamp: new Date(timestamp).toISOString(),
        };
        batch.push(parsedEvent);
    }
    if (batch.length > 0) {
        await jobs
            .uploadBatchToPostgres({ batch, batchId: Math.floor(Math.random() * 1000000), retriesPerformedSoFar: 0 })
            .runNow();
    }
}
const insertBatchIntoPostgres = async (payload, { global, jobs, config }) => {
    let values = [];
    let valuesString = '';
    for (let i = 0; i < payload.batch.length; ++i) {
        const { uuid, eventName, properties, elements, set, set_once, distinct_id, team_id, ip, site_url, timestamp } = payload.batch[i];
        valuesString += ' (';
        for (let j = 1; j <= 11; ++j) {
            valuesString += `$${11 * i + j}${j === 11 ? '' : ', '}`;
        }
        valuesString += `)${i === payload.batch.length - 1 ? '' : ','}`;
        values = values.concat([
            uuid || generateUuid(),
            eventName,
            properties,
            elements,
            set,
            set_once,
            distinct_id,
            team_id,
            ip,
            site_url,
            timestamp,
        ]);
    }
    console.log(`(Batch Id: ${payload.batchId}) Flushing ${payload.batch.length} event${payload.batch.length > 1 ? 's' : ''} to Postgres instance`);
    const queryError = await executeQuery(`INSERT INTO ${global.sanitizedTableName} (uuid, event, properties, elements, set, set_once, distinct_id, team_id, ip, site_url, timestamp)
        VALUES ${valuesString}`, values, config);
    if (queryError) {
        console.error(`(Batch Id: ${payload.batchId}) Error uploading to Postgres: ${queryError.message}`);
        if (payload.retriesPerformedSoFar >= 15) {
            return;
        }
        const nextRetryMs = 2 ** payload.retriesPerformedSoFar * 3000;
        console.log(`Enqueued batch ${payload.batchId} for retry in ${nextRetryMs}ms`);
        await jobs
            .uploadBatchToPostgres({
            ...payload,
            retriesPerformedSoFar: payload.retriesPerformedSoFar + 1,
        })
            .runIn(nextRetryMs, 'milliseconds');
    }
};
const executeQuery = async (query, values, config) => {
    const basicConnectionOptions = config.databaseUrl
        ? {
            connectionString: config.databaseUrl,
        }
        : {
            user: config.dbUsername,
            password: config.dbPassword,
            host: config.host,
            database: config.dbName,
            port: parseInt(config.port),
        };
    const pgClient = new Client({
        ...basicConnectionOptions,
        ssl: {
            rejectUnauthorized: config.hasSelfSignedCert === 'No',
        },
    });
    await pgClient.connect();
    let error = null;
    try {
        await pgClient.query(query, values);
    }
    catch (err) {
        error = err;
    }
    await pgClient.end();
    return error;
};
const sanitizeSqlIdentifier = (unquotedIdentifier) => {
    return unquotedIdentifier.replace(/[^\w\d_]+/g, '');
};

export { exportEvents, insertBatchIntoPostgres, jobs, setupPlugin };
