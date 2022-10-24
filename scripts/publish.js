import fs from 'fs'
import { execSync } from 'child_process'

const packages = fs.readdirSync('./dist', { withFileTypes: true }).filter((dirent) => dirent.isDirectory())

for (let { name } of packages) {
    try {
        execSync('npm publish --access public --dry-run', { cwd: `./dist/${name}` })
    } catch (error) {
        console.error(`Encountered error while publishing ${name}: ${error}`)
    }
}
