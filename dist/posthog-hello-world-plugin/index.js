async function getRandomNumber() {
    return 4;
}
async function setupPlugin({ config }) {
    console.log(config.greeting);
}
async function processEvent(event, { config, cache }) {
    const counterValue = (await cache.get('greeting_counter', 0));
    cache.set('greeting_counter', counterValue + 1);
    if (!event.properties)
        event.properties = {};
    event.properties['greeting'] = config.greeting;
    event.properties['greeting_counter'] = counterValue;
    event.properties['random_number'] = await getRandomNumber();
    return event;
}
var posthogHelloWorldPlugin = {
    setupPlugin,
    processEvent
};

export { posthogHelloWorldPlugin as default };
