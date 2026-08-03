import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const tmpDir = path.join(repoRoot, ".tmp");
const profileDir = path.join(tmpDir, "phase2-smoke-profile");
const backendDir = path.join(repoRoot, "backend");
const backendPython = path.join(backendDir, ".venv", "Scripts", "python.exe");
const backendPort = 8000;

async function main() {
  await ensureBuiltExtension();
  await ensureBackendPython();
  await fs.rm(profileDir, { recursive: true, force: true });

  const backend = spawn(
    backendPython,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(backendPort)],
    {
      cwd: backendDir,
      stdio: "ignore",
      windowsHide: true,
    },
  );

  try {
    await waitForHealth(`http://127.0.0.1:${backendPort}/health`);

    const context = await chromium.launchPersistentContext(profileDir, {
      executablePath: await resolveChromeExecutable(),
      headless: false,
      args: [
        `--disable-extensions-except=${distDir}`,
        `--load-extension=${distDir}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });

    try {
      const extensionId = await waitForExtensionId(context);
      const extPage = await context.newPage();
      await extPage.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
      await extPage.waitForLoadState("domcontentloaded");

      await extPage.evaluate(async () => {
        await chrome.storage.local.clear();
      });
      await extPage.reload();
      await extPage.waitForLoadState("domcontentloaded");

      const unique = Date.now();
      const email = `phase2-${unique}@example.com`;
      const title = `Cloud UI Smoke ${unique}`;

      await extPage.getByLabel("API Base URL", { exact: true }).fill(`http://127.0.0.1:${backendPort}`);
      await extPage.getByLabel("Email", { exact: true }).fill(email);
      await extPage.getByLabel("Name", { exact: true }).fill("Phase Two Smoke");
      await extPage.getByText("Sign In to Cloud", { exact: true }).click();

      try {
        await extPage.getByText("Connected Backend", { exact: true }).waitFor({
          state: "visible",
          timeout: 15000,
        });
        await extPage.getByText(email, { exact: true }).waitFor({ state: "visible", timeout: 15000 });
      } catch (error) {
        console.error(await extPage.evaluate(() => document.body.innerText));
        throw error;
      }

      await extPage.getByText("Create Manual Context", { exact: true }).click();
      await extPage.locator("input").fill(title);
      await extPage.locator("textarea").first().fill("Saved through the Context Kit cloud flow.");
      await extPage.getByText("Save Context Package", { exact: true }).click();
      await extPage.getByText(title, { exact: true }).waitFor({ state: "visible", timeout: 15000 });
      await extPage.getByText("Back", { exact: true }).click();
      await extPage.getByText(title, { exact: true }).waitFor({ state: "visible", timeout: 15000 });

      console.log("Phase 2 cloud smoke test passed.");
      console.log(`Created cloud package: ${title}`);
    } finally {
      await context.close();
    }
  } finally {
    backend.kill("SIGTERM");
  }
}

async function ensureBuiltExtension() {
  await fs.access(path.join(distDir, "manifest.json"));
}

async function ensureBackendPython() {
  await fs.access(backendPython);
}

async function waitForHealth(url) {
  const timeoutAt = Date.now() + 20000;

  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until healthy.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Backend health check did not become ready in time.");
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
