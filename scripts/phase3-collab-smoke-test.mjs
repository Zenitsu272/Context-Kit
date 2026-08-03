import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const backendDir = path.join(repoRoot, "backend");
const backendPython = path.join(backendDir, ".venv", "Scripts", "python.exe");
const backendPort = 8010;
const apiBaseUrl = `http://127.0.0.1:${backendPort}`;

async function main() {
  await fs.access(backendPython);

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
    await waitForHealth(`${apiBaseUrl}/health`);

    const unique = Date.now();
    const ownerEmail = `phase3-owner-${unique}@example.com`;
    const memberEmail = `phase3-member-${unique}@example.com`;

    const ownerSession = await login(ownerEmail, "Owner Smoke");
    const memberSession = await login(memberEmail, "Member Smoke");

    const workspace = await fetchJson(`${apiBaseUrl}/api/workspaces`, {
      method: "POST",
      headers: buildHeaders(ownerSession.token),
      body: JSON.stringify({ name: `Phase 3 Team ${unique}` }),
    });

    await fetchJson(`${apiBaseUrl}/api/workspaces/${workspace.id}/invites`, {
      method: "POST",
      headers: buildHeaders(ownerSession.token),
      body: JSON.stringify({ email: memberEmail, role: "member" }),
    });

    const members = await fetchJson(`${apiBaseUrl}/api/workspaces/${workspace.id}/members`, {
      headers: buildHeaders(ownerSession.token),
    });
    if (!members.some((member) => member.email === memberEmail)) {
      throw new Error("Invited member did not appear in the workspace member list.");
    }

    const createdPackage = await fetchJson(`${apiBaseUrl}/api/context-packages`, {
      method: "POST",
      headers: buildHeaders(ownerSession.token),
      body: JSON.stringify({
        title: `Phase 3 Package ${unique}`,
        workspace_id: workspace.id,
        source_platform: "manual",
        source_url: "",
        visibility: "team",
        summary: "Original workspace summary.",
        key_decisions: ["Ship workspaces first."],
        constraints: ["Keep permissions simple."],
        open_questions: ["Should viewers be read only?"],
        tags: ["phase3", "workspace"],
        sensitive_findings: [],
        messages: [],
        depth: "detailed",
        notes: "",
        extraction_confidence: "high",
        review_warnings: [],
      }),
    });

    const memberPackages = await fetchJson(
      `${apiBaseUrl}/api/context-packages?workspace_id=${encodeURIComponent(workspace.id)}`,
      {
        headers: buildHeaders(memberSession.token),
      },
    );
    if (!memberPackages.some((item) => item.id === createdPackage.id)) {
      throw new Error("Workspace member could not see the shared package.");
    }

    const updatedPackage = await fetchJson(`${apiBaseUrl}/api/context-packages/${createdPackage.id}`, {
      method: "PATCH",
      headers: buildHeaders(ownerSession.token),
      body: JSON.stringify({
        summary: "Updated workspace summary.",
        tags: ["phase3", "workspace", "versioned"],
      }),
    });
    if (updatedPackage.current_version !== 2) {
      throw new Error(`Expected version 2 after update, received ${updatedPackage.current_version}.`);
    }

    const versions = await fetchJson(`${apiBaseUrl}/api/context-packages/${createdPackage.id}/versions`, {
      headers: buildHeaders(ownerSession.token),
    });
    if (versions.length < 2) {
      throw new Error("Version history did not capture the package update.");
    }

    const oldestVersion = versions[versions.length - 1];
    const restoredPackage = await fetchJson(
      `${apiBaseUrl}/api/context-packages/${createdPackage.id}/versions/${oldestVersion.id}/restore`,
      {
        method: "POST",
        headers: buildHeaders(ownerSession.token),
      },
    );
    if (restoredPackage.current_version !== 3) {
      throw new Error(`Expected version 3 after restore, received ${restoredPackage.current_version}.`);
    }
    if (restoredPackage.summary !== "Original workspace summary.") {
      throw new Error("Restore did not bring back the original package summary.");
    }

    console.log("Phase 3 collaboration smoke test passed.");
    console.log(`Workspace: ${workspace.name}`);
  } finally {
    backend.kill("SIGTERM");
  }
}

async function login(email, name) {
  return fetchJson(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
}

function buildHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
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

async function fetchJson(url, init = undefined) {
  const response = await fetch(url, init);

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = await response.json();
      detail = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
    } catch {
      // Ignore non-JSON bodies.
    }
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
