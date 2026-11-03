import { useMemo, useState } from "react";
import { estimateTokens, renderContextPackage } from "../core/render";
import { summarizePlatform } from "../core/context";
import { Attachments } from "./Attachments";
import { downloadBlob } from "../storage/assets";
import type {
  ContextDepth,
  ContextPackage,
  PromptTemplate,
  RenderOptions,
} from "../types/context-package";
import type { PackageVersion } from "../types/workspace";

interface PackageDetailProps {
  contextPackage: ContextPackage;
  workspaceName?: string;
  versions?: PackageVersion[];
  canRestoreVersions?: boolean;
  onBack: () => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (contextPackage: ContextPackage) => void;
  onInsert: (
    contextPackage: ContextPackage,
    options: RenderOptions,
  ) => Promise<void>;
  onExport: (contextPackage: ContextPackage) => Promise<void>;
  onRestoreVersion?: (versionId: string) => Promise<void>;
}

export function PackageDetail({
  contextPackage,
  workspaceName,
  versions = [],
  canRestoreVersions = false,
  onBack,
  onDelete,
  onEdit,
  onInsert,
  onExport,
  onRestoreVersion,
}: PackageDetailProps) {
  const [mode, setMode] = useState<ContextDepth>(contextPackage.depth);
  const [template, setTemplate] = useState<PromptTemplate>("general");
  const [focusQuery, setFocusQuery] = useState("");
  const [includeMessages, setIncludeMessages] = useState(mode !== "brief");
  const [includeNotes, setIncludeNotes] = useState(mode === "full");
  const [includeOpenQuestions, setIncludeOpenQuestions] = useState(
    mode !== "brief",
  );
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [destination, setDestination] = useState("https://chatgpt.com/");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const renderOptions: RenderOptions = {
    mode,
    template,
    focusQuery,
    includeMessages,
    includeNotes,
    includeOpenQuestions,
  };

  const rendered = useMemo(() => {
    return renderContextPackage(contextPackage, renderOptions);
  }, [contextPackage, renderOptions]);

  async function handleInsert() {
    setIsWorking(true);
    try {
      await onInsert(contextPackage, renderOptions);
      setNotice(
        "Context is ready. Check the current prompt or paste from your clipboard. Nothing was sent automatically.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Insertion failed. Copy the preview instead.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rendered);
      setNotice(
        "Copied. Paste into any AI tool with Ctrl+V. Attach original files separately if needed.",
      );
      return true;
    } catch {
      setNotice(
        "Clipboard access failed. Select and copy the text in the preview below.",
      );
      return false;
    }
  }

  async function handleDelete() {
    setIsWorking(true);
    try {
      await onDelete(contextPackage.id);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="panel-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {summarizePlatform(contextPackage.platform)}
          </p>
          <h2>{contextPackage.title}</h2>
        </div>
        <button className="ghost-button" onClick={onBack} type="button">
          Back
        </button>
      </div>

      <section className="transfer-card">
        <p className="eyebrow">Continue somewhere new</p>
        <h3>Carry the context forward.</h3>
        <p className="field-help">
          Your summary, decisions and extracted file text, ready for the next
          conversation.
        </p>
        <div className="capture-actions">
          <button
            className="primary-button"
            disabled={isWorking}
            onClick={() => void handleCopy()}
          >
            Copy context <span aria-hidden="true">↗</span>
          </button>
          <button
            className="ghost-button"
            disabled={isWorking}
            onClick={() => void handleInsert()}
          >
            Insert into Current Tool
          </button>
        </div>
        <div className="destination-row">
          <select
            aria-label="Destination AI tool"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            <option value="https://chatgpt.com/">ChatGPT</option>
            <option value="https://gemini.google.com/app">Gemini</option>
            <option value="https://claude.ai/new">Claude</option>
            <option value="https://copilot.microsoft.com/">Copilot</option>
          </select>
          <button
            className="ghost-button"
            onClick={async () => {
              if (await handleCopy()) {
                try {
                  await chrome.tabs.create({ url: destination });
                  setNotice(
                    "New tool opened. Paste with Ctrl+V, then attach any original files you need.",
                  );
                } catch {
                  setNotice(
                    "Context copied. Open the destination tool and paste with Ctrl+V.",
                  );
                }
              }
            }}
          >
            Copy & open
          </button>
        </div>
        {notice && (
          <p className="inline-notice" role="status">
            {notice}
          </p>
        )}
      </section>

      <div className="info-grid">
        <div className="info-card">
          <span>Messages</span>
          <strong>{contextPackage.messages.length}</strong>
        </div>
        <div className="info-card">
          <span>Updated</span>
          <strong>
            {new Date(contextPackage.updatedAt).toLocaleDateString()}
          </strong>
        </div>
        <div className="info-card">
          <span>Tokens</span>
          <strong>~{estimateTokens(rendered)}</strong>
        </div>
        <div className="info-card">
          <span>Version</span>
          <strong>v{contextPackage.currentVersion ?? 1}</strong>
        </div>
      </div>

      <div className="detail-card">
        <p>{contextPackage.summary}</p>
        {workspaceName && (
          <p>
            Workspace: <strong>{workspaceName}</strong>
          </p>
        )}
      </div>

      <div className="field-grid">
        <BulletCard title="Key Decisions" items={contextPackage.keyDecisions} />
        <BulletCard title="Constraints" items={contextPackage.constraints} />
      </div>

      {!!contextPackage.openQuestions.length && (
        <BulletCard
          title="Open Questions"
          items={contextPackage.openQuestions}
        />
      )}

      {!!contextPackage.sensitiveFindings.length && (
        <div className="warning-card">
          <strong>Sensitive content flagged</strong>
          <ul className="inline-list">
            {contextPackage.sensitiveFindings.map((item) => (
              <li key={item.type}>
                {item.label} ({item.severity})
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="field">
        <span>Insert Mode</span>
        <select
          aria-label="Insert Mode"
          value={mode}
          onChange={(event) => {
            const next = event.target.value as ContextDepth;
            setMode(next);
            setIncludeMessages(next !== "brief");
            setIncludeOpenQuestions(next !== "brief");
            setIncludeNotes(next === "full");
          }}
        >
          <option value="brief">Brief</option>
          <option value="detailed">Detailed</option>
          <option value="full">Full — complete saved transcript</option>
        </select>
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Prompt Template</span>
          <select
            aria-label="Prompt Template"
            value={template}
            onChange={(event) =>
              setTemplate(event.target.value as PromptTemplate)
            }
          >
            <option value="general">General</option>
            <option value="implementation">Implementation</option>
            <option value="debug">Debug</option>
            <option value="handoff">Handoff</option>
            <option value="planning">Planning</option>
          </select>
        </label>
        <label className="field">
          <span>Focus Query</span>
          <input
            value={focusQuery}
            onChange={(event) => setFocusQuery(event.target.value)}
            placeholder="Focus on auth bugs, deployment, API design..."
          />
        </label>
      </div>

      <div className="checkbox-row">
        <label className="checkbox-chip">
          <input
            checked={includeMessages}
            onChange={(event) => setIncludeMessages(event.target.checked)}
            type="checkbox"
          />
          Include messages
        </label>
        <label className="checkbox-chip">
          <input
            checked={includeOpenQuestions}
            onChange={(event) => setIncludeOpenQuestions(event.target.checked)}
            type="checkbox"
          />
          Include open questions
        </label>
        <label className="checkbox-chip">
          <input
            checked={includeNotes}
            onChange={(event) => setIncludeNotes(event.target.checked)}
            type="checkbox"
          />
          Include notes
        </label>
      </div>

      <div className="preview-card">
        <div className="section-heading">
          <h3>Rendered Context</h3>
          <button className="ghost-button" onClick={handleCopy} type="button">
            Copy
          </button>
        </div>
        <textarea
          className="rendered-preview"
          aria-label="Context preview"
          readOnly
          rows={10}
          value={rendered}
        />
      </div>

      {!!contextPackage.assets?.length && (
        <Attachments assets={contextPackage.assets} />
      )}

      {!!versions.length && (
        <div className="detail-card">
          <div className="section-heading">
            <h3>Version History</h3>
          </div>
          <div className="version-list">
            {versions.map((version) => (
              <div key={version.id} className="version-row">
                <div>
                  <strong>v{version.versionNumber}</strong>
                  <p>{new Date(version.createdAt).toLocaleString()}</p>
                  <p>
                    {version.summary || version.title || "No summary captured."}
                  </p>
                </div>
                {canRestoreVersions &&
                onRestoreVersion &&
                version.versionNumber !== contextPackage.currentVersion ? (
                  <button
                    className="ghost-button"
                    disabled={isWorking}
                    onClick={() => void onRestoreVersion(version.id)}
                    type="button"
                  >
                    Restore
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="action-row">
        <button
          className="ghost-button"
          disabled={isWorking}
          onClick={() => onEdit(contextPackage)}
          type="button"
        >
          Edit
        </button>
        <button
          className="ghost-button"
          disabled={isWorking}
          onClick={async () => {
            setIsWorking(true);
            try {
              await onExport(contextPackage);
            } finally {
              setIsWorking(false);
            }
          }}
          type="button"
        >
          Export JSON
        </button>
        <button
          className="ghost-button"
          disabled={isWorking}
          onClick={() =>
            downloadBlob(
              new Blob([rendered], { type: "text/markdown" }),
              `${contextPackage.title}.md`,
            )
          }
        >
          Export Markdown
        </button>
        <button
          className="ghost-button danger-button"
          disabled={isWorking}
          onClick={() =>
            confirmDelete ? void handleDelete() : setConfirmDelete(true)
          }
          type="button"
        >
          {confirmDelete ? "Confirm delete" : "Delete"}
        </button>
        {confirmDelete && (
          <button
            className="ghost-button"
            onClick={() => setConfirmDelete(false)}
          >
            Keep package
          </button>
        )}
      </div>
    </section>
  );
}

interface BulletCardProps {
  title: string;
  items: string[];
}

function BulletCard({ title, items }: BulletCardProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="detail-card">
      <h3>{title}</h3>
      <ul className="inline-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
