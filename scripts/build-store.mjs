import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./command-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const env = {
  ...process.env,
  ...(await loadEnvFile(path.join(repoRoot, ".env.store.local"))),
  VITE_ENABLE_CLOUD_SYNC: "false",
  VITE_PUBLISH_SAFE_BUILD: "true",
};

await runNpm(["run", "build"], { env });

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const divider = line.indexOf("=");
          if (divider === -1) {
            return [line, ""];
          }
          const key = line.slice(0, divider).trim();
          const value = line.slice(divider + 1).trim();
          return [key, value];
        }),
    );
  } catch {
    return {};
  }
}
