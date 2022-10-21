const { getMeta, createEvent, resetMeta } = require('@posthog/plugin-scaffold/test/utils')
const { onEvent } = require('../index')

global.fetch = jest.fn(async (url) => ({
  json: {},
  status: 200
}))

beforeEach(() => {
  fetch.mockClear()
  resetMeta({
    config: {
      publicKey: 'ENGAGE_PUBLIC_KEY',
      secret: 'ENGAGE_SEECRET'
    },
    global
  })
})

test('onEvent to send the correct data for identify event', async () => {
  const config = {
    publicKey: 'ENGAGE_PUBLIC_KEY',
    secret: 'ENGAGE_SEECRET'
  }
  resetMeta({
    config
  })
  const auth = 'Basic ' + Buffer.from(`${config.publicKey}:${config.secret}`).toString('base64')

  const event = {
    event: '$identify',
    distinct_id: 'user01',
    properties: {
      $set: {
        first_name: 'User',
        crop: 'first'
      }
    }
  }
  expect(fetch).toHaveBeenCalledTimes(0)
  await onEvent(event, getMeta())
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('https://api.engage.so/v1/users/user01', {
    method: 'put',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      first_name: 'User',
      meta: {
        crop: 'first'
      }
    })
  })
})

test('onEvent to send the correct data to track other event', async () => {
  const config = {
    publicKey: 'ENGAGE_PUBLIC_KEY',
    secret: 'ENGAGE_SEECRET'
  }
  resetMeta({
    config
  })
  const auth = 'Basic ' + Buffer.from(`${config.publicKey}:${config.secret}`).toString('base64')

  const event = {
    event: 'newEvent',
    distinct_id: 'user01',
    properties: {
      $set: {
        value: true,
        currency: 'NG'
      }
    }
  }
  expect(fetch).toHaveBeenCalledTimes(0)
  await onEvent(event, getMeta())
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('https://api.engage.so/v1/users/user01/events', {
    method: 'post',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      value: true,
      properties: {
        currency: 'NG'
      },
      event: 'newEvent'
    })
  })
})
