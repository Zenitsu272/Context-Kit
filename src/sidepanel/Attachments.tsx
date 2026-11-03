import { useRef, useState } from "react";
import type { ContextAsset } from "../types/context-package";
import { attachFile, downloadAsset } from "../storage/assets";
import { extractAssetWithGemini } from "../api/gemini";
import { importLinkedFile } from "../api/linked-file";
import { GEMINI_FILE_TYPES } from "../core/gemini";

export function Attachments({
  assets = [],
  onChange,
  onBusyChange,
}: {
  assets?: ContextAsset[];
  onChange?: (assets: ContextAsset[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const updateBusy = (value: string) => {
    setBusy(value);
    onBusyChange?.(!!value);
  };
  async function addFiles(files: FileList | null) {
    if (!files?.length || !onChange) return;
    updateBusy("Reading files…");
    setNotice("");
    const next = [...assets];
    try {
      if (next.length + files.length > 40)
        throw new Error("Use up to 40 attachments in a package.");
      if (
        next.reduce((sum, asset) => sum + asset.size, 0) +
          [...files].reduce((sum, file) => sum + file.size, 0) >
        60 * 1024 * 1024
      )
        throw new Error("Keep each package under 60 MB of attachments.");
      for (const file of files) {
        next.push(await attachFile(file));
        onChange([...next]);
      }
      setNotice(
        "Files saved locally. Extracted text will be included when you copy context.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not attach these files.",
      );
    } finally {
      updateBusy("");
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="attachments">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bring the source along</p>
          <h3>
            Files & images <span className="count">{assets.length}</span>
          </h3>
        </div>
        {onChange && (
          <button
            className="ghost-button"
            disabled={!!busy}
            onClick={() => input.current?.click()}
          >
            Attach files
          </button>
        )}
      </div>
      {onChange && (
        <p className="field-help">
          PDF text is read locally. Add files up to 20 MB each. Read images,
          scanned PDFs and short videos with Gemini (up to 8 MB). Original files
          can be downloaded for upload to another tool.
        </p>
      )}
      <input
        ref={input}
        hidden
        type="file"
        multiple
        aria-label="Attach files"
        onChange={(event) => void addFiles(event.target.files)}
      />
      <div className="asset-list">
        {assets.map((asset) => (
          <article className="asset-card" key={asset.id}>
            <div className="asset-heading">
              <span className="file-icon" aria-hidden="true">
                {asset.mimeType.startsWith("image/")
                  ? "▧"
                  : asset.mimeType.startsWith("video/")
                    ? "▷"
                    : "▤"}
              </span>
              <div>
                <strong>{asset.name}</strong>
                <small>
                  {asset.source === "local"
                    ? `${formatBytes(asset.size)} · Original saved`
                    : "Source link"}
                  {asset.text
                    ? ` · ${asset.extraction === "gemini" ? "AI-read" : "Text ready"}`
                    : ""}
                </small>
              </div>
            </div>
            {asset.warning && <p className="field-help">{asset.warning}</p>}
            <div className="action-row action-row--tight">
              {onChange &&
                asset.source === "reference" &&
                asset.sourceUrl?.startsWith("https://") && (
                  <button
                    className="text-button"
                    disabled={!!busy}
                    onClick={async () => {
                      updateBusy(`Importing ${asset.name}…`);
                      setNotice("");
                      try {
                        if (
                          assets.reduce((sum, item) => sum + item.size, 0) >
                          40 * 1024 * 1024
                        )
                          throw new Error(
                            "Keep each package under 60 MB. Attach a smaller file manually.",
                          );
                        const imported = await importLinkedFile(asset);
                        onChange(
                          assets.map((item) =>
                            item.id === asset.id ? imported : item,
                          ),
                        );
                        setNotice(
                          "Original imported. Readable PDF text is ready to transfer.",
                        );
                      } catch (error) {
                        setNotice(
                          error instanceof Error
                            ? error.message
                            : "File import failed. Attach it manually instead.",
                        );
                      } finally {
                        updateBusy("");
                      }
                    }}
                  >
                    Import file
                  </button>
                )}
              {asset.source === "local" ? (
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={async () => {
                    try {
                      await downloadAsset(asset);
                      setNotice(
                        "Original downloaded. Attach it to the next AI tool.",
                      );
                    } catch (error) {
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : "Download failed.",
                      );
                    }
                  }}
                >
                  Download original
                </button>
              ) : asset.sourceUrl && /^https?:\/\//i.test(asset.sourceUrl) ? (
                <a
                  className="text-button"
                  href={asset.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source ↗
                </a>
              ) : null}
              {onChange &&
                asset.source === "local" &&
                GEMINI_FILE_TYPES.test(asset.mimeType) && (
                  <button
                    className="text-button"
                    disabled={!!busy}
                    onClick={async () => {
                      updateBusy(`Reading ${asset.name} with Gemini…`);
                      setNotice("");
                      try {
                        const result = await extractAssetWithGemini(asset.id);
                        if (!result.ok) {
                          setNotice(result.reason);
                          return;
                        }
                        onChange(
                          assets.map((item) =>
                            item.id === asset.id
                              ? {
                                  ...item,
                                  text: result.value,
                                  extraction: "gemini",
                                  warning:
                                    "AI-extracted content may contain omissions or errors. Review against the original.",
                                }
                              : item,
                          ),
                        );
                        setNotice(
                          "Content extracted. Review the text before sharing.",
                        );
                      } catch (error) {
                        setNotice(
                          error instanceof Error
                            ? error.message
                            : "Reading failed. The original is still saved.",
                        );
                      } finally {
                        updateBusy("");
                      }
                    }}
                  >
                    Read with Gemini
                  </button>
                )}
              {onChange && (
                <button
                  className="text-button danger-button"
                  disabled={!!busy}
                  onClick={() =>
                    onChange(assets.filter((item) => item.id !== asset.id))
                  }
                >
                  Remove
                </button>
              )}
            </div>
            {asset.text && (
              <details>
                <summary>Extracted content</summary>
                {onChange ? (
                  <textarea
                    aria-label={`Extracted text for ${asset.name}`}
                    rows={6}
                    value={asset.text}
                    disabled={!!busy}
                    onChange={(event) =>
                      onChange(
                        assets.map((item) =>
                          item.id === asset.id
                            ? {
                                ...item,
                                text: event.target.value.slice(0, 120000),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                ) : (
                  <pre>{asset.text}</pre>
                )}
              </details>
            )}
          </article>
        ))}
      </div>
      {(busy || notice) && (
        <p className="inline-notice" role="status">
          {busy || notice}
        </p>
      )}
    </section>
  );
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
