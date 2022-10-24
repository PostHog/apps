import { Kinesis } from 'aws-sdk';

const REDIS_KINESIS_STREAM_KEY = '_kinesis_shard_';
async function setupPlugin({ config, global }) {
    global.kinesis = new Kinesis({
        accessKeyId: config.iamAccessKeyId,
        secretAccessKey: config.iamSecretAccessKey,
        region: config.awsRegion,
    });
}
const jobs = {
    processShard,
};
async function runEveryMinute(meta) {
    readKinesisStream(meta);
}
function readKinesisStream(meta) {
    const { global, config } = meta;
    // we keep track of the starting time of the process, to only poll kinesis for one minute before restarting
    const startedAt = new Date().getTime();
    global.kinesis.describeStream({
        StreamName: config.kinesisStreamName,
    }, function (err, streamData) {
        if (err) {
            console.error(err, err.stack);
        }
        else {
            // kinesis streams are composed of shards, we need to process each shard independently
            streamData.StreamDescription.Shards.forEach((shard) => meta.jobs.processShard({ shard, startedAt }));
        }
    });
}
// we need to iterate through the sequences inside of a shard, to do that we required a shard iterator
// the `LATEST` property tells Kinesis to give us sequences starting from now, discarding historic data
function getShardIterator(kinesis, streamName, shardId, callback) {
    kinesis.getShardIterator({
        ShardId: shardId,
        ShardIteratorType: 'LATEST',
        StreamName: streamName,
    }, function (err, shardIteratordata) {
        if (err) {
            console.error(err, err.stack);
            return;
        }
        const { ShardIterator } = shardIteratordata;
        if (ShardIterator) {
            callback(ShardIterator);
        }
        else {
            console.error('ShardIterator is not defined');
        }
    });
}
// we check if we already have a shardIterator in cache, otherwise we get one and use it to get records at a specific sequence
async function processShard({ shard, startedAt }, { config, global, cache }) {
    const shardId = shard.ShardId;
    const cacheKey = `${REDIS_KINESIS_STREAM_KEY}${config.kinesisStreamName}_${shard.ShardId}`;
    const nextShardIterator = (await cache.get(cacheKey, null));
    if (nextShardIterator) {
        getRecords(global.kinesis, cache, cacheKey, shardId, nextShardIterator, startedAt, config);
    }
    else {
        getShardIterator(global.kinesis, config.kinesisStreamName, shardId, (iterator) => {
            getRecords(global.kinesis, cache, cacheKey, shardId, iterator, startedAt, config);
        });
    }
}
function getRecords(kinesis, cache, cacheKey, shardId, shardIterator, startedAt, config) {
    kinesis.getRecords({
        ShardIterator: shardIterator,
    }, function (err, recordsData) {
        if (err) {
            // shardIterators can expire, in this case we need to fetch a new one, before running again the getRecords function
            if (err.name === 'ExpiredIteratorException') {
                getShardIterator(kinesis, config.kinesisStreamName, shardId, (iterator) => {
                    getRecords(kinesis, cache, cacheKey, shardId, iterator, startedAt, config);
                });
            }
            else {
                console.error(err, err.stack);
            }
        }
        else {
            // if there are Records at the current sequence, we process them, and if successful, use posthog-js to capture them as events
            if (recordsData.Records.length > 0) {
                recordsData.Records.forEach(function (record) {
                    // we read the record buffer and parse a JSON
                    const payload = decodeBuffer(record.Data);
                    if (!payload) {
                        return;
                    }
                    const posthogEvent = transformKinesisRecordToPosthogEvent(payload, config.eventKey, config.additionalPropertyMappings);
                    if (posthogEvent) {
                        console.log(`Event captured from Kinesis stream: ${JSON.stringify(posthogEvent)}`);
                        posthog.capture(posthogEvent.event, posthogEvent.properties);
                    }
                });
            }
            // Kinesis gives us a nextShardIterator, which we keep in cache
            if (recordsData.NextShardIterator) {
                cache.set(cacheKey, recordsData.NextShardIterator);
                cache.expire(cacheKey, 120);
                // we iterate only for max one minute
                if (!hasOneMinutePassed(startedAt)) {
                    getRecords(kinesis, cache, cacheKey, shardId, recordsData.NextShardIterator, startedAt, config);
                }
            }
        }
    });
}
function transformKinesisRecordToPosthogEvent(payload, eventKey, additionalPropertyMappings) {
    try {
        const event = getDeepValue(payload, eventKey.split('.'));
        if (!event) {
            console.error(`Cannot find key ${eventKey} in object ${payload}`);
            return null;
        }
        const properties = {};
        const additionalMappings = additionalPropertyMappings.split(',');
        additionalMappings.forEach((mapping) => {
            const [key, mappedKey] = mapping.split(':');
            const value = getDeepValue(payload, key.split('.'));
            if (!value) {
                console.error(`Property ${key} does not exist, skipping`);
            }
            else if (typeof value !== 'string') {
                console.error(`Property ${key} does not contain a string value, skipping`);
            }
            else {
                properties[mappedKey] = value;
            }
        });
        return { event, properties };
    }
    catch (e) {
        console.error(e);
        return null;
    }
}
function decodeBuffer(data) {
    try {
        //@ts-expect-error Kinesis Record is Uint8Array but it's not correctly typed
        const payload = Buffer.from(data).toString();
        return JSON.parse(payload);
    }
    catch (e) {
        console.error(`Failed decoding Buffer, skipping record: ${e.message || String(e)}`);
        return null;
    }
}
function getDeepValue(payload, args) {
    let obj = Object.assign(payload);
    for (let i = 0; i < args.length; i++) {
        if (!obj || !obj.hasOwnProperty(args[i])) {
            return null;
        }
        obj = obj[args[i]];
    }
    return obj;
}
function hasOneMinutePassed(startedAt) {
    return new Date().getTime() - startedAt > 1000 * 60;
}

export { jobs, runEveryMinute, setupPlugin, transformKinesisRecordToPosthogEvent };
