const { pathsToModuleNameMapper } = require('ts-jest')
const { compilerOptions } = require('./tsconfig.json')

let moduleNameMapper = undefined
if (compilerOptions && compilerOptions.paths) {
    moduleNameMapper = pathsToModuleNameMapper(compilerOptions.paths, { prefix: 'src/' })
}

module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper,
}
