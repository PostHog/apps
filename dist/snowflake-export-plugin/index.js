import * as snowflake from 'snowflake-sdk';
import { createPool } from 'generic-pool';
import { RetryError } from '@posthog/plugin-scaffold';
import { randomBytes } from 'crypto';
import { S3 } from 'aws-sdk';
import { Storage } from '@google-cloud/storage';
import { PassThrough } from 'stream';

const TABLE_SCHEMA = [
    { name: 'uuid', type: 'STRING' },
    { name: 'event', type: 'STRING' },
    { name: 'properties', type: 'VARIANT' },
    { name: 'elements', type: 'VARIANT' },
    { name: 'people_set', type: 'VARIANT' },
    { name: 'people_set_once', type: 'VARIANT' },
    { name: 'distinct_id', type: 'STRING' },
    { name: 'team_id', type: 'INTEGER' },
    { name: 'ip', type: 'STRING' },
    { name: 'site_url', type: 'STRING' },
    { name: 'timestamp', type: 'TIMESTAMP' },
];
const CSV_FIELD_DELIMITER = '|$|';
const FILES_STAGED_KEY = '_files_staged_for_copy_into_snowflake';
function transformEventToRow(fullEvent) {
    const { event, properties, $set, $set_once, distinct_id, team_id, site_url, now, sent_at, uuid, ...rest } = fullEvent;
    const ip = (properties === null || properties === void 0 ? void 0 : properties['$ip']) || fullEvent.ip;
    const timestamp = fullEvent.timestamp || (properties === null || properties === void 0 ? void 0 : properties.timestamp) || now || sent_at;
    let ingestedProperties = properties;
    let elements = [];
    if (event === '$autocapture' && (properties === null || properties === void 0 ? void 0 : properties['$elements'])) {
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
function generateCsvFileName() {
    const date = new Date().toISOString();
    const [day, time] = date.split('T');
    const dayTime = `${day.split('-').join('')}-${time.split(':').join('')}`;
    const suffix = randomBytes(8).toString('hex');
    return `snowflake-export-${day}-${dayTime}-${suffix}.csv`;
}
function generateCsvString(events) {
    const columns = [
        'uuid',
        'event',
        'properties',
        'elements',
        'people_set',
        'people_set_once',
        'distinct_id',
        'team_id',
        'ip',
        'site_url',
        'timestamp',
    ];
    const csvHeader = columns.join(',');
    const csvRows = [csvHeader];
    for (let i = 0; i < events.length; ++i) {
        const currentEvent = events[i];
        csvRows.push(columns.map((column) => (currentEvent[column] || '').toString()).join(CSV_FIELD_DELIMITER));
    }
    return csvRows.join('\n');
}
class Snowflake {
    constructor({ account, username, password, database, dbschema, table, stage, specifiedRole, warehouse, }) {
        this.pool = this.createConnectionPool(account, username, password, specifiedRole);
        this.s3connector = null;
        this.database = database.toUpperCase();
        this.dbschema = dbschema.toUpperCase();
        this.table = table.toUpperCase();
        this.stage = stage.toUpperCase();
        this.warehouse = warehouse.toUpperCase();
        this.s3Options = null;
        this.gcsOptions = null;
        this.gcsConnector = null;
    }
    async clear() {
        await this.pool.drain();
        await this.pool.clear();
    }
    createS3Connector(awsAccessKeyId, awsSecretAccessKey, awsRegion) {
        if (!awsAccessKeyId || !awsSecretAccessKey || !awsRegion) {
            throw new Error('You must provide an AWS Access Key ID, Secret Access Key, bucket name, and bucket region to use the S3 stage.');
        }
        this.s3connector = new S3({
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
            region: awsRegion,
        });
        this.s3Options = {
            awsAccessKeyId,
            awsSecretAccessKey,
        };
    }
    createGCSConnector(credentials, bucketName, storageIntegrationName) {
        if (!credentials || !storageIntegrationName) {
            throw new Error('You must provide valid credentials and your storage integration name to use the GCS stage.');
        }
        const gcsStorage = new Storage({
            projectId: credentials['project_id'],
            credentials,
            autoRetry: false,
        });
        this.gcsConnector = gcsStorage.bucket(bucketName);
        this.gcsOptions = { storageIntegrationName: storageIntegrationName.toUpperCase() };
    }
    async createTableIfNotExists(columns) {
        await this.execute({
            sqlText: `CREATE TABLE IF NOT EXISTS "${this.database}"."${this.dbschema}"."${this.table}" (${columns})`,
        });
    }
    async dropTableIfExists() {
        await this.execute({
            sqlText: `DROP TABLE IF EXISTS "${this.database}"."${this.dbschema}"."${this.table}"`,
        });
    }
    async createStageIfNotExists(useS3, bucketName) {
        bucketName = bucketName.endsWith('/') ? bucketName : `${bucketName}/`;
        if (useS3) {
            if (!this.s3Options) {
                throw new Error('S3 connector not initialized correctly.');
            }
            await this.execute({
                sqlText: `CREATE STAGE IF NOT EXISTS "${this.database}"."${this.dbschema}"."${this.stage}"
            URL='s3://${bucketName}'
            FILE_FORMAT = ( TYPE = 'CSV' SKIP_HEADER = 1 FIELD_DELIMITER = '${CSV_FIELD_DELIMITER}', ESCAPE = NONE, ESCAPE_UNENCLOSED_FIELD = NONE )
            CREDENTIALS=(aws_key_id='${this.s3Options.awsAccessKeyId}' aws_secret_key='${this.s3Options.awsSecretAccessKey}')
            ENCRYPTION=(type='AWS_SSE_KMS' kms_key_id = 'aws/key')
            COMMENT = 'S3 Stage used by the PostHog Snowflake export plugin';`,
            });
            return;
        }
        if (!this.gcsOptions) {
            throw new Error('GCS connector not initialized correctly.');
        }
        await this.execute({
            sqlText: `CREATE STAGE IF NOT EXISTS "${this.database}"."${this.dbschema}"."${this.stage}"
        URL='gcs://${bucketName}'
        FILE_FORMAT = ( TYPE = 'CSV' SKIP_HEADER = 1 FIELD_DELIMITER = '${CSV_FIELD_DELIMITER}', ESCAPE = NONE, ESCAPE_UNENCLOSED_FIELD = NONE )
        STORAGE_INTEGRATION = ${this.gcsOptions.storageIntegrationName}
        COMMENT = 'GCS Stage used by the PostHog Snowflake export plugin';`,
        });
    }
    async execute({ sqlText, binds }) {
        const snowflake = await this.pool.acquire();
        try {
            return await new Promise((resolve, reject) => snowflake.execute({
                sqlText,
                binds,
                complete: function (err, _stmt, rows) {
                    if (err) {
                        console.error('Error executing Snowflake query: ', { sqlText, error: err.message });
                        reject(err);
                    }
                    else {
                        resolve(rows);
                    }
                },
            }));
        }
        finally {
            await this.pool.release(snowflake);
        }
    }
    createConnectionPool(account, username, password, specifiedRole) {
        const roleConfig = specifiedRole ? { role: specifiedRole } : {};
        return createPool({
            create: async () => {
                const connection = snowflake.createConnection({
                    account,
                    username,
                    password,
                    database: this.database,
                    schema: this.dbschema,
                    ...roleConfig,
                });
                await new Promise((resolve, reject) => connection.connect((err, conn) => {
                    if (err) {
                        console.error('Error connecting to Snowflake: ' + err.message);
                        reject(err);
                    }
                    else {
                        resolve(conn.getId());
                    }
                }));
                return connection;
            },
            destroy: async (connection) => {
                await new Promise((resolve, reject) => connection.destroy(function (err) {
                    if (err) {
                        console.error('Error disconnecting from Snowflake:' + err.message);
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                }));
            },
        }, {
            min: 1,
            max: 1,
            autostart: true,
            fifo: true,
        });
    }
    async appendToFilesList(storage, fileName) {
        const existingFiles = (await storage.get(FILES_STAGED_KEY, []));
        await storage.set(FILES_STAGED_KEY, existingFiles.concat([fileName]));
    }
    async uploadToS3(events, meta) {
        if (!this.s3connector) {
            throw new Error('S3 connector not setup correctly!');
        }
        const { config, global, storage } = meta;
        const csvString = generateCsvString(events);
        const fileName = `${global.parsedBucketPath}${generateCsvFileName()}`;
        const params = {
            Bucket: config.bucketName,
            Key: fileName,
            Body: Buffer.from(csvString, 'utf8'),
        };
        console.log(`Flushing ${events.length} events!`);
        await new Promise((resolve, reject) => {
            this.s3connector.upload(params, async (err, _) => {
                if (err) {
                    console.error(`Error uploading to S3: ${err.message}`);
                    reject();
                }
                console.log(`Uploaded ${events.length} event${events.length === 1 ? '' : 's'} to bucket ${config.bucketName}`);
                resolve();
            });
        });
        await this.appendToFilesList(storage, fileName);
    }
    async uploadToGcs(events, { global, storage }) {
        if (!this.gcsConnector) {
            throw new Error('GCS connector not setup correctly!');
        }
        const csvString = generateCsvString(events);
        const fileName = `${global.parsedBucketPath}${generateCsvFileName()}`;
        const dataStream = new PassThrough();
        const gcFile = this.gcsConnector.file(fileName);
        dataStream.push(csvString);
        dataStream.push(null);
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
        await this.appendToFilesList(storage, fileName);
    }
    async copyIntoTableFromStage(files, purge = false, forceCopy = false, debug = false) {
        if (debug) {
            console.log('Trying to copy events into Snowflake');
        }
        await this.execute({
            sqlText: `USE WAREHOUSE ${this.warehouse};`,
        });
        const querySqlText = `COPY INTO "${this.database}"."${this.dbschema}"."${this.table}"
        FROM @"${this.database}"."${this.dbschema}".${this.stage}
        FILES = ( ${files.map((file) => `'${file}'`).join(',')} )
        ${forceCopy ? `FORCE = true` : ``}
        ON_ERROR = 'skip_file'
        PURGE = ${purge};`;
        await this.execute({
            sqlText: querySqlText,
        });
        console.log('COPY INTO ran successfully');
    }
}
const exportTableColumns = TABLE_SCHEMA.map(({ name, type }) => `"${name.toUpperCase()}" ${type}`).join(', ');
const snowflakePlugin = {
    jobs: {
        retryCopyIntoSnowflake: async (payload, { global, jobs, config }) => {
            if (payload.retriesPerformedSoFar >= 15 || config.retryCopyIntoOperations === 'No') {
                return;
            }
            try {
                await global.snowflake.copyIntoTableFromStage(payload.filesStagedForCopy, global.purgeEventsFromStage, global.forceCopy, global.debug);
            }
            catch (_a) {
                const nextRetrySeconds = 2 ** payload.retriesPerformedSoFar * 3;
                await jobs
                    .retryCopyIntoSnowflake({
                    retriesPerformedSoFar: payload.retriesPerformedSoFar + 1,
                    filesStagedForCopy: payload.filesStagedForCopy,
                })
                    .runIn(nextRetrySeconds, 'seconds');
                console.error(`Failed to copy ${String(payload.filesStagedForCopy)} from object storage into Snowflake. Retrying in ${nextRetrySeconds}s.`);
            }
        },
        copyIntoSnowflakeJob: async (_, meta) => await copyIntoSnowflake(meta)
    },
    async setupPlugin(meta) {
        const { global, config, attachments } = meta;
        const requiredConfigOptions = [
            'account',
            'username',
            'password',
            'dbschema',
            'table',
            'stage',
            'database',
            'bucketName',
            'warehouse',
        ];
        for (const option of requiredConfigOptions) {
            if (!(option in config)) {
                throw new Error(`Required config option ${option} is missing!`);
            }
        }
        const { account, username, password, dbschema, table, stage, database, role, warehouse, copyCadenceMinutes } = config;
        global.snowflake = new Snowflake({
            account,
            username,
            password,
            dbschema,
            table,
            stage,
            database,
            warehouse,
            specifiedRole: role,
        });
        const parsedCopyCadenceMinutes = parseInt(copyCadenceMinutes);
        global.copyCadenceMinutes = parsedCopyCadenceMinutes > 0 ? parsedCopyCadenceMinutes : 10;
        await global.snowflake.createTableIfNotExists(exportTableColumns);
        global.purgeEventsFromStage = config.purgeFromStage === 'Yes';
        global.debug = config.debug === 'ON';
        global.forceCopy = config.forceCopy === 'Yes';
        global.useS3 = config.stageToUse === 'S3';
        if (global.useS3) {
            global.snowflake.createS3Connector(config.awsAccessKeyId, config.awsSecretAccessKey, config.awsRegion);
        }
        else {
            if (!attachments.gcsCredentials) {
                throw new Error('Credentials JSON file not provided!');
            }
            let credentials;
            try {
                credentials = JSON.parse(attachments.gcsCredentials.contents.toString());
            }
            catch (_a) {
                throw new Error('Credentials JSON file has invalid JSON!');
            }
            global.snowflake.createGCSConnector(credentials, config.bucketName, config.storageIntegrationName);
        }
        await global.snowflake.createStageIfNotExists(global.useS3, config.bucketName);
        global.eventsToIgnore = new Set((config.eventsToIgnore || '').split(',').map((event) => event.trim()));
        let bucketPath = config.bucketPath;
        if (bucketPath && !bucketPath.endsWith('/')) {
            bucketPath = `${config.bucketPath}/`;
        }
        if (bucketPath.startsWith('/')) {
            bucketPath = bucketPath.slice(1);
        }
        global.parsedBucketPath = bucketPath;
    },
    async teardownPlugin(meta) {
        const { global } = meta;
        try {
            await copyIntoSnowflake(meta, true);
        }
        catch (_a) { }
        await global.snowflake.clear();
    },
    async exportEvents(events, meta) {
        const { global, config } = meta;
        const rows = events.filter((event) => !global.eventsToIgnore.has(event.event.trim())).map(transformEventToRow);
        if (rows.length) {
            console.info(`Saving batch of ${rows.length} event${rows.length !== 1 ? 's' : ''} to Snowflake stage "${config.stage}"`);
        }
        else {
            console.info(`Skipping an empty batch of events`);
            return;
        }
        try {
            if (global.useS3) {
                console.log('Uploading to S3');
                await global.snowflake.uploadToS3(rows, meta);
            }
            else {
                await global.snowflake.uploadToGcs(rows, meta);
            }
        }
        catch (error) {
            console.error(error.message || String(error));
            throw new RetryError();
        }
    },
    async runEveryMinute(meta) {
        await meta.jobs.copyIntoSnowflakeJob({}).runIn(20, 'seconds');
        await meta.jobs.copyIntoSnowflakeJob({}).runIn(40, 'seconds');
        await copyIntoSnowflake(meta);
    },
};
async function copyIntoSnowflake({ cache, storage, global, jobs, config }, force = false) {
    if (global.debug) {
        console.info('Running copyIntoSnowflake');
    }
    const filesStagedForCopy = (await storage.get(FILES_STAGED_KEY, []));
    if (filesStagedForCopy.length === 0) {
        if (global.debug) {
            console.log('No files stagged skipping');
        }
        return;
    }
    const lastRun = await cache.get('lastRun', null);
    const maxTime = global.copyCadenceMinutes * 60 * 1000;
    const timeNow = new Date().getTime();
    if (!force && lastRun && timeNow - Number(lastRun) < maxTime) {
        if (global.debug) {
            console.log('Skipping COPY INTO', timeNow, lastRun);
        }
        return;
    }
    await cache.set('lastRun', timeNow);
    console.log(`Copying ${String(filesStagedForCopy)} from object storage into Snowflake`);
    const chunkSize = 50;
    for (let i = 0; i < filesStagedForCopy.length; i += chunkSize) {
        const chunkStagedForCopy = filesStagedForCopy.slice(i, i + chunkSize);
        if (i === 0) {
            try {
                await global.snowflake.copyIntoTableFromStage(chunkStagedForCopy, global.purgeEventsFromStage, global.forceCopy, global.debug);
                console.log('COPY INTO ran successfully');
                continue;
            }
            catch (_a) {
                console.error(`Failed to copy ${String(filesStagedForCopy)} from object storage into Snowflake. Retrying in 3s.`);
            }
        }
        await jobs
            .retryCopyIntoSnowflake({ retriesPerformedSoFar: 0, filesStagedForCopy: chunkStagedForCopy })
            .runIn(3, 'seconds');
    }
    await storage.del(FILES_STAGED_KEY);
}

export { snowflakePlugin as default };