import { access, readFile, readdir } from "node:fs/promises";
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
  const indexHtml = await readFile(path.resolve(target.index), "utf8");
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

  const absoluteRemoteEntry = /<script[^>]+type=["']module["'][^>]+src=["']https?:\/\//i.test(indexHtml)
    || /<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:\/\//i.test(indexHtml);
  if (absoluteRemoteEntry) {
    throw new Error(`${target.name} index.html references a remote entry file and cannot cold-start offline.`);
  }

  const publicDir = path.dirname(path.resolve(target.index));
  const entries = await readdir(publicDir);
  if (!entries.includes("assets")) {
    throw new Error(`${target.name} native bundle is missing its local assets directory.`);
  }
}

console.log("Native bundle verified: Android and iOS will boot from packaged web assets.");