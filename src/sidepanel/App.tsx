import { useEffect, useMemo, useRef, useState } from "react";
import { CreatePackage } from "./CreatePackage";
import { PackageDetail } from "./PackageDetail";
import { PackageList } from "./PackageList";
import {
  createDraftFromConversation,
  createDraftFromSelection,
  createManualDraft,
  materializePackage,
} from "../core/context";
import {
  clearActiveDraft,
  clearAuthSession,
  getActiveDraft,
  getActiveWorkspaceId,
  getAuthSession,
  getPackages,
  importPackages,
  removePackage,
  saveActiveDraft,
  saveActiveWorkspaceId,
  saveAuthSession,
  savePackage,
} from "../storage/local-cache";
import type { AuthSession } from "../types/auth";
import type { ContextDraft, ContextPackage, PageStatus, RenderOptions } from "../types/context-package";
import type { PackageVersion, Workspace, WorkspaceMember } from "../types/workspace";
import { appConfig } from "../config";
import {
  extractConversation,
  extractSelectedText,
  getCurrentPageStatus,
  insertRenderedContext,
} from "./extension";
import { renderContextPackage } from "../core/render";
import {
  createRemotePackage,
  createWorkspace,
  deleteRemotePackage,
  fetchCurrentUser,
  getDefaultApiBaseUrl,
  importRemotePackages,
  inviteWorkspaceMember,
  listPackageVersions,
  listRemotePackages,
  listWorkspaceMembers,
  listWorkspaces,
  loginToBackend,
  logoutFromBackend,
  restorePackageVersion,
  updateRemotePackage,
} from "../api/client";

type ViewState =
  | { name: "home" }
  | { name: "create"; draft: ContextDraft; existingPackage?: ContextPackage }
  | { name: "detail"; contextPackage: ContextPackage };

type StatusTone = "neutral" | "success" | "warning" | "error";

export function App() {
  const [packages, setPackages] = useState<ContextPackage[]>([]);
  const [savedDraft, setSavedDraft] = useState<ContextDraft | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>({
    isSupported: false,
    platform: "unsupported",
    title: "Checking current page...",
    url: "",
  });
  const [view, setView] = useState<ViewState>({ name: "home" });
  const [query, setQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "chatgpt" | "gemini" | "manual">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [recentDays, setRecentDays] = useState<"" | "7" | "30" | "90">("");
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState<{ tone: StatusTone; text: string }>({
    tone: "neutral",
    text: appConfig.enableCloudSync
      ? "Local MVP mode. Sign in below to start using cloud sync."
      : "Local-first publishing build. Cloud sync is disabled in this package.",
  });
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isAuthWorking, setIsAuthWorking] = useState(false);
  const [authDraft, setAuthDraft] = useState({
    apiBaseUrl: getDefaultApiBaseUrl(),
    email: "",
    name: "",
  });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [packageVersions, setPackageVersions] = useState<PackageVersion[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void bootstrap();

    const handleActivated = () => void refreshPageStatus();
    const handleUpdated = () => void refreshPageStatus();
    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, []);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void refreshRemotePackages(authSession);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [activeWorkspaceId, authSession, platformFilter, query, recentDays, tagFilter]);

  const filteredPackages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return packages.filter((contextPackage) => {
      const matchesText = !normalized
        || [
            contextPackage.title,
            contextPackage.summary,
            contextPackage.tags.join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized);
      const matchesPlatform =
        platformFilter === "all" || contextPackage.platform === platformFilter;
      const matchesTag =
        !tagFilter.trim()
        || contextPackage.tags.some((item) => item.toLowerCase() === tagFilter.trim().toLowerCase());
      const matchesRecent =
        !recentDays
        || Date.now() - new Date(contextPackage.updatedAt).getTime() <= Number(recentDays) * 24 * 60 * 60 * 1000;

      return matchesText && matchesPlatform && matchesTag && matchesRecent;
    });
  }, [packages, platformFilter, query, recentDays, tagFilter]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  );

  const workspaceNameById = useMemo(
    () =>
      Object.fromEntries(workspaces.map((workspace) => [workspace.id, workspace.name])),
    [workspaces],
  );

  const availableTags = useMemo(
    () =>
      [...new Set(packages.flatMap((contextPackage) => contextPackage.tags))]
        .sort((left, right) => left.localeCompare(right)),
    [packages],
  );

  async function bootstrap() {
    await refreshDraft();
    await refreshPageStatus();

    if (!appConfig.enableCloudSync) {
      await refreshLocalPackages();
      return;
    }

    const storedSession = await getAuthSession();
    if (!storedSession) {
      await refreshLocalPackages();
      return;
    }

    setAuthDraft({
      apiBaseUrl: storedSession.apiBaseUrl,
      email: storedSession.user.email,
      name: storedSession.user.name,
    });

    try {
      const user = await fetchCurrentUser(storedSession);
      const nextSession = { ...storedSession, user };
      setAuthSession(nextSession);
      await saveAuthSession(nextSession);
      const preferredWorkspaceId = await getActiveWorkspaceId();
      await refreshCloudState(nextSession, preferredWorkspaceId);
      setStatus({
        tone: "success",
        text: `Connected to cloud sync as ${user.email}.`,
      });
    } catch (error) {
      await clearAuthSession();
      await saveActiveWorkspaceId(null);
      setAuthSession(null);
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setWorkspaceMembers([]);
      await refreshLocalPackages();
      setStatus({
        tone: "warning",
        text:
          error instanceof Error
            ? `Cloud session expired: ${error.message}. Falling back to local mode.`
            : "Cloud session expired. Falling back to local mode.",
      });
    }
  }

  async function refreshCloudState(session: AuthSession, preferredWorkspaceId: string | null) {
    const nextWorkspaces = await listWorkspaces(session);
    setWorkspaces(nextWorkspaces);

    const resolvedWorkspaceId =
      preferredWorkspaceId && nextWorkspaces.some((workspace) => workspace.id === preferredWorkspaceId)
        ? preferredWorkspaceId
        : null;

    setActiveWorkspaceId(resolvedWorkspaceId);
    await saveActiveWorkspaceId(resolvedWorkspaceId);
    await refreshRemotePackages(session, resolvedWorkspaceId);
    await refreshWorkspaceMembers(session, resolvedWorkspaceId);
  }

  async function refreshLocalPackages() {
    const items = await getPackages();
    setPackages(items);
    setPackageVersions([]);
  }

  async function refreshRemotePackages(session: AuthSession, workspaceId: string | null = activeWorkspaceId) {
    const items = await listRemotePackages(session, workspaceId, {
      query,
      platform: platformFilter === "all" ? "" : platformFilter,
      tag: tagFilter,
      recentDays: recentDays ? Number(recentDays) : null,
    });
    setPackages(items);
  }

  async function refreshWorkspaceMembers(session: AuthSession, workspaceId: string | null = activeWorkspaceId) {
    if (!workspaceId) {
      setWorkspaceMembers([]);
      return;
    }
    const members = await listWorkspaceMembers(session, workspaceId);
    setWorkspaceMembers(members);
  }

  async function refreshDraft() {
    const draft = await getActiveDraft();
    setSavedDraft(draft);
  }

  async function refreshPageStatus() {
    try {
      const currentStatus = await getCurrentPageStatus();
      setPageStatus(currentStatus);
    } catch (error) {
      setPageStatus({
        isSupported: false,
        platform: "unsupported",
        title: "Current page unavailable",
        url: "",
        reason: error instanceof Error ? error.message : "Open ChatGPT or Gemini and try again.",
      });
    }
  }

  async function handleLogin() {
    setIsAuthWorking(true);
    setStatus({ tone: "neutral", text: "Signing in to the local Context Kit API..." });

    try {
      const session = await loginToBackend(authDraft);
      setAuthSession(session);
      await saveAuthSession(session);
      await refreshCloudState(session, await getActiveWorkspaceId());
      setStatus({
        tone: "success",
        text: `Cloud sync connected as ${session.user.email}.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to sign in to the backend.",
      });
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleLogout() {
    if (!authSession || !appConfig.enableCloudSync) {
      return;
    }

    setIsAuthWorking(true);

    try {
      await logoutFromBackend(authSession);
    } catch {
      // Clear local session state even if the remote logout call fails.
    } finally {
      await clearAuthSession();
      await saveActiveWorkspaceId(null);
      setAuthSession(null);
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setWorkspaceMembers([]);
      setPackageVersions([]);
      await refreshLocalPackages();
      setStatus({ tone: "neutral", text: "Signed out. Back in local-only mode." });
      setIsAuthWorking(false);
    }
  }

  async function handleRefreshCloud() {
    if (!authSession || !appConfig.enableCloudSync) {
      return;
    }

    setIsAuthWorking(true);
    try {
      setWorkspaces(await listWorkspaces(authSession));
      await refreshRemotePackages(authSession);
      await refreshWorkspaceMembers(authSession);
      setStatus({ tone: "success", text: "Cloud data refreshed." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to refresh cloud packages.",
      });
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleWorkspaceChange(nextWorkspaceId: string | null) {
    if (!authSession || !appConfig.enableCloudSync) {
      return;
    }

    setIsAuthWorking(true);
    try {
      setActiveWorkspaceId(nextWorkspaceId);
      await saveActiveWorkspaceId(nextWorkspaceId);
      await refreshRemotePackages(authSession, nextWorkspaceId);
      await refreshWorkspaceMembers(authSession, nextWorkspaceId);
      setStatus({
        tone: "success",
        text: nextWorkspaceId
          ? `Switched to workspace: ${workspaceNameById[nextWorkspaceId] ?? "Workspace"}.`
          : "Switched to your personal cloud library.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to switch workspaces.",
      });
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!authSession || !appConfig.enableCloudSync || !workspaceNameDraft.trim()) {
      return;
    }

    setIsAuthWorking(true);
    try {
      const created = await createWorkspace(authSession, workspaceNameDraft);
      const nextWorkspaces = [...workspaces, created].sort((left, right) => left.name.localeCompare(right.name));
      setWorkspaces(nextWorkspaces);
      setWorkspaceNameDraft("");
      await handleWorkspaceChange(created.id);
      setStatus({
        tone: "success",
        text: `Workspace created: ${created.name}.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to create workspace.",
      });
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleInviteMember() {
    if (!authSession || !appConfig.enableCloudSync || !activeWorkspaceId) {
      return;
    }

    const email = window.prompt("Invite teammate email");
    if (!email?.trim()) {
      return;
    }

    setIsAuthWorking(true);
    try {
      await inviteWorkspaceMember(authSession, activeWorkspaceId, { email, role: "member" });
      await refreshWorkspaceMembers(authSession, activeWorkspaceId);
      setStatus({
        tone: "success",
        text: `Invite recorded for ${email.trim().toLowerCase()}.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to invite workspace member.",
      });
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleSyncLocalToCloud() {
    if (!authSession || !appConfig.enableCloudSync) {
      return;
    }

    setIsAuthWorking(true);
    try {
      const localPackages = await getPackages();
      if (!localPackages.length) {
        setStatus({ tone: "warning", text: "There are no local packages to upload." });
        return;
      }

      await importRemotePackages(authSession, localPackages.map((item) => applyWorkspaceDefaults(item)));
      await refreshRemotePackages(authSession);
      setStatus({
        tone: "success",
        text: `Uploaded ${localPackages.length} local package${localPackages.length === 1 ? "" : "s"} to the cloud.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to upload local packages.",
      });
    } finally {
      setIsAuthWorking(false);
    }
  }

  async function handleSaveCurrentConversation() {
    setIsWorking(true);
    setStatus({ tone: "neutral", text: "Extracting the current conversation..." });

    try {
      const conversation = await extractConversation();
      if (!conversation.messages.length) {
        throw new Error("No conversation messages were detected on this page.");
      }

      const draft = createDraftFromConversation(conversation);
      setSavedDraft(draft);
      setView({ name: "create", draft, existingPackage: undefined });
      setStatus({
        tone: draft.reviewWarnings.length ? "warning" : "success",
        text: draft.reviewWarnings.length
          ? "Review the extraction warnings before saving this package."
          : "Review the draft before saving it.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Conversation extraction failed.",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCaptureSelectedText() {
    setIsWorking(true);
    setStatus({ tone: "neutral", text: "Capturing your selected text..." });

    try {
      const selection = await extractSelectedText();
      const draft = createDraftFromSelection(selection);

      if (!draft.messages.length) {
        throw new Error("No useful text was captured. Highlight part of the conversation and try again.");
      }

      setSavedDraft(draft);
      setView({ name: "create", draft, existingPackage: undefined });
      setStatus({
        tone: "warning",
        text: "Selected text captured. Review the transcript carefully before saving.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Selected-text capture failed. Try highlighting the conversation first.",
      });
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSaveDraft(draft: ContextDraft, existingPackage?: ContextPackage) {
    const basePackage = materializePackage(draft, existingPackage);
    const contextPackage = authSession ? applyWorkspaceDefaults(basePackage, existingPackage) : basePackage;

    try {
      let nextPackages: ContextPackage[];
      if (authSession && appConfig.enableCloudSync) {
        const savedRemote = existingPackage
          ? await updateRemotePackage(authSession, contextPackage)
          : await createRemotePackage(authSession, contextPackage);
        nextPackages = upsertInList(packages, savedRemote);
      } else {
        nextPackages = await savePackage(contextPackage);
      }

      setPackages(nextPackages);
      await clearActiveDraft();
      setSavedDraft(null);
      const nextDetail = nextPackages.find((item) => item.id === contextPackage.id) ?? contextPackage;
      setView({ name: "detail", contextPackage: nextDetail });
      if (authSession && appConfig.enableCloudSync) {
        setPackageVersions(await listPackageVersions(authSession, nextDetail.id));
      }
      setStatus({
        tone: "success",
        text: authSession
          ? existingPackage
            ? "Context Package updated in the cloud."
            : "Context Package saved to the cloud."
          : existingPackage
            ? "Context Package updated locally."
            : "Context Package saved locally.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to save the package.",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      if (authSession && appConfig.enableCloudSync) {
        await deleteRemotePackage(authSession, id);
        setPackages((current) => current.filter((item) => item.id !== id));
      } else {
        const nextPackages = await removePackage(id);
        setPackages(nextPackages);
      }
      setPackageVersions([]);
      setView({ name: "home" });
      setStatus({
        tone: "success",
        text: authSession ? "Context Package deleted from the cloud." : "Context Package deleted.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to delete the package.",
      });
    }
  }

  async function handleInsert(contextPackage: ContextPackage, options: RenderOptions) {
    const rendered = renderContextPackage(contextPackage, options);

    try {
      await insertRenderedContext(rendered);
      setStatus({ tone: "success", text: "Rendered context inserted into the current AI tool." });
    } catch (error) {
      await navigator.clipboard.writeText(rendered);
      setStatus({
        tone: "warning",
        text:
          error instanceof Error
            ? `${error.message} Copied the rendered context to your clipboard instead.`
            : "Prompt insertion failed. Copied the rendered context instead.",
      });
    }
  }

  function handleExport(contextPackage: ContextPackage) {
    const blob = new Blob([JSON.stringify(contextPackage, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(contextPackage.title)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus({ tone: "success", text: "Context Package exported as JSON." });
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = (Array.isArray(parsed) ? parsed : [parsed]) as ContextPackage[];

      if (authSession && appConfig.enableCloudSync) {
        const synced = await importRemotePackages(authSession, items.map((item) => applyWorkspaceDefaults(item)));
        setPackages((current) => mergeLists(current, synced));
        setStatus({
          tone: "success",
          text: `Imported ${items.length} package${items.length === 1 ? "" : "s"} into the cloud.`,
        });
      } else {
        const nextPackages = await importPackages(items);
        setPackages(nextPackages);
        setStatus({
          tone: "success",
          text: `Imported ${items.length} package${items.length === 1 ? "" : "s"}.`,
        });
      }
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to import JSON.",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function openPackageDetail(contextPackage: ContextPackage) {
    setView({ name: "detail", contextPackage });
    if (!authSession || !appConfig.enableCloudSync) {
      setPackageVersions([]);
      return;
    }

    try {
      setPackageVersions(await listPackageVersions(authSession, contextPackage.id));
    } catch (error) {
      setPackageVersions([]);
      setStatus({
        tone: "warning",
        text: error instanceof Error ? error.message : "Failed to load version history.",
      });
    }
  }

  async function handleRestoreVersion(contextPackage: ContextPackage, versionId: string) {
    if (!authSession || !appConfig.enableCloudSync) {
      return;
    }

    setIsWorking(true);
    try {
      const restored = await restorePackageVersion(authSession, contextPackage.id, versionId);
      setPackages((current) => upsertInList(current, restored));
      setView({ name: "detail", contextPackage: restored });
      setPackageVersions(await listPackageVersions(authSession, restored.id));
      setStatus({
        tone: "success",
        text: `Restored ${restored.title} to a prior version.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Failed to restore the selected version.",
      });
    } finally {
      setIsWorking(false);
    }
  }

  function applyWorkspaceDefaults(contextPackage: ContextPackage, existingPackage?: ContextPackage): ContextPackage {
    if (!authSession || !appConfig.enableCloudSync) {
      return contextPackage;
    }

    const workspaceId = existingPackage?.workspaceId ?? contextPackage.workspaceId ?? activeWorkspaceId ?? null;
    const visibility = existingPackage?.visibility ?? contextPackage.visibility ?? (workspaceId ? "team" : "private");

    return {
      ...contextPackage,
      workspaceId,
      visibility,
    };
  }

  if (view.name === "create") {
    return (
      <CreatePackage
        draft={view.draft}
        existingPackage={view.existingPackage}
        availablePackages={packages}
        onCancel={() => setView({ name: "home" })}
        onDraftChange={(draft) => {
          setSavedDraft(draft);
          void saveActiveDraft(draft);
        }}
        onSave={(draft) => handleSaveDraft(draft, view.existingPackage)}
        onUseExistingPackage={(contextPackage) =>
          setView({
            name: "create",
            draft: view.draft,
            existingPackage: contextPackage,
          })
        }
      />
    );
  }

  if (view.name === "detail") {
    const workspaceName = view.contextPackage.workspaceId
      ? workspaceNameById[view.contextPackage.workspaceId]
      : undefined;
    const canRestoreVersions =
      !!authSession && (!activeWorkspace || activeWorkspace.role !== "viewer");

    return (
      <PackageDetail
        contextPackage={view.contextPackage}
        workspaceName={workspaceName}
        versions={packageVersions}
        canRestoreVersions={canRestoreVersions}
        onBack={() => setView({ name: "home" })}
        onDelete={handleDelete}
        onEdit={(contextPackage) =>
          setView({
            name: "create",
            draft: {
              title: contextPackage.title,
              platform: contextPackage.platform,
              sourceUrl: contextPackage.sourceUrl,
              summary: contextPackage.summary,
              keyDecisions: contextPackage.keyDecisions,
              constraints: contextPackage.constraints,
              openQuestions: contextPackage.openQuestions,
              tags: contextPackage.tags,
              sensitiveFindings: contextPackage.sensitiveFindings,
              messages: contextPackage.messages,
              depth: contextPackage.depth,
              notes: contextPackage.notes,
              extractionConfidence: contextPackage.extractionConfidence,
              reviewWarnings: contextPackage.reviewWarnings,
            },
            existingPackage: contextPackage,
          })
        }
        onInsert={handleInsert}
        onExport={handleExport}
        onRestoreVersion={(versionId) => handleRestoreVersion(view.contextPackage, versionId)}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Context Kit</p>
            <h1>Project Memory for AI Tools</h1>
          </div>
          <button className="ghost-button" onClick={() => void refreshPageStatus()} type="button">
            Refresh
          </button>
        </div>
        <div className={`status-banner status-banner--${status.tone}`}>
          <p className="hero-copy">{status.text}</p>
        </div>
        <div className="status-card">
          <span className="status-dot" data-supported={pageStatus.isSupported} />
          <div>
            <strong>{pageStatus.title}</strong>
            <p>
              {pageStatus.isSupported
                ? `Supported page detected: ${pageStatus.platform}`
                : pageStatus.reason ?? "Open ChatGPT or Gemini to start capturing context."}
            </p>
          </div>
        </div>
        {!pageStatus.isSupported && (
          <div className="tip-card">
            <strong>Manual fallback still works</strong>
            <p>
              Open a supported AI tab for full extraction, or use Manual Context / Selected Text
              capture on the content you want to keep.
            </p>
          </div>
        )}
        <div className="action-row">
          <button
            className="primary-button"
            disabled={!pageStatus.isSupported || isWorking}
            onClick={() => void handleSaveCurrentConversation()}
            type="button"
          >
            {isWorking ? "Reading Conversation..." : "Save This Conversation"}
          </button>
          <button
            className="ghost-button"
            onClick={() =>
              setView({ name: "create", draft: createManualDraft(), existingPackage: undefined })
            }
            type="button"
          >
            Create Manual Context
          </button>
          <button
            className="ghost-button"
            disabled={isWorking}
            onClick={() => void handleCaptureSelectedText()}
            type="button"
          >
            Capture Selected Text
          </button>
        </div>
      </section>

      <section className="panel-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{appConfig.enableCloudSync ? "Cloud Sync" : "Publishing Mode"}</p>
            <h2>
              {appConfig.enableCloudSync
                ? authSession
                  ? "Connected Backend"
                  : "Sign In to Backend"
                : "Local-First Store Build"}
            </h2>
          </div>
        </div>

        {!appConfig.enableCloudSync ? (
          <div className="detail-card">
            <p>
              This publish-safe build keeps Context Kit local-first. Conversation capture, review,
              redaction, export, and insertion stay available, but cloud sync is intentionally
              hidden until a production backend and privacy workflow are ready.
            </p>
            <div className="tip-card">
              <strong>Data use summary</strong>
              <p>
                Context Kit reads supported AI pages only when you explicitly capture context, and
                it stores packages in browser extension storage unless you use a separately enabled
                backend build.
              </p>
            </div>
          </div>
        ) : authSession ? (
          <div className="detail-card">
            <p>
              Signed in as <strong>{authSession.user.email}</strong>
            </p>
            <p>API: {authSession.apiBaseUrl}</p>

            <label className="field">
              <span>Workspace Scope</span>
              <select
                disabled={isAuthWorking}
                value={activeWorkspaceId ?? ""}
                onChange={(event) => void handleWorkspaceChange(event.target.value || null)}
              >
                <option value="">Personal Library</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} ({workspace.role})
                  </option>
                ))}
              </select>
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Create Workspace</span>
                <input
                  value={workspaceNameDraft}
                  onChange={(event) => setWorkspaceNameDraft(event.target.value)}
                  placeholder="Platform Team"
                />
              </label>
              <div className="field workspace-actions">
                <span>Team Actions</span>
                <div className="action-row">
                  <button
                    className="ghost-button"
                    disabled={isAuthWorking || !workspaceNameDraft.trim()}
                    onClick={() => void handleCreateWorkspace()}
                    type="button"
                  >
                    Create
                  </button>
                  <button
                    className="ghost-button"
                    disabled={isAuthWorking || !activeWorkspaceId}
                    onClick={() => void handleInviteMember()}
                    type="button"
                  >
                    Invite Member
                  </button>
                </div>
              </div>
            </div>

            {activeWorkspace && (
              <div className="tip-card">
                <strong>{activeWorkspace.name}</strong>
                <p>
                  Role: {activeWorkspace.role}. Members: {activeWorkspace.memberCount}. Packages:{" "}
                  {activeWorkspace.packageCount}.
                </p>
                {!!workspaceMembers.length && (
                  <ul className="inline-list">
                    {workspaceMembers.map((member) => (
                      <li key={member.id}>
                        {member.email} ({member.role})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="action-row">
              <button
                className="ghost-button"
                disabled={isAuthWorking}
                onClick={() => void handleRefreshCloud()}
                type="button"
              >
                Refresh Cloud
              </button>
              <button
                className="ghost-button"
                disabled={isAuthWorking}
                onClick={() => void handleSyncLocalToCloud()}
                type="button"
              >
                Upload Local Packages
              </button>
              <button
                className="ghost-button"
                disabled={isAuthWorking}
                onClick={() => void handleLogout()}
                type="button"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="detail-card">
            <label className="field">
              <span>API Base URL</span>
              <input
                value={authDraft.apiBaseUrl}
                onChange={(event) =>
                  setAuthDraft((current) => ({ ...current, apiBaseUrl: event.target.value }))
                }
                placeholder="http://127.0.0.1:8000"
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                value={authDraft.email}
                onChange={(event) =>
                  setAuthDraft((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="you@example.com"
              />
            </label>
            <label className="field">
              <span>Name</span>
              <input
                value={authDraft.name}
                onChange={(event) =>
                  setAuthDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Optional display name"
              />
            </label>
            <div className="action-row">
              <button
                className="primary-button"
                disabled={isAuthWorking || !authDraft.email.trim()}
                onClick={() => void handleLogin()}
                type="button"
              >
                {isAuthWorking ? "Signing In..." : "Sign In to Cloud"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel-shell">
        <div className="detail-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Transparency</p>
              <h2>Privacy and Support</h2>
            </div>
          </div>
          <p>
            Context Kit captures conversation content only on supported AI pages and only after an
            explicit user action such as saving a conversation or capturing selected text.
          </p>
          <div className="link-row">
            {appConfig.privacyPolicyUrl ? (
              <a className="ghost-link" href={appConfig.privacyPolicyUrl} rel="noreferrer" target="_blank">
                Privacy Policy
              </a>
            ) : null}
            {appConfig.supportUrl ? (
              <a className="ghost-link" href={appConfig.supportUrl} rel="noreferrer" target="_blank">
                Support
              </a>
            ) : null}
            {appConfig.officialSiteUrl ? (
              <a className="ghost-link" href={appConfig.officialSiteUrl} rel="noreferrer" target="_blank">
                Official Site
              </a>
            ) : null}
          </div>
          {!appConfig.privacyPolicyUrl && !appConfig.supportUrl && !appConfig.officialSiteUrl ? (
            <p>
              Public privacy, support, and official-site URLs are configured at release time for
              the Chrome Web Store listing.
            </p>
          ) : null}
        </div>
      </section>

      {savedDraft && (
        <section className="panel-shell">
          <div className="warning-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recovered Draft</p>
                <h2>{savedDraft.title || "Untitled draft"}</h2>
              </div>
            </div>
            <p>You have an unsaved Context Package draft stored locally.</p>
            <div className="action-row">
              <button
                className="primary-button"
                onClick={() => setView({ name: "create", draft: savedDraft, existingPackage: undefined })}
                type="button"
              >
                Resume Draft
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  setSavedDraft(null);
                  void clearActiveDraft();
                  setStatus({ tone: "neutral", text: "Unsaved draft discarded." });
                }}
                type="button"
              >
                Discard Draft
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="panel-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {authSession ? (activeWorkspace ? "Workspace Library" : "Personal Cloud Library") : "Local Library"}
            </p>
            <h2>
              {authSession
                ? activeWorkspace
                  ? `${activeWorkspace.name} Packages`
                  : "Your Cloud Packages"
                : "Your Context Packages"}
            </h2>
          </div>
          <div className="action-row action-row--tight">
            <button className="ghost-button" onClick={() => fileInputRef.current?.click()} type="button">
              Import JSON
            </button>
          </div>
        </div>

        <label className="field">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={authSession ? "Search by keywords or natural language" : "Search titles, summaries, or tags"}
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Platform</span>
            <select
              value={platformFilter}
              onChange={(event) =>
                setPlatformFilter(event.target.value as typeof platformFilter)
              }
            >
              <option value="all">All platforms</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="gemini">Gemini</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="field">
            <span>Recent Window</span>
            <select
              value={recentDays}
              onChange={(event) => setRecentDays(event.target.value as typeof recentDays)}
            >
              <option value="">Any time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>Tag Filter</span>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <PackageList
          packages={filteredPackages}
          workspaceNameById={workspaceNameById}
          onSelect={(contextPackage) => void openPackageDetail(contextPackage)}
        />
      </section>

      <input
        ref={fileInputRef}
        accept="application/json"
        hidden
        onChange={handleImportFile}
        type="file"
      />
    </main>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function upsertInList(items: ContextPackage[], contextPackage: ContextPackage): ContextPackage[] {
  const index = items.findIndex((item) => item.id === contextPackage.id);
  if (index === -1) {
    return sortByUpdatedAt([contextPackage, ...items]);
  }

  const next = [...items];
  next[index] = contextPackage;
  return sortByUpdatedAt(next);
}

function mergeLists(current: ContextPackage[], incoming: ContextPackage[]): ContextPackage[] {
  const byId = new Map<string, ContextPackage>();
  for (const item of [...current, ...incoming]) {
    byId.set(item.id, item);
  }
  return sortByUpdatedAt([...byId.values()]);
}

function sortByUpdatedAt(items: ContextPackage[]): ContextPackage[] {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
