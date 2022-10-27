const { createEvent } = require('@posthog/plugin-scaffold/test/utils.js')
const { setupPlugin, add } = require('../index')

test('test setting negative value for timeout in Twilio', async () => {
    await expect(
        setupPlugin({
            config: {
                accountSID: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                authToken: 'your_auth_token',
                senderPhoneNumber: '+15555555555',
                triggeringEventsAndNumber: 'event1:+15555555555,event2:+15555555555',
                timeout: -1,
            },
            global: {},
        })
    ).rejects.toThrowError('timeout is not supported')
})

test('test setting greater value for timeout in Twilio', async () => {
    await expect(
        setupPlugin({
            config: {
                accountSID: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                authToken: 'your_auth_token',
                senderPhoneNumber: '+15555555555',
                triggeringEventsAndNumber: 'event1:+15555555555,event2:+15555555555',
                timeout: 366 * 60 * 60 * 24 + 1,
            },
            global: {},
        })
    ).rejects.toThrowError('timeout is not supported')
})
