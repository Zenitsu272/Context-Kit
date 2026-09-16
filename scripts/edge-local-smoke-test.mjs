import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { runNpm } from "./command-utils.mjs";
import { resolveEdgeExecutable, waitForExtensionId } from "./edge-test-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const profileDir = path.join(repoRoot, ".tmp", "edge-local-smoke-profile");

async function main() {
  await runNpm(["run", "build:edge"], { cwd: repoRoot });
  await fs.mkdir(path.dirname(profileDir), { recursive: true });
  await fs.rm(profileDir, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: await resolveEdgeExecutable(),
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  try {
    const extensionId = await waitForExtensionId(context);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
    await page.waitForLoadState("domcontentloaded");

    const title = await page.title();
    if (title !== "Context Kit") {
      throw new Error(`Unexpected Edge extension page title: ${title}`);
    }

    console.log(`Edge local smoke test passed with extension ${extensionId}.`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
