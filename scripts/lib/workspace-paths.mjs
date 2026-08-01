import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const bandWebsiteRoot = path.resolve(here, "..", "..");
export const bandsofAHSRoot = path.resolve(
  process.env.BANDSOFAHS_DIR || process.env.BDOS_DIR || path.join(bandWebsiteRoot, "..", "BandsofAHS")
);
export const bandsofAHSDataDir = path.join(bandsofAHSRoot, "data");
export const bandWebsiteEnvPath = path.resolve(
  process.env.BAND_WEBSITE_ENV || path.join(bandWebsiteRoot, ".env.local")
);

export function loadBandWebsiteEnv() {
  try {
    for (const line of readFileSync(bandWebsiteEnvPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // Commands that only inspect local files do not require hosted credentials.
  }
}
