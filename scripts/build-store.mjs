import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const env = {
  ...process.env,
  ...(await loadEnvFile(path.join(repoRoot, ".env.store.local"))),
  VITE_ENABLE_CLOUD_SYNC: "false",
  VITE_PUBLISH_SAFE_BUILD: "true",
};

await runCommand("npm", ["run", "build"], env);

function runCommand(command, args, envVars) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: envVars,
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
