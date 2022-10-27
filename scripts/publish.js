import fs from 'fs'
import fetch from 'node-fetch'
import { execSync } from 'child_process'

const packages = fs.readdirSync('./packages', { withFileTypes: true }).filter((dirent) => dirent.isDirectory())

for await (let { name } of packages) {
    const pkg = JSON.parse(fs.readFileSync(`./packages/${name}/package.json`).toString('utf-8'))

    const res = await fetch('https://registry.npmjs.org/' + pkg.name + '/latest')

    const { version } = await res.json()

    if (version === pkg.version) {
        console.log(`Package ${pkg.name} is already published with version ${version}, skipping...`)
        continue
    }

    try {
        execSync('npm publish --access public', { cwd: `./packages/${name}` })
    } catch (error) {
        console.error(`Encountered error while publishing ${name}: ${error}`)
    }
}
