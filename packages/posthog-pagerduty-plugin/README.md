# PostHog PagerDuty plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg?style=flat-square)](https://opensource.org/licenses/MIT)

This plugin alerts PagerDuty when a PostHog insights/trends graph goes below or above a threshold.

Example use cases:
- alert when there is no $pageviews captured on my site the past hour,
- alert when the rate of $billing_error events crosses a threshold.

## Configuring

1. Get the trends URL.
  - Go to insights
  - Construct the graph you want to alert on
  - Copy URL
2. Choose threshold and operator (less than or equal, greater than or equal)
3. Enter PagerDuty service integration key (for Events API v2)

## Limitations

- Only works on single-line trend graphs
- Requires PostHog 1.26.0 or Cloud

## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)

We're here to help you with anything PostHog!
