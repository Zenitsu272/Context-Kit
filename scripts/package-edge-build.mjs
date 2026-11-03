import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm, runCommand } from "./command-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const releaseDir = path.join(repoRoot, "release");
const packageJsonPath = path.join(repoRoot, "package.json");

async function main() {
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const zipName = `context-kit-edge-addons-${packageJson.version}.zip`;
  const zipPath = path.join(releaseDir, zipName);

  await runNpm(["run", "build:edge"], { cwd: repoRoot });
  await fs.mkdir(releaseDir, { recursive: true });
  await fs.rm(zipPath, { force: true });

  await runCommand("powershell", [
    "-NoProfile",
    "-Command",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${distDir.replace(/'/g, "''")}', '${zipPath.replace(/'/g, "''")}')`,
  ], { cwd: repoRoot });

  console.log(`Packaged Edge Add-ons build: ${zipPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
