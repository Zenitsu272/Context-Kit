import type { AuthSession } from "../types/auth";
import type { ContextDraft, ContextPackage } from "../types/context-package";

const STORAGE_KEY = "context_bridge.packages";
const DRAFT_KEY = "context_bridge.active_draft";
const SESSION_KEY = "context_bridge.auth_session";
const ACTIVE_WORKSPACE_KEY = "context_bridge.active_workspace";

export async function getPackages(): Promise<ContextPackage[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return sortPackages((stored[STORAGE_KEY] as ContextPackage[] | undefined) ?? []);
}

export async function savePackage(nextPackage: ContextPackage): Promise<ContextPackage[]> {
  const packages = await getPackages();
  const existingIndex = packages.findIndex((item) => item.id === nextPackage.id);

  if (existingIndex >= 0) {
    packages[existingIndex] = nextPackage;
  } else {
    packages.push(nextPackage);
  }

  const sorted = sortPackages(packages);
  await chrome.storage.local.set({ [STORAGE_KEY]: sorted });
  return sorted;
}

export async function removePackage(id: string): Promise<ContextPackage[]> {
  const packages = await getPackages();
  const filtered = packages.filter((item) => item.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  return filtered;
}

export async function importPackages(items: ContextPackage[]): Promise<ContextPackage[]> {
  const current = await getPackages();
  const merged = new Map<string, ContextPackage>();

  for (const item of [...current, ...items]) {
    merged.set(item.id, item);
  }

  const packages = sortPackages([...merged.values()]);
  await chrome.storage.local.set({ [STORAGE_KEY]: packages });
  return packages;
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

export async function saveActiveWorkspaceId(workspaceId: string | null): Promise<void> {
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
