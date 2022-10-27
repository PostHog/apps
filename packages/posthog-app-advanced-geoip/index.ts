import { Plugin } from '@posthog/plugin-scaffold'

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
}

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
}

export interface AppInterface {
    config: {
        discardIp: 'true' | 'false'
        discardLibs: string
    }
}

const GEO_IP_PLUGIN = /^GeoIP \(\d+\)$/

const plugin: Plugin<AppInterface> = {
    processEvent: async (event, { config }) => {
        const parsedLibs = config.discardLibs?.split(',').map((val) => val.toLowerCase().trim())
        console.info(`Begin processing ${event.uuid || event.event}.`)

        if (parsedLibs && event.properties?.$lib && parsedLibs.includes(event.properties?.$lib)) {
            // Event comes from a `$lib` that should be ignored
            console.info(
                `Discarding GeoIP properties from ${event.uuid || event.event} as event comes from ignored $lib: ${
                    event.properties?.$lib
                }.`
            )
            if (event.$set) {
                event.$set = { ...event.$set, ...defaultLocationSetProps }
            }
            if (event.$set_once) {
                event.$set_once = { ...event.$set_once, ...defaultLocationSetOnceProps }
            }
            event.properties = { ...event.properties, ...defaultLocationSetProps }
        }

        if (config.discardIp === 'true') {
            if (
                Array.isArray(event.properties?.$plugins_succeeded) &&
                event.properties?.$plugins_succeeded.find((val: string) => val.toString().match(GEO_IP_PLUGIN))
            ) {
                event.properties.$ip = undefined
                event.ip = null
                console.info(`IP discarded for event ${event.uuid || event.event}.`)
            } else {
                console.warn(
                    `Could not discard IP for event ${event.uuid || event.event} as GeoIP has not been processed.`
                )
            }
        }

        console.info(`Finished processing ${event.uuid || event.event}.`)

        return event
    },
}

module.exports = plugin
