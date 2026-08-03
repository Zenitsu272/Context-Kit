import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(repoRoot, "dist", "manifest.json");

async function main() {
  await runCommand("npm", ["run", "build:edge"]);

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const hostPermissions = new Set(manifest.host_permissions ?? []);

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

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
    child.on("error", reject);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
