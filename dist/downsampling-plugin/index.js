import { createHash } from 'crypto';

function setupPlugin({ config, global }) {
    const percentage = parseFloat(config.percentage);
    if (isNaN(percentage) || percentage > 100 || percentage < 0) {
        throw new Error('Percentage must be a number between 0 and 100.');
    }
    global.percentage = percentage;
    global.randomSampling = config.samplingMethod === 'Random sampling';
}
function processEvent(event, { global }) {
    let shouldIngestEvent = true;
    if (global.randomSampling) {
        shouldIngestEvent = parseInt(Math.random() * 100) <= global.percentage;
    }
    else {
        const hash = createHash("sha256")
            .update(event.distinct_id)
            .digest("hex");
        const decisionValue = parseInt(hash.substring(0, 15), 16) / 0xfffffffffffffff;
        shouldIngestEvent = decisionValue <= global.percentage / 100;
    }
    if (shouldIngestEvent) {
        return event;
    }
    return null;
}

export { processEvent, setupPlugin };
