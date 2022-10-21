// rollup.config.js

import fs from "fs";
import path from "path";

import manifest from "./manifest.json";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

// const packages = glob.sync("./src/packages/*", )

const packages = fs
  .readdirSync("./src/packages", { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory());

export default packages.map(({ name }) => {
  console.log(name);
  /*const plugin = JSON.parse(
    fs.readFileSync(`./src/packages/${name}/plugin.json`).toString("utf-8")
  );*/
  const srcExists = fs.existsSync(`./src/packages/${name}/src`);
  const isTypescript = fs.existsSync(
    srcExists
      ? `./src/packages/${name}/src/index.ts`
      : `./src/packages/${name}/index.ts`
  );

  return {
    input: [
      `./src/packages/${name}/${srcExists ? "src/" : ""}${
        isTypescript ? "index.ts" : "index.js"
      }`,
    ],
    output: {
      file: `./dist/${name}/index.js`,
      format: "es",
    },
    // https://posthog.com/docs/apps/build/reference#available-imports
    external: [
      "crypto",
      "url",
      "zlib",
      "generic-pool",
      "pg",
      "snowflake-sdk",
      "aws-sdk",
      "@google-cloud/bigquery",
      "@google-cloud/storage",
      "@google-cloud/pubsub",
      "node-fetch",
      "@posthog/plugin-scaffold",
      "@posthog/plugin-contrib",
    ],
    plugins: [
      commonjs(),
      resolve({
        modulePaths: [`./src/packages/${name}`],
      }),
      typescript({
        // exclude: ["*.test*", "**/*.test*"],
        tsconfig: path.join(__dirname, "tsconfig.json"),
        compilerOptions: {
          baseUrl: `./src/packages/${name}`,
        },
        include: [`./src/packages/${name}/**`],
        exclude: [`node_modules`, "*.test*", "**/*.test", "dist", "*.config*"],
      }),
    ],
  };
});
