import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const releaseDir = path.join(repoRoot, "release", "store-assets");
const profileDir = path.join(repoRoot, ".tmp", "store-assets-profile");

async function main() {
  await runCommand("npm", ["run", "build:store"]);
  await fs.mkdir(releaseDir, { recursive: true });
  await fs.rm(profileDir, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: await resolveChromeExecutable(),
    headless: false,
    viewport: { width: 1440, height: 1400 },
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
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await page.screenshot({ path: path.join(releaseDir, "01-home.png"), fullPage: true });

    await page.getByText("Create Manual Context", { exact: true }).click();
    await page.locator("input").first().fill("Launch Ready Project Handoff");
    await page.locator("textarea").first().fill("A polished reusable package for Chrome Web Store launch preparation.");
    await page.locator("textarea").nth(5).fill(
      [
        "USER: We need a publish-safe build before store review.",
        "ASSISTANT: Disable local-dev cloud sync in the store package and keep the capture flow local-first.",
        "USER: Also prepare screenshots, listing copy, and policy docs.",
      ].join("\n\n"),
    );
    await page.screenshot({ path: path.join(releaseDir, "02-create-package.png"), fullPage: true });

    await page.getByText("Auto-Structure", { exact: true }).click();
    await page.getByText("Save Context Package", { exact: true }).click();
    await page.locator("h2").filter({ hasText: "Launch Ready Project Handoff" }).first().waitFor({
      state: "visible",
      timeout: 15000,
    });
    await page.locator("select").nth(1).selectOption("handoff");
    await page.locator("input[placeholder*='Focus on']").fill("publish-safe build and screenshots");
    await page.screenshot({ path: path.join(releaseDir, "03-detail-and-insert.png"), fullPage: true });

    await page.getByText("Back", { exact: true }).click();
    await page.getByLabel("Search", { exact: true }).fill("publish-safe build");
    await page.screenshot({ path: path.join(releaseDir, "04-library-search.png"), fullPage: true });

    console.log(`Store assets captured in ${releaseDir}`);
  } finally {
    await context.close();
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        VITE_ENABLE_CLOUD_SYNC: "false",
        VITE_PUBLISH_SAFE_BUILD: "true",
      },
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

async function waitForExtensionId(context) {
  const timeoutAt = Date.now() + 20000;

  while (Date.now() < timeoutAt) {
    for (const worker of context.serviceWorkers()) {
      const match = worker.url().match(/^chrome-extension:\/\/([a-z]{32})\//);
      if (match) {
        return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Context Kit service worker did not appear in Chrome.");
}

async function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Chrome executable not found. Set CHROME_PATH or install Google Chrome.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
