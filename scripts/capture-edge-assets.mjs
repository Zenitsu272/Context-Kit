import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const releaseDir = path.join(repoRoot, "release", "edge-assets");
const profileDir = path.join(repoRoot, ".tmp", "edge-assets-profile");

async function main() {
  await runCommand("npm", ["run", "build:edge"]);
  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.mkdir(releaseDir, { recursive: true });
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
    await page.evaluate(async () => {
      await chrome.storage.local.clear();
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await page.screenshot({ path: path.join(releaseDir, "01-home-1280x800.png") });

    await page.getByText("Create Manual Context", { exact: true }).click();
    await page.locator("input").first().fill("Edge Launch Ready Project Handoff");
    await page.locator("textarea").first().fill("A polished reusable package for Microsoft Edge Add-ons launch preparation.");
    await page.locator("textarea").nth(5).fill(
      [
        "USER: We need an Edge-ready review package before Add-ons submission.",
        "ASSISTANT: Keep the published build local-first and provide transparent privacy disclosures.",
        "USER: Also prepare the required screenshots, logo, and promotional tile.",
      ].join("\n\n"),
    );
    await page.screenshot({ path: path.join(releaseDir, "02-create-package-1280x800.png") });

    await page.evaluate(async () => {
      const storedPackage = {
        id: "edge-launch-ready-project-handoff",
        title: "Edge Launch Ready Project Handoff",
        platform: "manual",
        sourceUrl: "https://zennet-ai.vercel.app/",
        capturedAt: "2026-06-02T08:30:00.000Z",
        updatedAt: "2026-06-02T08:30:00.000Z",
        summary: "A reusable handoff package for privacy review, listing prep, and Edge Add-ons submission.",
        keyDecisions: [
          "Keep the published extension local-first.",
          "Disable cloud sync and local backend prompts in the store package.",
        ],
        constraints: [
          "Use only supported AI-site permissions.",
          "Align privacy disclosures with actual capture behavior.",
        ],
        openQuestions: ["Should the first release remain Hidden after approval or switch straight to Public?"],
        tags: ["edge", "launch", "privacy", "review"],
        sensitiveFindings: [],
        messages: [
          {
            id: "m1",
            role: "user",
            content: "We need an Edge-ready review package before Add-ons submission.",
            position: 0,
          },
          {
            id: "m2",
            role: "assistant",
            content:
              "Keep the published build local-first and provide transparent privacy disclosures and store assets.",
            position: 1,
          },
        ],
        depth: "detailed",
        notes: "Prepared for Edge Add-ons review with public privacy and support URLs.",
        extractionConfidence: "high",
        reviewWarnings: [],
      };

      await chrome.storage.local.set({
        "context_bridge.packages": [storedPackage],
      });
    });

    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);
    await page.waitForLoadState("domcontentloaded");
    await page.locator(".package-card").first().click();
    await page.locator("h2").filter({ hasText: "Edge Launch Ready Project Handoff" }).waitFor({
      state: "visible",
      timeout: 15000,
    });
    await page.locator("input[placeholder*='Focus on']").fill("edge listing and privacy review");
    await page.screenshot({ path: path.join(releaseDir, "03-detail-and-insert-1280x800.png") });

    await page.getByText("Back", { exact: true }).click();
    await page.getByLabel("Search", { exact: true }).fill("edge review");
    await page.screenshot({ path: path.join(releaseDir, "04-library-search-1280x800.png") });
  } finally {
    await context.close();
  }

  await runCommand("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    Buffer.from(
      `& '${path.join(repoRoot, "scripts", "render-edge-assets.ps1").replace(/'/g, "''")}'`,
      "utf16le",
    ).toString("base64"),
  ]);

  console.log(`Edge Add-ons assets captured in ${releaseDir}`);
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

  throw new Error("Context Kit service worker did not appear in Microsoft Edge.");
}

async function resolveEdgeExecutable() {
  const candidates = [
    process.env.EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Microsoft Edge executable not found. Set EDGE_PATH or install Microsoft Edge.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
