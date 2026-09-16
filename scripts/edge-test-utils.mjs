import fs from "node:fs/promises";
import path from "node:path";

export async function resolveEdgeExecutable() {
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

export async function waitForExtensionId(context) {
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

