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
            sourcemap: false,
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
            isTypescript
                ? typescript({
                      tsconfig: `./src/packages/${name}/tsconfig.json`,
                      include: [`**/*.js`, `**/*.ts`],
                      exclude: ['**/*.config*', `node_modules/`, '*.test*', '**/*.test*', 'dist/', '**/__tests__/'],
                      outputToFilesystem: false,
                  })
                : undefined,
            copy({
                targets: [
                    {
                        src: [
                            `./src/packages/${name}/plugin.json`,
                            `./src/packages/${name}/README.md`,
                            `./src/packages/${name}/package.json`,
                            `./LICENSE`,
                        ],
                        dest: `./dist/${name}`,
                    },
                ],
            }),
        ],
    }
})
