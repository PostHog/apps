import fetch from "node-fetch";
import Zip from "adm-zip";

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
    try {
      const file = await fetch(
        `https://www.github.com/${owner}/${repo}/archive/refs/heads/main.zip`,
        {
          compress: false,
        }
      );

      const body = await file.arrayBuffer();
      const zip = new Zip(Buffer.from(body));

      zip.forEach((entry) => {
        if (!entry.isDirectory) {
          const fileName = entry.entryName;
          const newFileName = fileName.substring(fileName.indexOf("/") + 1);

          console.log(newFileName);

          zip.extractEntryTo(
            entry,
            `./src/packages/${repo}`,
            true,
            true,
            true,
            newFileName
          );
        }
      });

      console.log(`Copied code from ${owner}/${repo}`);
    } catch (error) {
      console.error(error);
    }
  } else {
    console.warn(`Could not parse URL ${app.url}`);
  }
});
