import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./command-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(repoRoot, "dist", "manifest.json");

async function main() {
  await runNpm(["run", "build:edge"], { cwd: repoRoot });

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const hostPermissions = new Set(manifest.host_permissions ?? []);
  const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
  if (manifest.version !== packageJson.version) throw new Error("Manifest/package versions differ.");
  if (hostPermissions.has("<all_urls>") || hostPermissions.has("https://*/*")) throw new Error("Broad HTTPS access must remain optional.");
  if (!(manifest.optional_host_permissions ?? []).includes("https://*/*")) throw new Error("Missing optional per-origin attachment/API permission.");
  for (const resource of ["pdf-resources/cmaps/Adobe-Japan1-UCS2.bcmap", "pdf-resources/standard_fonts/LiberationSans-Regular.ttf"]) await fs.access(path.join(repoRoot, "dist", resource));
  for (const file of await fs.readdir(path.join(repoRoot, "dist", "assets"))) {
    if (!file.endsWith(".js")) continue;
    const content = await fs.readFile(path.join(repoRoot, "dist", "assets", file), "utf8");
    if (/AIza[A-Za-z0-9_-]{30,}/.test(content)) throw new Error("A Google API key-like value was found in the shared build.");
  }

  const forbidden = ["http://127.0.0.1/*", "http://localhost/*"].filter((item) => hostPermissions.has(item));
  if (forbidden.length) {
    throw new Error(`Edge Add-ons build still contains localhost host permissions: ${forbidden.join(", ")}`);
  }

  const required = [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://aistudio.google.com/*",
  ].filter((item) => !hostPermissions.has(item));
  if (required.length) {
    throw new Error(`Edge Add-ons build is missing expected supported-site permissions: ${required.join(", ")}`);
  }

  console.log("Edge Add-ons build verification passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
