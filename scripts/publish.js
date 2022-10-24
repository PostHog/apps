import fs from 'fs'

import npm from 'npm'

const packages = fs.readdirSync('./dist/packages', { withFileTypes: true }).filter((dirent) => dirent.isDirectory())

for await (let { name } of packages) {
    try {
        await new Promise((resolve, reject) => {
            npm.commands.publish([`./dist/${name}`, '--access public', '--dry-run'], (err, result) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(result)
                }
            })
        })
    } catch (error) {
        console.error(`Encountered error while publishing ${name}: ${error}`)
    }
}
