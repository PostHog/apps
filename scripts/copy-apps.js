import fetch from "node-fetch";
import Zip from "adm-zip";
import zlib from "zlib";
import { writeFileSync } from "fs";

const res = await fetch(
  "https://raw.githubusercontent.com/PostHog/integrations-repository/main/plugins.json"
);

const apps = await res.json();

apps.forEach(async (app) => {
  const [_, owner, repo] =
    app.url.match(
      /^https:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)/
    ) || [];

  if (owner && repo) {
    /*console.log(
      `https://www.github.com/${owner}/${repo}/archive/refs/heads/main.zip`
    );*/
    try {
      const file = await fetch(
        `https://www.github.com/${owner}/${repo}/archive/refs/heads/main.zip`,
        {
          compress: false,
        }
      );

      const body = await file.arrayBuffer();

      // writeFileSync(repo + ".zip", Buffer(body));

      const zip = new Zip(Buffer.from(body));
      /*zip.forEach((entry) => {
        console.log(entry.name);
      });*/
      zip.forEach((entry) => {
        zip.extractEntryTo(entry, `./src/packages/${repo}`, false, true);
      });
      // console.log(zip.toBuffer().length);
      console.log(`${owner}/${repo}`);
    } catch (error) {
      console.error(error);
    }
  } else {
    console.warn(`Could not parse URL ${app.url}`);
  }
});
