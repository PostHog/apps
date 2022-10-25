const base = require("./jest.config.base.cjs")

module.exports = {
    ...base,
    projects: [
        './src/packages/*/jest.config.js'
    ],
}
