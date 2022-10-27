import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import replace from '@rollup/plugin-replace'
import { name, version } from './package.json'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const replacePlugin = replace({
  preventAssignment: true,
  values: { NAME: JSON.stringify(name), VERSION: JSON.stringify(version) },
})

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: ['src/index.ts'],
  output: {
    dir: 'dist',
    format: 'es',
  },
  plugins: [
    replacePlugin,
    nodeResolve(),
    commonjs(),
    typescript({
      outDir: 'dist/',
    }),
  ],
}

export default config
