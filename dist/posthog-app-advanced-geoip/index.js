const defaultLocationSetProps = {
    $geoip_city_name: undefined,
    $geoip_country_name: undefined,
    $geoip_country_code: undefined,
    $geoip_continent_name: undefined,
    $geoip_continent_code: undefined,
    $geoip_postal_code: undefined,
    $geoip_latitude: undefined,
    $geoip_longitude: undefined,
    $geoip_time_zone: undefined,
    $geoip_subdivision_1_code: undefined,
    $geoip_subdivision_1_name: undefined,
    $geoip_subdivision_2_code: undefined,
    $geoip_subdivision_2_name: undefined,
    $geoip_subdivision_3_code: undefined,
    $geoip_subdivision_3_name: undefined,
};
const defaultLocationSetOnceProps = {
    $initial_geoip_city_name: undefined,
    $initial_geoip_country_name: undefined,
    $initial_geoip_country_code: undefined,
    $initial_geoip_continent_name: undefined,
    $initial_geoip_continent_code: undefined,
    $initial_geoip_postal_code: undefined,
    $initial_geoip_latitude: undefined,
    $initial_geoip_longitude: undefined,
    $initial_geoip_time_zone: undefined,
    $initial_geoip_subdivision_1_code: undefined,
    $initial_geoip_subdivision_1_name: undefined,
    $initial_geoip_subdivision_2_code: undefined,
    $initial_geoip_subdivision_2_name: undefined,
    $initial_geoip_subdivision_3_code: undefined,
    $initial_geoip_subdivision_3_name: undefined,
};
const GEO_IP_PLUGIN = /^GeoIP \(\d+\)$/;
const plugin = {
    processEvent: async (event, { config }) => {
        var _a, _b, _c, _d, _e, _f;
        const parsedLibs = (_a = config.discardLibs) === null || _a === void 0 ? void 0 : _a.split(',').map((val) => val.toLowerCase().trim());
        console.info(`Begin processing ${event.uuid || event.event}.`);
        if (parsedLibs && ((_b = event.properties) === null || _b === void 0 ? void 0 : _b.$lib) && parsedLibs.includes((_c = event.properties) === null || _c === void 0 ? void 0 : _c.$lib)) {
            // Event comes from a `$lib` that should be ignored
            console.info(`Discarding GeoIP properties from ${event.uuid || event.event} as event comes from ignored $lib: ${(_d = event.properties) === null || _d === void 0 ? void 0 : _d.$lib}.`);
            if (event.$set) {
                event.$set = { ...event.$set, ...defaultLocationSetProps };
            }
            if (event.$set_once) {
                event.$set_once = { ...event.$set_once, ...defaultLocationSetOnceProps };
            }
            event.properties = { ...event.properties, ...defaultLocationSetProps };
        }
        if (config.discardIp === 'true') {
            if (Array.isArray((_e = event.properties) === null || _e === void 0 ? void 0 : _e.$plugins_succeeded) &&
                ((_f = event.properties) === null || _f === void 0 ? void 0 : _f.$plugins_succeeded.find((val) => val.toString().match(GEO_IP_PLUGIN)))) {
                event.properties.$ip = undefined;
                event.ip = null;
                console.info(`IP discarded for event ${event.uuid || event.event}.`);
            }
            else {
                console.warn(`Could not discard IP for event ${event.uuid || event.event} as GeoIP has not been processed.`);
            }
        }
        console.info(`Finished processing ${event.uuid || event.event}.`);
        return event;
    },
};
module.exports = plugin;
