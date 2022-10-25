function normalizeUrl(url) {
    try {
        const parsedUrl = new URL(url.toLocaleLowerCase());
        parsedUrl.pathname = parsedUrl.pathname.replace(/\/$/, "");
        return parsedUrl.toString();
    }
    catch (err) {
        throw `Unable to normalize invalid URL: "${url}"`;
    }
}
function processEvent(event, meta) {
    const $current_url = event?.properties?.$current_url;
    if (event?.properties && $current_url) {
        const normalized_url = normalizeUrl($current_url);
        event.properties.$current_url = normalized_url;
        console.debug(`event.$current_url: "${$current_url}" normalized to "${normalized_url}"`);
    }
    return event;
}

export { processEvent };
