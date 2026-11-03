import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import {
  resolveEdgeExecutable,
  waitForExtensionId,
} from "./edge-test-utils.mjs";

const root = process.cwd();
await fs.mkdir(path.join(root, ".tmp"), { recursive: true });
const profile = await fs.mkdtemp(path.join(root, ".tmp", "quality-"));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: await resolveEdgeExecutable(),
  headless: true,
  acceptDownloads: true,
  viewport: { width: 400, height: 900 },
  args: [
    `--disable-extensions-except=${path.join(root, "dist")}`,
    `--load-extension=${path.join(root, "dist")}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});
const errors = [];
let checks = 0;
function pass(name) {
  checks++;
  console.log(`PASS ${name}`);
}
try {
  const id = await waitForExtensionId(context);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`chrome-extension://${id}/src/sidepanel/index.html`);
  await page.getByRole("heading", { name: "Saved for later" }).waitFor();
  await page.screenshot({
    path: path.join(root, ".tmp", "sidebar-home.png"),
    fullPage: true,
  });
  for (const width of [320, 400, 520]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `horizontal overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 400, height: 900 });
  pass("responsive sidebar at 320, 400 and 520 px");

  await page.getByText("Create Manual Context", { exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Multimodal handoff");
  await page
    .getByLabel("Transcript / Message Fallback", { exact: true })
    .fill(
      Array.from(
        { length: 24 },
        (_, i) =>
          `${i % 2 ? "ASSISTANT" : "USER"}: Turn ${i}\n  preserve indentation`,
      ).join("\n\n"),
    );
  await page
    .getByLabel("Key Decisions", { exact: true })
    .fill("First decision\nSecond decision\n");
  assert(
    (
      await page.getByLabel("Key Decisions", { exact: true }).inputValue()
    ).endsWith("\n"),
  );
  await page.getByText("Auto-Structure", { exact: true }).click();
  const originalSummary = await page
    .getByLabel("Summary", { exact: true })
    .inputValue();
  await page.getByText("Enhance with Gemini", { exact: true }).click();
  await page.getByText(/Gemini is off or no keys/).waitFor();
  assert.equal(
    await page.getByLabel("Summary", { exact: true }).inputValue(),
    originalSummary,
  );
  pass("no-key fallback preserves draft and multiline fields");

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE10AAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByLabel("Attach files", { exact: true }).setInputFiles([
    {
      name: "spec.pdf",
      mimeType: "application/pdf",
      buffer: makePdf("PDF architecture constraint: keep all files local."),
    },
    { name: "diagram.png", mimeType: "image/png", buffer: png },
    {
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Attachment notes\nUse a local-first design."),
    },
    {
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("synthetic-video-fixture"),
    },
  ]);
  await page
    .getByText(
      "Files saved locally. Extracted text will be included when you copy context.",
      { exact: true },
    )
    .waitFor({ timeout: 45000 });
  await page
    .locator(".asset-card")
    .filter({ hasText: "spec.pdf" })
    .getByText("Extracted content", { exact: true })
    .click();
  assert(
    (
      await page
        .getByLabel("Extracted text for spec.pdf", { exact: true })
        .inputValue()
    ).includes("PDF architecture constraint"),
  );
  pass("PDF text extraction works in packaged extension with a local worker");

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const firstKey = "quality_test_first_123456789012345";
  const secondKey = "quality_test_second_123456789012345";
  await page
    .getByLabel("Import Gemini environment file", { exact: true })
    .setInputFiles({
      name: ".env",
      mimeType: "text/plain",
      buffer: Buffer.from(
        `GEMINI_API_KEY_1=${firstKey}\nGEMINI_API_KEY_2=${secondKey}\nUNRELATED_SECRET=do_not_import`,
      ),
    });
  await page
    .getByText("Loaded 2 keys. Choose Save settings to apply them.", {
      exact: true,
    })
    .waitFor();
  // Browser permission UI is outside the headless fixture. Stub its outcome; the
  // real production flow uses permissions.request from the user's Save click.
  await page.evaluate(() => {
    chrome.permissions.request = async () => true;
    chrome.permissions.contains = async () => true;
  });
  await page.getByLabel("Enable Gemini", { exact: false }).check();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByText("Settings saved. 2 keys stored on this device.", { exact: true })
    .waitFor();
  const stored = await page.evaluate(() =>
    chrome.storage.local.get("context_kit.gemini"),
  );
  assert.equal(stored["context_kit.gemini"].keys.length, 2);
  assert.equal(
    await page.getByLabel("API keys", { exact: true }).inputValue(),
    "",
  );
  pass(".env import stores only Gemini keys and clears input");

  const requests = [];
  await context.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      const request = route.request();
      if (request.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "POST",
          },
        });
      const key = request.headers()["x-goog-api-key"];
      const data = request.postDataJSON();
      requests.push({ key, data });
      const headers = {
        "access-control-allow-origin": "*",
        "content-type": "application/json",
      };
      if (key === firstKey)
        return route.fulfill({
          status: 403,
          headers,
          body: JSON.stringify({ error: { message: "invalid fixture key" } }),
        });
      const isFile = data.contents[0].parts.some((part) => part.inlineData);
      const isTest = data.contents[0].parts[0].text.includes("exactly OK");
      const text = isFile
        ? "Diagram text: Browser -> local storage -> next AI tool."
        : isTest
          ? "OK"
          : JSON.stringify({
              summary: "Improved handoff summary.",
              keyDecisions: ["Keep files local"],
              constraints: ["Use Edge"],
              openQuestions: [],
              tags: ["handoff"],
            });
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          candidates: [
            { finishReason: "STOP", content: { parts: [{ text }] } },
          ],
        }),
      });
    },
  );
  await page
    .getByRole("button", { name: "Test saved keys", exact: true })
    .click();
  await page
    .getByText("Connected using key 2. Gemini is ready.", { exact: true })
    .waitFor();
  assert.deepEqual(
    requests.map((request) => request.key),
    [firstKey, secondKey],
  );
  pass("Gemini request fails over from rejected key to working key");
  await page.screenshot({
    path: path.join(root, ".tmp", "sidebar-settings.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: /^Library/ }).click();
  await page.getByRole("button", { name: "Resume Draft", exact: true }).click();
  await page
    .locator(".asset-card")
    .filter({ hasText: "diagram.png" })
    .getByRole("button", { name: "Read with Gemini" })
    .click();
  await page
    .getByText("Content extracted. Review the text before sharing.", {
      exact: true,
    })
    .waitFor();
  const fileRequest = requests
    .at(-1)
    .data.contents[0].parts.find((part) => part.inlineData).inlineData;
  assert.equal(fileRequest.mimeType, "image/png");
  assert.equal(fileRequest.data, png.toString("base64"));
  await page
    .getByRole("button", { name: "Enhance with Gemini", exact: true })
    .click();
  await page
    .getByText(
      "Enhanced using key 2. Review the suggested summary and decisions.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await page.getByLabel("Summary", { exact: true }).inputValue(),
    "Improved handoff summary.",
  );
  assert(
    requests.at(-1).data.contents[0].parts[0].text.includes("Diagram text"),
  );
  pass(
    "image bytes are read and extracted attachment text is used in handoff enhancement",
  );
  await page
    .getByRole("button", { name: "Save Context Package", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Multimodal handoff", exact: true })
    .waitFor();
  await page.getByLabel("Insert Mode", { exact: true }).selectOption("full");
  const preview = await page
    .getByLabel("Context preview", { exact: true })
    .inputValue();
  assert(preview.includes("Turn 23"));
  assert(preview.includes("PDF architecture constraint"));
  assert(preview.includes("Diagram text"));
  assert(preview.includes("Upload the original file separately"));
  pass(
    "full context carries transcript, PDF content and image content; video original remains available",
  );
  await page
    .getByRole("button", { name: "Copy context", exact: false })
    .click();
  await page
    .getByText(
      "Copied. Paste into any AI tool with Ctrl+V. Attach original files separately if needed.",
      { exact: true },
    )
    .waitFor();
  await page.screenshot({
    path: path.join(root, ".tmp", "sidebar-detail.png"),
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const backupPath = path.join(profile, "backup.json");
  await download.saveAs(backupPath);
  const backupText = await fs.readFile(backupPath, "utf8");
  const backup = JSON.parse(backupText);
  assert.equal(backup.files.length, 4);
  assert(!backupText.includes(firstKey));
  assert(!backupText.includes(secondKey));
  assert.equal(
    backup.files.find((file) => file.mimeType === "image/png").data,
    png.toString("base64"),
  );
  pass("portable JSON backup includes original bytes and excludes credentials");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByLabel("Import context backup", { exact: true })
    .setInputFiles(backupPath);
  await page.getByText("Imported 1 package.", { exact: true }).waitFor();
  assert.equal(await page.locator(".package-card").count(), 2);
  pass(
    "backup import restores attachments without overwriting existing packages",
  );
  await page
    .getByLabel("Import context backup", { exact: true })
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"title":"broken"}'),
    });
  await page.getByText(/Invalid Context Kit backup/).waitFor();
  assert.equal(await page.locator(".package-card").count(), 2);
  pass("malformed backup rejected without changing library");

  await context.route("https://chatgpt.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Quality chat</title><main><article data-message-author-role="user">hello</article><article data-message-author-role="assistant"><pre>def run():\n    return 42</pre><img src="https://example.com/diagram.png" width="200" alt="Architecture"><a href="https://example.com/spec.pdf">Spec PDF</a></article><article data-message-author-role="user">hello</article><div id="prompt-textarea" contenteditable="true">Existing unsent prompt</div></main>`,
    }),
  );
  await context.route("https://example.com/diagram.png", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  const chat = await context.newPage();
  await chat.goto("https://chatgpt.com/c/quality", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(async () => {
    const tab = (await chrome.tabs.query({ url: "https://chatgpt.com/*" }))[0];
    if (!tab?.id) return false;
    try {
      const status = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_STATUS" });
      return status?.isSupported === true;
    } catch { return false; }
  });
  const captured = await page.evaluate(async () => {
    const tab = (await chrome.tabs.query({ url: "https://chatgpt.com/*" }))[0];
    return chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CONVERSATION" });
  });
  assert.equal(captured.messages.length, 3);
  assert(captured.messages[1].content.includes("    return 42"));
  assert.equal(captured.assets.length, 2);
  await page.evaluate(async () => {
    const tab = (await chrome.tabs.query({ url: "https://chatgpt.com/*" }))[0];
    await chrome.tabs.sendMessage(tab.id, {
      type: "INSERT_RENDERED_CONTEXT",
      payload: { text: "Handoff context" },
    });
  });
  const composer = await chat.locator("#prompt-textarea").innerText();
  assert(composer.includes("Existing unsent prompt"));
  assert(composer.includes("Handoff context"));
  pass(
    "DOM extraction preserves code and repeated turns, detects files; insertion preserves unsent prompt",
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: /^Quick save/ }).click();
  await page
    .getByRole("heading", { name: "Quality chat", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /^Quick save/ }).click();
  await page
    .getByText("Already saved. Your existing notes and edits are intact.", {
      exact: true,
    })
    .waitFor();
  pass("quick save reuses the saved conversation without duplicate packages");
  await context.route("https://example.com/spec.pdf", (route) =>
    route.fulfill({
      contentType: "application/pdf",
      body: makePdf("Imported linked PDF content."),
      headers: {
        "access-control-allow-origin": `chrome-extension://${id}`,
        "access-control-allow-credentials": "true",
      },
    }),
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const pdfCard = page.locator(".asset-card").filter({ hasText: "Spec PDF" });
  await pdfCard
    .getByRole("button", { name: "Import file", exact: true })
    .click();
  await page
    .getByText("Original imported. Readable PDF text is ready to transfer.", {
      exact: true,
    })
    .waitFor();
  assert(
    (await page.locator(".preview-card pre").innerText()).includes(
      "Imported linked PDF content.",
    ),
  );
  pass("detected PDF links import directly and include extracted content");
  assert.deepEqual(errors, []);
  console.log(
    `${checks} Edge quality checks passed. Screenshots: .tmp/sidebar-{home,settings,detail}.png`,
  );
} catch (error) {
  const page = context
    .pages()
    .find((item) => item.url().startsWith("chrome-extension://"));
  if (page) {
    await page.screenshot({
      path: path.join(root, ".tmp", "quality-failure.png"),
      fullPage: true,
    });
    console.error((await page.locator("body").innerText()).slice(0, 7000));
  }
  console.error("Page errors:", errors);
  throw error;
} finally {
  await context.close();
}

function makePdf(text) {
  const stream = `BT /F1 12 Tf 50 740 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
