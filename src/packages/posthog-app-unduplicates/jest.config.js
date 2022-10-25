const config = require('../../../jest.config.base.cjs')

module.exports = {
    ...config,
    setupFilesAfterEnv: ['given2/setup'],
}
