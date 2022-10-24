// rollup.config.js

import fs from 'fs'

import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import copy from 'rollup-plugin-copy'

const packages = fs.readdirSync('./src/packages', { withFileTypes: true }).filter((dirent) => dirent.isDirectory())

export default packages.map(({ name }) => {
    /*const plugin = JSON.parse(
    fs.readFileSync(`./src/packages/${name}/plugin.json`).toString("utf-8")
  );*/

    const srcExists = fs.existsSync(`./src/packages/${name}/src`)
    const isTypescript = fs.existsSync(
        srcExists ? `./src/packages/${name}/src/index.ts` : `./src/packages/${name}/index.ts`
    )

    return {
        input: [`./src/packages/${name}/${srcExists ? 'src/' : ''}${isTypescript ? 'index.ts' : 'index.js'}`],
        output: {
            file: `./dist/${name}/index.js`,
            format: 'es',
        },
        // https://posthog.com/docs/apps/build/reference#available-imports
        external: [
            'crypto',
            'url',
            'zlib',
            'generic-pool',
            'pg',
            'snowflake-sdk',
            'aws-sdk',
            '@google-cloud/bigquery',
            '@google-cloud/storage',
            '@google-cloud/pubsub',
            'node-fetch',
            '@posthog/plugin-scaffold',
            '@posthog/plugin-contrib',
        ],
        plugins: [
            commonjs(),
            resolve({
                modulePaths: [`./src/packages/${name}`],
            }),
            typescript({
                tsconfig: './tsconfig.json',
                compilerOptions: {
                    baseUrl: `./src/packages/${name}`,
                },
                include: [`./src/packages/${name}/**/*.js`, `./src/packages/${name}/**/*.ts`],
                exclude: [`node_modules/`, '*.test*', '**/*.test*', 'dist/', '*.config*'],
                outputToFilesystem: false,
            }),
            copy({
                targets: [
                    { src: `./src/packages/${name}/plugin.json`, dest: `./dist/${name}` },
                    {
                        src: `./src/packages/${name}/package.json`,
                        dest: `./dist/${name}`,
                    },
                    {
                        src: `./src/packages/${name}/README.md`,
                        dest: `./dist/${name}`,
                    },
                    {
                        src: `./LICENSE`,
                        dest: `./dist/${name}`,
                    },
                ],
            }),
        ],
    }
})
