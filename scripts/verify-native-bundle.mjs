import { access, readFile } from "node:fs/promises";
import path from "node:path";

const targets = [
  {
    name: "Android",
    index: "android/app/src/main/assets/public/index.html",
    config: "android/app/src/main/assets/capacitor.config.json",
  },
  {
    name: "iOS",
    index: "ios/App/App/public/index.html",
    config: "ios/App/App/capacitor.config.json",
  },
];

for (const target of targets) {
  await access(path.resolve(target.index));
  const rawConfig = await readFile(path.resolve(target.config), "utf8");
  const config = JSON.parse(rawConfig);

  if (config.server?.url) {
    throw new Error(
      `${target.name} is configured to load ${config.server.url} instead of the bundled app. Remove server.url before release.`,
    );
  }

  if (config.webDir !== "dist") {
    throw new Error(`${target.name} must use webDir "dist" for offline cold starts.`);
  }
}

console.log("Native bundle verified: Android and iOS will boot from packaged web assets.");