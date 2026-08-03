import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const tmpDir = path.join(repoRoot, ".tmp");
const profileDir = path.join(tmpDir, "phase4-smoke-profile");

async function main() {
  await fs.access(path.join(distDir, "manifest.json"));
  await fs.rm(profileDir, { recursive: true, force: true });

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
    const title = `Phase 4 Smart Package ${unique}`;
    const transcript = [
      "USER: My password: hunter2 and email is phase4@example.com.",
      "ASSISTANT: We should debug the auth middleware before changing the database.",
      "USER: Next step is to add tests and document the failure path?",
    ].join("\n\n");

    await extPage.getByText("Create Manual Context", { exact: true }).click();
    await extPage.locator("input").first().fill(title);
    await extPage.locator("textarea").nth(5).fill(transcript);
    await extPage.getByText("Auto-Structure", { exact: true }).click();
    await extPage.getByText("Auto-Redact", { exact: true }).click();

    const summary = await extPage.locator("textarea").first().inputValue();
    if (!summary.trim()) {
      throw new Error("Auto-structure did not generate a summary.");
    }

    const redactedTranscript = await extPage.locator("textarea").nth(5).inputValue();
    if (!redactedTranscript.includes("[REDACTED_EMAIL]") || !redactedTranscript.includes("[REDACTED_CREDENTIAL]")) {
      throw new Error("Auto-redact did not replace sensitive content.");
    }

    await extPage.getByText("Save Context Package", { exact: true }).click();
    try {
      await extPage.locator("h2").filter({ hasText: "Phase 4 Smart Package" }).first().waitFor({
        state: "visible",
        timeout: 15000,
      });
    } catch (error) {
      console.error(await extPage.evaluate(() => document.body.innerText));
      throw error;
    }

    await extPage.locator("select").nth(1).selectOption("debug");
    await extPage.locator("input[placeholder*='Focus on']").fill("auth middleware tests");

    const previewText = await extPage.locator("pre").innerText();
    if (!previewText.includes("Focus task: auth middleware tests") || !previewText.includes("Diagnose the likely cause")) {
      throw new Error("Smart insertion preview did not reflect template and focus settings.");
    }

    await extPage.getByText("Back", { exact: true }).click();
    await extPage.getByLabel("Search", { exact: true }).fill("auth middleware");
    await extPage.getByText("Phase 4 Smart Package", { exact: false }).waitFor({ state: "visible", timeout: 15000 });

    console.log("Phase 4 intelligence smoke test passed.");
    console.log(`Created smart package: ${title}`);
  } finally {
    await context.close();
  }
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
