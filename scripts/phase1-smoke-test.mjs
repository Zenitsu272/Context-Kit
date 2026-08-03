import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const tmpDir = path.join(repoRoot, ".tmp");
const profileDir = path.join(tmpDir, "phase1-smoke-profile");
const downloadDir = path.join(tmpDir, "phase1-downloads");

async function main() {
  const chromePath = await resolveChromeExecutable();
  await ensureBuiltExtension();
  await fs.rm(profileDir, { recursive: true, force: true });
  await fs.rm(downloadDir, { recursive: true, force: true });
  await fs.mkdir(downloadDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromePath,
    headless: false,
    acceptDownloads: true,
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

    const unsupportedPage = context.pages()[0] ?? (await context.newPage());
    await unsupportedPage.goto("https://example.com");
    await extPage.reload();
    await extPage.waitForLoadState("domcontentloaded");
    await expectText(extPage, "Manual fallback still works");

    await testDraftRecovery(extPage);
    const exportedFile = await testSaveExportDeleteImport(extPage, downloadDir);
    await testChatgptSelectionAndInsertion(context, extPage);
    await testGeminiSelectionAndInsertion(context, extPage);

    console.log("Phase 1 smoke test passed.");
    console.log(`Exported sample file: ${exportedFile}`);
  } finally {
    await context.close();
  }
}

async function testDraftRecovery(extPage) {
  await extPage.getByText("Create Manual Context", { exact: true }).click();
  await extPage.locator("input").fill("Smoke Draft");
  await extPage.locator("textarea").first().fill("Draft recovery should persist across reload.");
  await extPage.waitForTimeout(800);
  await extPage.reload();
  await extPage.waitForLoadState("domcontentloaded");
  await expectText(extPage, "Recovered Draft");
  await expectText(extPage, "Smoke Draft");
  await extPage.getByText("Resume Draft", { exact: true }).click();
  await expectInputValue(extPage, "input", "Smoke Draft");
}

async function testSaveExportDeleteImport(extPage, downloadDir) {
  await extPage.getByText("Save Context Package", { exact: true }).click();
  await expectText(extPage, "Smoke Draft");

  const downloadPromise = extPage.waitForEvent("download");
  await extPage.getByText("Export JSON", { exact: true }).click();
  const download = await downloadPromise;
  const downloadPath = path.join(downloadDir, "context-kit-export.json");
  await download.saveAs(downloadPath);

  await extPage.getByText("Delete", { exact: true }).click();
  await expectText(extPage, "No Context Packages yet.");

  await extPage.locator("input[type='file']").setInputFiles(downloadPath);
  await extPage.waitForTimeout(800);
  await expectText(extPage, "Smoke Draft");

  return downloadPath;
}

async function testChatgptSelectionAndInsertion(context, extPage) {
  const page = await context.newPage();
  await page.goto("https://chatgpt.com/");
  await page.waitForLoadState("domcontentloaded");

  const selectionText = await page.evaluate(() => {
    const target =
      document.querySelector("main") ||
      document.querySelector("h1") ||
      document.querySelector("[role='textbox']") ||
      document.body;
    if (!target) {
      return "";
    }
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString().trim() ?? "";
  });
  assert(selectionText.length > 0, "ChatGPT page did not expose selectable text.");

  const captureResponse = await sendExtensionMessage(extPage, "chatgpt.com", {
    type: "EXTRACT_SELECTION",
  });
  assert(
    typeof captureResponse?.text === "string" && captureResponse.text.length > 0,
    "ChatGPT selected-text capture failed.",
  );

  const insertionPayload = "Context Kit smoke insert";
  await sendExtensionMessage(extPage, "chatgpt.com", {
    type: "INSERT_RENDERED_CONTEXT",
    payload: { text: insertionPayload },
  });

  const insertedText = await page.evaluate(() => {
    const prompts = Array.from(
      document.querySelectorAll(
        "#prompt-textarea, textarea[aria-label='Chat with ChatGPT'], textarea[placeholder='Ask anything'], div[contenteditable='true'][role='textbox']",
      ),
    );

    return prompts
      .map((prompt) => {
        if (prompt instanceof HTMLTextAreaElement || prompt instanceof HTMLInputElement) {
          return prompt.value;
        }
        return prompt.textContent?.trim() ?? "";
      })
      .join("\n");
  });
  assert(insertedText.includes(insertionPayload), "ChatGPT prompt insertion failed.");
}

async function testGeminiSelectionAndInsertion(context, extPage) {
  const page = await context.newPage();
  await page.goto("https://gemini.google.com/");
  await page.waitForLoadState("domcontentloaded");

  const selectionText = await page.evaluate(() => {
    const target =
      document.querySelector("main") ||
      document.querySelector("h1") ||
      document.querySelector("[role='textbox']") ||
      document.body;
    if (!target) {
      return "";
    }
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString().trim() ?? "";
  });
  assert(selectionText.length > 0, "Gemini page did not expose selectable text.");

  const captureResponse = await sendExtensionMessage(extPage, "gemini.google.com", {
    type: "EXTRACT_SELECTION",
  });
  assert(
    typeof captureResponse?.text === "string" && captureResponse.text.length > 0,
    "Gemini selected-text capture failed.",
  );

  const insertionPayload = "Context Kit Gemini insert";
  await sendExtensionMessage(extPage, "gemini.google.com", {
    type: "INSERT_RENDERED_CONTEXT",
    payload: { text: insertionPayload },
  });

  const insertedText = await page.evaluate(() => {
    const prompt = document.querySelector(
      "div[contenteditable='true'][role='textbox'][aria-label='Enter a prompt for Gemini'], .ql-editor[contenteditable='true'], div[contenteditable='true'][role='textbox'], textarea",
    );
    return prompt?.textContent?.trim() ?? "";
  });
  assert(insertedText.includes(insertionPayload), "Gemini prompt insertion failed.");
}

async function sendExtensionMessage(extPage, urlFragment, message) {
  return extPage.evaluate(
    async ({ targetUrlFragment, payload }) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((item) => item.url?.includes(targetUrlFragment));
      if (!tab?.id) {
        return { error: `No tab found for ${targetUrlFragment}` };
      }

      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, payload, (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            resolve({ error: lastError.message });
            return;
          }
          resolve(response);
        });
      });
    },
    { targetUrlFragment: urlFragment, payload: message },
  );
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: true });
  await locator.waitFor({ state: "visible", timeout: 15000 });
}

async function expectInputValue(page, selector, expected) {
  await page.waitForFunction(
    ({ innerSelector, value }) => {
      const element = document.querySelector(innerSelector);
      return element instanceof HTMLInputElement && element.value === value;
    },
    { innerSelector: selector, value: expected },
  );
}

async function ensureBuiltExtension() {
  const manifestPath = path.join(distDir, "manifest.json");
  try {
    await fs.access(manifestPath);
  } catch {
    throw new Error("Build output not found. Run `npm run build` before `npm run test:phase1`.");
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
    path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next path.
    }
  }

  throw new Error("Chrome executable not found. Set CHROME_PATH or install Google Chrome.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
