import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

export const size = { width: 1920, height: 1080 };
export const outputDir = resolve(process.env.OUT_DIR || fileURLToPath(new URL("./out/", import.meta.url)));
export const contextOptions = { viewport: size, deviceScaleFactor: 1, colorScheme: "dark" };

export async function launchChromium() {
  const { chromium } = await loadPlaywright();
  return chromium.launch({
    headless: true,
    timeout: 20_000,
    args: process.env.VIDEO_SINGLE_PROCESS === "1" ? ["--single-process", "--disable-gpu"] : [],
  });
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  }

  const cache = join(process.env.npm_config_cache || join(homedir(), ".npm"), "_npx");
  if (existsSync(cache)) {
    for (const entry of await readdir(cache)) {
      const manifest = join(cache, entry, "node_modules", "playwright", "package.json");
      if (!existsSync(manifest)) continue;
      const { version, module } = JSON.parse(await readFile(manifest, "utf8"));
      if (version.startsWith("1.65.")) {
        return import(pathToFileURL(resolve(manifest, "..", module || "index.mjs")).href);
      }
    }
  }

  throw new Error("Playwright 1.65 is unavailable. Run npm install --prefix scripts/video, then npx --prefix scripts/video playwright install chromium.");
}
