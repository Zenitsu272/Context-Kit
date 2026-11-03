import type { AuthSession } from "../types/auth";
import type { ContextDraft, ContextPackage } from "../types/context-package";

const STORAGE_KEY = "context_bridge.packages";
const PACKAGE_PREFIX = "context_kit.package.";
const DRAFT_KEY = "context_bridge.active_draft";
const SESSION_KEY = "context_bridge.auth_session";
const ACTIVE_WORKSPACE_KEY = "context_bridge.active_workspace";

export async function getPackages(): Promise<ContextPackage[]> {
  const stored = await chrome.storage.local.get(null);
  const byId = new Map<string, ContextPackage>();
  for (const item of (stored[STORAGE_KEY] as ContextPackage[] | undefined) ??
    [])
    byId.set(item.id, item);
  for (const [key, value] of Object.entries(stored))
    if (key.startsWith(PACKAGE_PREFIX)) byId.set(value.id, value);
  return sortPackages([...byId.values()]);
}

export async function savePackage(
  nextPackage: ContextPackage,
): Promise<ContextPackage[]> {
  return navigator.locks.request("context-kit-library", async () => {
    await migrateLegacyPackages();
    await chrome.storage.local.set({
      [PACKAGE_PREFIX + nextPackage.id]: nextPackage,
    });
    return getPackages();
  });
}

export async function removePackage(id: string): Promise<ContextPackage[]> {
  return navigator.locks.request("context-kit-library", async () => {
    await migrateLegacyPackages();
    await chrome.storage.local.remove(PACKAGE_PREFIX + id);
    return getPackages();
  });
}

export async function importPackages(
  items: ContextPackage[],
): Promise<ContextPackage[]> {
  return navigator.locks.request("context-kit-library", async () => {
    await migrateLegacyPackages();
    // Import as copies when an ID already exists; never overwrite a newer local edit.
    const current = new Set((await getPackages()).map((item) => item.id));
    const entries: Record<string, ContextPackage> = {};
    for (const item of items) {
      const id = current.has(item.id)
        ? `ctx_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
        : item.id;
      current.add(id);
      entries[PACKAGE_PREFIX + id] = { ...item, id };
    }
    await chrome.storage.local.set(entries);
    return getPackages();
  });
}

async function migrateLegacyPackages() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const legacy = stored[STORAGE_KEY] as ContextPackage[] | undefined;
  if (!legacy) return;
  const current = await chrome.storage.local.get(
    legacy.map((item) => PACKAGE_PREFIX + item.id),
  );
  const entries = Object.fromEntries(
    legacy
      .filter((item) => !current[PACKAGE_PREFIX + item.id])
      .map((item) => [PACKAGE_PREFIX + item.id, item]),
  );
  // Do not remove the legacy data until every record has been committed successfully.
  await chrome.storage.local.set(entries);
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function getActiveDraft(): Promise<ContextDraft | null> {
  const stored = await chrome.storage.local.get(DRAFT_KEY);
  return (stored[DRAFT_KEY] as ContextDraft | undefined) ?? null;
}

export async function saveActiveDraft(draft: ContextDraft): Promise<void> {
  await chrome.storage.local.set({ [DRAFT_KEY]: draft });
}

export async function clearActiveDraft(): Promise<void> {
  await chrome.storage.local.remove(DRAFT_KEY);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return (stored[SESSION_KEY] as AuthSession | undefined) ?? null;
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearAuthSession(): Promise<void> {
  await chrome.storage.local.remove(SESSION_KEY);
}

export async function getActiveWorkspaceId(): Promise<string | null> {
  const stored = await chrome.storage.local.get(ACTIVE_WORKSPACE_KEY);
  return (stored[ACTIVE_WORKSPACE_KEY] as string | undefined) ?? null;
}

export async function saveActiveWorkspaceId(
  workspaceId: string | null,
): Promise<void> {
  if (workspaceId) {
    await chrome.storage.local.set({ [ACTIVE_WORKSPACE_KEY]: workspaceId });
    return;
  }
  await chrome.storage.local.remove(ACTIVE_WORKSPACE_KEY);
}

function sortPackages(items: ContextPackage[]): ContextPackage[] {
  return [...items].sort((left, right) => {
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}
