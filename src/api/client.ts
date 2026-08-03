import type { AuthSession } from "../types/auth";
import type { ContextPackage } from "../types/context-package";
import type { PackageVersion, Workspace, WorkspaceMember, WorkspaceRole } from "../types/workspace";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

interface BackendContextPackage {
  id: string;
  workspace_id: string | null;
  title: string;
  source_platform: string;
  source_url: string;
  visibility: "private" | "team" | "selected";
  created_by: string | null;
  status: "active" | "archived" | "deleted";
  summary: string;
  key_decisions: string[];
  constraints: string[];
  open_questions: string[];
  tags: string[];
  sensitive_findings: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  depth: "brief" | "detailed" | "full";
  notes: string;
  extraction_confidence: "high" | "medium" | "low";
  review_warnings: string[];
  current_version: number;
  version_count: number;
  created_at: string;
  updated_at: string;
}

interface BackendWorkspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  member_count: number;
  package_count: number;
  created_at: string;
  updated_at: string;
}

interface BackendWorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  email: string;
  name: string;
  created_at: string;
}

interface BackendPackageVersion {
  id: string;
  context_package_id: string;
  version_number: number;
  created_by: string | null;
  title: string;
  summary: string;
  visibility: "private" | "team" | "selected";
  created_at: string;
}

export function getDefaultApiBaseUrl(): string {
  return DEFAULT_API_BASE_URL;
}

export async function loginToBackend(input: {
  apiBaseUrl?: string;
  email: string;
  name?: string;
}): Promise<AuthSession> {
  const apiBaseUrl = normalizeBaseUrl(input.apiBaseUrl);
  const response = await fetchJson<{ token: string; user: AuthSession["user"] }>(
    `${apiBaseUrl}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email.trim(),
        name: input.name?.trim() ?? "",
      }),
    },
  );

  return {
    ...response,
    apiBaseUrl,
  };
}

export async function logoutFromBackend(session: AuthSession): Promise<void> {
  await fetch(`${session.apiBaseUrl}/auth/logout`, {
    method: "POST",
    headers: buildHeaders(session),
  });
}

export async function fetchCurrentUser(session: AuthSession): Promise<AuthSession["user"]> {
  return fetchJson(`${session.apiBaseUrl}/auth/me`, {
    headers: buildHeaders(session),
  });
}

export async function listWorkspaces(session: AuthSession): Promise<Workspace[]> {
  const response = await fetchJson<BackendWorkspace[]>(`${session.apiBaseUrl}/api/workspaces`, {
    headers: buildHeaders(session),
  });
  return response.map(fromBackendWorkspace);
}

export async function createWorkspace(session: AuthSession, name: string): Promise<Workspace> {
  const response = await fetchJson<BackendWorkspace>(`${session.apiBaseUrl}/api/workspaces`, {
    method: "POST",
    headers: buildHeaders(session),
    body: JSON.stringify({ name: name.trim() }),
  });
  return fromBackendWorkspace(response);
}

export async function listWorkspaceMembers(session: AuthSession, workspaceId: string): Promise<WorkspaceMember[]> {
  const response = await fetchJson<BackendWorkspaceMember[]>(
    `${session.apiBaseUrl}/api/workspaces/${workspaceId}/members`,
    {
      headers: buildHeaders(session),
    },
  );
  return response.map(fromBackendWorkspaceMember);
}

export async function inviteWorkspaceMember(
  session: AuthSession,
  workspaceId: string,
  input: { email: string; role: WorkspaceRole },
): Promise<void> {
  await fetchJson(`${session.apiBaseUrl}/api/workspaces/${workspaceId}/invites`, {
    method: "POST",
    headers: buildHeaders(session),
    body: JSON.stringify({
      email: input.email.trim(),
      role: input.role,
    }),
  });
}

export async function listRemotePackages(
  session: AuthSession,
  workspaceId?: string | null,
  options?: {
    query?: string;
    platform?: string;
    tag?: string;
    recentDays?: number | null;
  },
): Promise<ContextPackage[]> {
  const params = new URLSearchParams();
  if (workspaceId) {
    params.set("workspace_id", workspaceId);
  }
  if (options?.query?.trim()) {
    params.set("q", options.query.trim());
  }
  if (options?.platform?.trim()) {
    params.set("platform", options.platform.trim());
  }
  if (options?.tag?.trim()) {
    params.set("tag", options.tag.trim());
  }
  if (options?.recentDays) {
    params.set("recent_days", String(options.recentDays));
  }
  const query = params.size ? `?${params.toString()}` : "";
  const response = await fetchJson<BackendContextPackage[]>(
    `${session.apiBaseUrl}/api/context-packages${query}`,
    {
      headers: buildHeaders(session),
    },
  );
  return response.map(fromBackendPackage);
}

export async function createRemotePackage(
  session: AuthSession,
  contextPackage: ContextPackage,
): Promise<ContextPackage> {
  const response = await fetchJson<BackendContextPackage>(`${session.apiBaseUrl}/api/context-packages`, {
    method: "POST",
    headers: buildHeaders(session),
    body: JSON.stringify(toBackendPackage(contextPackage)),
  });
  return fromBackendPackage(response);
}

export async function updateRemotePackage(
  session: AuthSession,
  contextPackage: ContextPackage,
): Promise<ContextPackage> {
  const response = await fetchJson<BackendContextPackage>(
    `${session.apiBaseUrl}/api/context-packages/${contextPackage.id}`,
    {
      method: "PATCH",
      headers: buildHeaders(session),
      body: JSON.stringify(toBackendPackage(contextPackage)),
    },
  );
  return fromBackendPackage(response);
}

export async function deleteRemotePackage(session: AuthSession, id: string): Promise<void> {
  await fetchJson(`${session.apiBaseUrl}/api/context-packages/${id}`, {
    method: "DELETE",
    headers: buildHeaders(session),
  });
}

export async function importRemotePackages(
  session: AuthSession,
  packages: ContextPackage[],
): Promise<ContextPackage[]> {
  const response = await fetchJson<BackendContextPackage[]>(`${session.apiBaseUrl}/api/context-packages/import`, {
    method: "POST",
    headers: buildHeaders(session),
    body: JSON.stringify({
      packages: packages.map(toBackendPackage),
    }),
  });
  return response.map(fromBackendPackage);
}

export async function listPackageVersions(
  session: AuthSession,
  contextPackageId: string,
): Promise<PackageVersion[]> {
  const response = await fetchJson<BackendPackageVersion[]>(
    `${session.apiBaseUrl}/api/context-packages/${contextPackageId}/versions`,
    {
      headers: buildHeaders(session),
    },
  );
  return response.map(fromBackendVersion);
}

export async function restorePackageVersion(
  session: AuthSession,
  contextPackageId: string,
  versionId: string,
): Promise<ContextPackage> {
  const response = await fetchJson<BackendContextPackage>(
    `${session.apiBaseUrl}/api/context-packages/${contextPackageId}/versions/${versionId}/restore`,
    {
      method: "POST",
      headers: buildHeaders(session),
    },
  );
  return fromBackendPackage(response);
}

function toBackendPackage(contextPackage: ContextPackage) {
  return {
    id: contextPackage.id,
    workspace_id: contextPackage.workspaceId ?? null,
    title: contextPackage.title,
    source_platform: contextPackage.platform,
    source_url: contextPackage.sourceUrl,
    visibility: contextPackage.visibility ?? "private",
    summary: contextPackage.summary,
    key_decisions: contextPackage.keyDecisions,
    constraints: contextPackage.constraints,
    open_questions: contextPackage.openQuestions,
    tags: contextPackage.tags,
    sensitive_findings: contextPackage.sensitiveFindings,
    messages: contextPackage.messages,
    depth: contextPackage.depth,
    notes: contextPackage.notes,
    extraction_confidence: contextPackage.extractionConfidence,
    review_warnings: contextPackage.reviewWarnings,
  };
}

function fromBackendPackage(payload: BackendContextPackage): ContextPackage {
  return {
    id: payload.id,
    workspaceId: payload.workspace_id,
    visibility: payload.visibility,
    createdBy: payload.created_by,
    currentVersion: payload.current_version,
    versionCount: payload.version_count,
    title: payload.title,
    platform: payload.source_platform as ContextPackage["platform"],
    sourceUrl: payload.source_url,
    capturedAt: payload.created_at,
    updatedAt: payload.updated_at,
    summary: payload.summary,
    keyDecisions: payload.key_decisions,
    constraints: payload.constraints,
    openQuestions: payload.open_questions,
    tags: payload.tags,
    sensitiveFindings: payload.sensitive_findings as unknown as ContextPackage["sensitiveFindings"],
    messages: payload.messages as unknown as ContextPackage["messages"],
    depth: payload.depth,
    notes: payload.notes,
    extractionConfidence: payload.extraction_confidence,
    reviewWarnings: payload.review_warnings,
  };
}

function fromBackendWorkspace(payload: BackendWorkspace): Workspace {
  return {
    id: payload.id,
    name: payload.name,
    slug: payload.slug,
    role: payload.role,
    memberCount: payload.member_count,
    packageCount: payload.package_count,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function fromBackendWorkspaceMember(payload: BackendWorkspaceMember): WorkspaceMember {
  return {
    id: payload.id,
    workspaceId: payload.workspace_id,
    userId: payload.user_id,
    role: payload.role,
    email: payload.email,
    name: payload.name,
    createdAt: payload.created_at,
  };
}

function fromBackendVersion(payload: BackendPackageVersion): PackageVersion {
  return {
    id: payload.id,
    contextPackageId: payload.context_package_id,
    versionNumber: payload.version_number,
    createdBy: payload.created_by,
    title: payload.title,
    summary: payload.summary,
    visibility: payload.visibility,
    createdAt: payload.created_at,
  };
}

function normalizeBaseUrl(input?: string): string {
  return (input?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function buildHeaders(session: AuthSession): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      } else if (payload.detail !== undefined) {
        detail = JSON.stringify(payload.detail);
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
