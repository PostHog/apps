function processEvent(event) {
    if (event.properties && event.properties['$time'] && !isNaN(event.properties['$time'])) {
        const timestamp = event.properties['$time'] * 1000;
        const eventDate = new Date(timestamp);
        event.properties['day_of_the_week'] = eventDate.toLocaleDateString('en-GB', { weekday: 'long' });
        const date = eventDate.toLocaleDateString('en-GB').split('/');
        event.properties['day'] = Number(date[0]);
        event.properties['month'] = Number(date[1]);
        event.properties['year'] = Number(date[2]);
        event.properties['hour'] = eventDate.getHours();
        event.properties['minute'] = eventDate.getMinutes();
    }
    return event;
}
var timestampParserPlugin = {
    processEvent
};

export { timestampParserPlugin as default };
