const splitVersion = (candidate) => {
    const [head, build] = candidate.split('+');
    const [version, ...preRelease] = head.split('-');
    const [major, minor, patch] = version.split('.');
    return {
        major: Number(major),
        minor: Number(minor),
        patch: patch ? Number(patch) : undefined,
        preRelease: preRelease.join('-') || undefined,
        build,
    };
};
function processEvent(event, meta) {
    if (!event.properties) {
        return;
    }
    const targetProperties = meta.config.properties.split(',').map((s) => s.trim());
    for (const target of targetProperties) {
        const candidate = event.properties[target];
        console.log('found candidate property: ', target, ' matches ', candidate);
        if (candidate) {
            const { major, minor, patch, preRelease, build } = splitVersion(candidate);
            event.properties[`${target}__major`] = major;
            event.properties[`${target}__minor`] = minor;
            if (patch !== undefined) {
                event.properties[`${target}__patch`] = patch;
            }
            if (preRelease !== undefined) {
                event.properties[`${target}__preRelease`] = preRelease;
            }
            if (build !== undefined) {
                event.properties[`${target}__build`] = build;
            }
        }
    }
    return event;
}

export { processEvent, splitVersion };
