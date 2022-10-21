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
    var _a;
    const $current_url = (_a = event === null || event === void 0 ? void 0 : event.properties) === null || _a === void 0 ? void 0 : _a.$current_url;
    if ((event === null || event === void 0 ? void 0 : event.properties) && $current_url) {
        const normalized_url = normalizeUrl($current_url);
        event.properties.$current_url = normalized_url;
        console.debug(`event.$current_url: "${$current_url}" normalized to "${normalized_url}"`);
    }
    return event;
}

export { processEvent };
