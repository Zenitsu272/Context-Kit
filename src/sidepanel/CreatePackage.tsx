import { useEffect, useMemo, useRef, useState } from "react";
import { Attachments } from "./Attachments";
import { enhanceDraft } from "../api/gemini";
import { renderContextPackage } from "../core/render";
import {
  materializePackage,
  parseTranscript,
  redactDraftSensitiveContent,
  rescanDraft,
  serializeMessages,
  summarizePlatform,
} from "../core/context";
import {
  findRelatedPackages,
  refreshDraftInsights,
  type RelatedPackageSuggestion,
} from "../core/intelligence";
import type { ContextDraft, ContextPackage } from "../types/context-package";

interface CreatePackageProps {
  draft: ContextDraft;
  existingPackage?: ContextPackage;
  availablePackages?: ContextPackage[];
  onCancel: () => void;
  onDraftChange: (draft: ContextDraft) => void;
  onSave: (draft: ContextDraft) => Promise<void>;
  onUseExistingPackage?: (
    contextPackage: ContextPackage,
    currentDraft: ContextDraft,
  ) => void;
}

export function CreatePackage({
  draft,
  existingPackage,
  availablePackages = [],
  onCancel,
  onDraftChange,
  onSave,
  onUseExistingPackage,
}: CreatePackageProps) {
  const [localDraft, setLocalDraft] = useState<ContextDraft>(draft);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [assetsBusy, setAssetsBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const autosave = useRef<number>();
  const [transcriptText, setTranscriptText] = useState(() =>
    serializeMessages(draft.messages),
  );

  useEffect(() => {
    setLocalDraft(draft);
    setTranscriptText(serializeMessages(draft.messages));
  }, [draft]);

  useEffect(() => {
    autosave.current = window.setTimeout(() => {
      onDraftChange(localDraft);
    }, 250);

    return () => window.clearTimeout(autosave.current);
  }, [localDraft, onDraftChange]);

  const preview = useMemo(() => {
    return renderContextPackage(
      materializePackage(localDraft, {
        id: "preview",
        capturedAt: new Date(0).toISOString(),
      }),
      {
        mode: localDraft.depth,
      },
    );
  }, [localDraft]);

  const relatedPackages = useMemo<RelatedPackageSuggestion[]>(() => {
    return findRelatedPackages(
      localDraft,
      availablePackages,
      existingPackage?.id,
    );
  }, [availablePackages, existingPackage?.id, localDraft]);

  async function handleSave() {
    if (
      !localDraft.summary.trim() &&
      !localDraft.messages.length &&
      !localDraft.assets?.length &&
      !localDraft.notes.trim()
    ) {
      setNotice(
        "Add conversation text, a summary, notes or a file before saving.",
      );
      return;
    }
    window.clearTimeout(autosave.current);
    setIsSaving(true);
    try {
      await onSave(rescanDraft(localDraft));
    } finally {
      setIsSaving(false);
    }
  }

  function goBack() {
    onDraftChange(localDraft);
    onCancel();
  }

  return (
    <section className="panel-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Review Context</p>
          <h2>Create Context Package</h2>
        </div>
        <button
          className="ghost-button"
          disabled={isSaving || isEnhancing || assetsBusy}
          onClick={goBack}
          type="button"
        >
          Back
        </button>
      </div>
      {notice && (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      )}
      <fieldset
        className="editor-fields"
        disabled={isSaving || isEnhancing || assetsBusy}
      >
        {existingPackage && (
          <div className="tip-card">
            <strong>Updating a saved conversation</strong>
            <p>
              This draft is targeting <strong>{existingPackage.title}</strong>.
              Saving will create an updated package. Local edits replace the
              previous contents; export a backup to keep that copy.
            </p>
          </div>
        )}

        <div className="info-grid">
          <div className="info-card">
            <span>Source</span>
            <strong>{summarizePlatform(localDraft.platform)}</strong>
          </div>
          <div className="info-card">
            <span>Messages</span>
            <strong>{localDraft.messages.length}</strong>
          </div>
          <div className="info-card">
            <span>Default Mode</span>
            <strong>{capitalize(localDraft.depth)}</strong>
          </div>
          <div className="info-card">
            <span>Extraction Confidence</span>
            <strong>{capitalize(localDraft.extractionConfidence)}</strong>
          </div>
        </div>

        {localDraft.sensitiveFindings.length > 0 && (
          <div className="warning-card">
            <strong>Sensitive content warning</strong>
            <p>Review the content before saving. The scanner found:</p>
            <ul className="inline-list">
              {localDraft.sensitiveFindings.map((item) => (
                <li key={item.type}>
                  {item.label} ({item.severity})
                </li>
              ))}
            </ul>
          </div>
        )}

        {localDraft.reviewWarnings.length > 0 && (
          <div className="tip-card">
            <strong>Review before saving</strong>
            <ul className="inline-list">
              {localDraft.reviewWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {!!relatedPackages.length && !existingPackage && (
          <div className="tip-card">
            <strong>Related packages found</strong>
            <ul className="inline-list">
              {relatedPackages.map((item) => (
                <li key={item.contextPackage.id}>
                  <span>
                    {item.contextPackage.title} ({item.reasons.join(", ")})
                  </span>
                  {onUseExistingPackage ? (
                    <button
                      className="ghost-button"
                      onClick={() =>
                        onUseExistingPackage(item.contextPackage, localDraft)
                      }
                      type="button"
                    >
                      Save as New Version
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        <label className="field">
          <span>Title</span>
          <input
            value={localDraft.title}
            onChange={(event) =>
              setLocalDraft({ ...localDraft, title: event.target.value })
            }
            placeholder="Give this conversation a name"
          />
        </label>

        <div className="ai-toolbar">
          <div>
            <strong>A clearer handoff</strong>
            <p className="field-help">
              Gemini can organize this draft. Original messages are kept.
            </p>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={async () => {
              setIsEnhancing(true);
              setNotice("Enhancing with Gemini…");
              try {
                const result = await enhanceDraft(localDraft);
                if (result.ok) {
                  setLocalDraft(
                    rescanDraft({ ...localDraft, ...result.value }),
                  );
                  setNotice(
                    `Enhanced using key ${result.keyIndex + 1}. Review the suggested summary and decisions.`,
                  );
                } else
                  setNotice(
                    `${result.reason} Use Auto-Structure for local suggestions.`,
                  );
              } catch {
                setNotice(
                  "Gemini could not complete the request. Your draft is unchanged; Auto-Structure still works locally.",
                );
              } finally {
                setIsEnhancing(false);
              }
            }}
          >
            {isEnhancing ? "Enhancing…" : "Enhance with Gemini"}
          </button>
        </div>

        <label className="field">
          <span>Summary</span>
          <textarea
            rows={5}
            aria-label="Summary"
            value={localDraft.summary}
            onChange={(event) =>
              setLocalDraft({ ...localDraft, summary: event.target.value })
            }
            placeholder="Short project summary"
          />
        </label>

        <div className="field-grid">
          <ListEditor
            label="Key Decisions"
            items={localDraft.keyDecisions}
            onChange={(items) =>
              setLocalDraft({ ...localDraft, keyDecisions: items })
            }
          />
          <ListEditor
            label="Constraints"
            items={localDraft.constraints}
            onChange={(items) =>
              setLocalDraft({ ...localDraft, constraints: items })
            }
          />
        </div>

        <div className="field-grid">
          <ListEditor
            label="Open Questions"
            items={localDraft.openQuestions}
            onChange={(items) =>
              setLocalDraft({ ...localDraft, openQuestions: items })
            }
          />
          <ListEditor
            label="Tags"
            items={localDraft.tags}
            onChange={(items) => setLocalDraft({ ...localDraft, tags: items })}
            placeholder="One tag per line"
          />
        </div>

        <label className="field">
          <span>Transcript / Message Fallback</span>
          <textarea
            rows={8}
            aria-label="Transcript / Message Fallback"
            value={transcriptText}
            onChange={(event) => {
              const nextText = event.target.value;
              setTranscriptText(nextText);
              setLocalDraft({
                ...localDraft,
                messages: parseTranscript(nextText),
              });
            }}
            placeholder={
              "USER: We need to support 40 cameras.\n\nASSISTANT: We can keep motion detection local."
            }
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={4}
            aria-label="Notes"
            value={localDraft.notes}
            onChange={(event) =>
              setLocalDraft({ ...localDraft, notes: event.target.value })
            }
            placeholder="Extra context, reminders, or cleanup notes"
          />
        </label>

        <Attachments
          assets={localDraft.assets}
          onBusyChange={setAssetsBusy}
          onChange={(assets) =>
            setLocalDraft((current) => rescanDraft({ ...current, assets }))
          }
        />

        <label className="field">
          <span>Render Depth</span>
          <select
            value={localDraft.depth}
            onChange={(event) =>
              setLocalDraft({
                ...localDraft,
                depth: event.target.value as ContextPackage["depth"],
              })
            }
          >
            <option value="brief">Brief</option>
            <option value="detailed">Detailed</option>
            <option value="full">Full</option>
          </select>
        </label>

        <div className="preview-card">
          <div className="section-heading">
            <h3>Preview</h3>
            <div className="action-row action-row--tight">
              <button
                className="ghost-button"
                onClick={() => setLocalDraft(refreshDraftInsights(localDraft))}
                type="button"
              >
                Auto-Structure
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  const redacted = redactDraftSensitiveContent(localDraft);
                  setLocalDraft(redacted);
                  setTranscriptText(serializeMessages(redacted.messages));
                  setNotice(
                    "Text redacted. Original attached files are unchanged; remove them before sharing if they contain secrets.",
                  );
                }}
                type="button"
              >
                Auto-Redact
              </button>
              <button
                className="ghost-button"
                onClick={() => setLocalDraft(rescanDraft(localDraft))}
                type="button"
              >
                Refresh Scan
              </button>
            </div>
          </div>
          <pre>{preview}</pre>
        </div>
      </fieldset>

      <div className="action-row sticky-actions">
        <button
          className="ghost-button"
          disabled={isSaving || isEnhancing || assetsBusy}
          onClick={goBack}
          type="button"
        >
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={isSaving || isEnhancing || assetsBusy}
          onClick={handleSave}
          type="button"
        >
          {isSaving ? "Saving..." : "Save Context Package"}
        </button>
      </div>
    </section>
  );
}

interface ListEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

function ListEditor({ label, items, onChange, placeholder }: ListEditorProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={5}
        aria-label={label}
        value={items.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n"))}
        placeholder={placeholder ?? "One item per line"}
      />
    </label>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
