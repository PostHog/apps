# PostHog Plugin: SemVer Flattener

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg?style=flat-square)](https://opensource.org/licenses/MIT)

It is common to want to compare versions when filtering in insights.

> Show me events where `app_version < 22.7`

It isn't possible to (correctly) use string comparison for this because then several comparisons don't work. Amusingly `apples < banana` but `apples > BANANA`. Importantly `22.7` is less than `22.7-beta` which would be wrong.

This plugin splits a valid SemVer version string into 

```
export interface VersionParts {
    major: number
    minor: number
    patch?: number
    preRelease?: string
    build?: string
}
```

And flattens them onto an event. 

So this...

```
{
    properties: {
        app_version: '22.7.11'
    }
}
```

becomes...

```
{
    properties: {
        app_version: '22.7.11'
        app_version__major: 22,
        app_version__minor: 7,
        app_version__patch: 11
    }
}
```


## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)

We're here to help you with anything PostHog!

### logo taken from 

https://publicdomainvectors.org/en/free-clipart/Decimal-separator-to-the-left/88496.html
