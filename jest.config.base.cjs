module.exports = {
    testEnvironment: 'node',
    preset: "ts-jest",

    transform: {
        "\\.jsx?$": 'babel-jest',
        "\\.tsx?$": 'ts-jest',
    },
}
