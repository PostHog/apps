const ONE_DAY = 60 * 60 * 24;
const defaultLocationSetProps = {
    $geoip_city_name: null,
    $geoip_country_name: null,
    $geoip_country_code: null,
    $geoip_continent_name: null,
    $geoip_continent_code: null,
    $geoip_postal_code: null,
    $geoip_latitude: null,
    $geoip_longitude: null,
    $geoip_time_zone: null,
};
const defaultLocationSetOnceProps = {
    $initial_geoip_city_name: null,
    $initial_geoip_country_name: null,
    $initial_geoip_country_code: null,
    $initial_geoip_continent_name: null,
    $initial_geoip_continent_code: null,
    $initial_geoip_postal_code: null,
    $initial_geoip_latitude: null,
    $initial_geoip_longitude: null,
    $initial_geoip_time_zone: null,
};
const plugin = {
    processEvent: async (event, { geoip, cache }) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if (!geoip) {
            throw new Error('This PostHog version does not have GeoIP capabilities! Upgrade to PostHog 1.24.0 or later');
        }
        let ip = ((_a = event.properties) === null || _a === void 0 ? void 0 : _a.$ip) || event.ip;
        if (ip && !((_b = event.properties) === null || _b === void 0 ? void 0 : _b.$geoip_disable)) {
            ip = String(ip);
            if (ip === '127.0.0.1') {
                ip = '13.106.122.3';
            }
            const response = await geoip.locate(ip);
            if (response) {
                const location = {};
                if (response.city) {
                    location['city_name'] = (_c = response.city.names) === null || _c === void 0 ? void 0 : _c.en;
                }
                if (response.country) {
                    location['country_name'] = (_d = response.country.names) === null || _d === void 0 ? void 0 : _d.en;
                    location['country_code'] = response.country.isoCode;
                }
                if (response.continent) {
                    location['continent_name'] = (_e = response.continent.names) === null || _e === void 0 ? void 0 : _e.en;
                    location['continent_code'] = response.continent.code;
                }
                if (response.postal) {
                    location['postal_code'] = response.postal.code;
                }
                if (response.location) {
                    location['latitude'] = (_f = response.location) === null || _f === void 0 ? void 0 : _f.latitude;
                    location['longitude'] = (_g = response.location) === null || _g === void 0 ? void 0 : _g.longitude;
                    location['time_zone'] = (_h = response.location) === null || _h === void 0 ? void 0 : _h.timeZone;
                }
                if (response.subdivisions) {
                    for (const [index, subdivision] of response.subdivisions.entries()) {
                        location[`subdivision_${index + 1}_code`] = subdivision.isoCode;
                        location[`subdivision_${index + 1}_name`] = (_j = subdivision.names) === null || _j === void 0 ? void 0 : _j.en;
                    }
                }
                if (!event.properties) {
                    event.properties = {};
                }
                let setPersonProps = true;
                const lastIpSetEntry = await cache.get(event.distinct_id, null);
                if (typeof lastIpSetEntry === 'string') {
                    const [lastIpSet, timestamp] = lastIpSetEntry.split('|');
                    const isEventSettingPropertiesLate = event.timestamp && timestamp && new Date(event.timestamp) < new Date(timestamp);
                    if (lastIpSet === ip || isEventSettingPropertiesLate) {
                        setPersonProps = false;
                    }
                }
                if (setPersonProps) {
                    event.$set = { ...defaultLocationSetProps, ...((_k = event.$set) !== null && _k !== void 0 ? _k : {}) };
                    event.$set_once = {
                        ...defaultLocationSetOnceProps,
                        ...((_l = event.$set_once) !== null && _l !== void 0 ? _l : {}),
                    };
                }
                for (const [key, value] of Object.entries(location)) {
                    event.properties[`$geoip_${key}`] = value;
                    if (setPersonProps) {
                        event.$set[`$geoip_${key}`] = value;
                        event.$set_once[`$initial_geoip_${key}`] = value;
                    }
                }
                if (setPersonProps) {
                    await cache.set(event.distinct_id, `${ip}|${event.timestamp || ''}`, ONE_DAY);
                }
            }
        }
        return event;
    },
};
module.exports = plugin;
