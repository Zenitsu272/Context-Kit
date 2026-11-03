import { useEffect, useRef, useState } from "react";
import {
  getGeminiSettings,
  saveGeminiSettings,
  testGeminiConnection,
} from "../api/gemini";
import {
  defaultGeminiSettings,
  GEMINI_ORIGIN,
  parseGeminiEnv,
} from "../core/gemini";
import { getActiveDraft, getPackages } from "../storage/local-cache";
import { removeUnusedAssetBlobs } from "../storage/assets";

export function GeminiSettings() {
  const [settings, setSettings] = useState(defaultGeminiSettings);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void getGeminiSettings()
      .then((value) => {
        setSettings(value);
        setLoaded(true);
      })
      .catch(() =>
        setNotice("Settings could not be loaded. Reopen the panel."),
      );
  }, []);

  async function save() {
    setBusy(true);
    try {
      // Called directly from a click, so Edge can present its optional permission prompt.
      if (
        settings.enabled &&
        !(await chrome.permissions.request({ origins: [GEMINI_ORIGIN] }))
      ) {
        throw new Error(
          "Google API access was not enabled. Local features still work.",
        );
      }
      const parsed = parseGeminiEnv(keyInput);
      const next = {
        ...settings,
        model: parsed.model || settings.model.trim(),
        keys: keyInput.trim() ? parsed.keys : settings.keys,
        health: {},
        preferred: 0,
      };
      if (!/^[a-zA-Z0-9._-]+$/.test(next.model))
        throw new Error("Enter a valid Gemini model ID.");
      if (next.enabled && !next.keys.length)
        throw new Error("Add at least one key, or switch Gemini off.");
      await saveGeminiSettings(next);
      setSettings(next);
      setKeyInput("");
      setNotice(
        `Settings saved. ${next.keys.length} key${next.keys.length === 1 ? "" : "s"} stored on this device.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setNotice("Testing saved keys…");
    try {
      const result = await testGeminiConnection();
      setNotice(
        result.ok
          ? `Connected using key ${result.keyIndex + 1}. Gemini is ready.`
          : result.reason,
      );
      setSettings(await getGeminiSettings());
    } catch {
      setNotice("Connection test failed. Local features still work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-shell settings-panel">
      <div>
        <p className="eyebrow">An optional helping hand</p>
        <h2>Gemini intelligence</h2>
      </div>
      <p className="muted">
        Turn conversations into concise handoffs, read images and scanned PDFs,
        or summarize short videos. Local capture and transfer work without a
        key.
      </p>
      <label className="setting-toggle">
        <span>
          <strong>Enable Gemini</strong>
          <small>Runs only when you choose an AI action.</small>
        </span>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={busy || !loaded}
          onChange={(event) =>
            setSettings({ ...settings, enabled: event.target.checked })
          }
        />
      </label>
      <div className="tip-card">
        <strong>Your choice, your data</strong>
        <p>
          “Enhance with Gemini” sends the draft text and extracted attachment
          text to Google, with common secrets redacted. “Read with Gemini” sends
          the selected original file without redaction. Google’s API terms and
          your project’s billing apply.
        </p>
      </div>
      <label className="field">
        <span>Gemini model</span>
        <input
          value={settings.model}
          disabled={busy || !loaded}
          onChange={(event) =>
            setSettings({ ...settings, model: event.target.value })
          }
          placeholder="gemini-3.5-flash-lite"
        />
      </label>
      <label className="field">
        <span>API keys</span>
        <textarea
          aria-label="API keys"
          className="secret-input"
          autoComplete="off"
          spellCheck={false}
          rows={4}
          value={keyInput}
          disabled={busy || !loaded}
          onChange={(event) => setKeyInput(event.target.value)}
          placeholder={
            settings.keys.length
              ? `${settings.keys.length} keys saved. Paste to replace, or leave blank to keep them.`
              : "One key per line, or paste GEMINI_API_KEY_1=…\nGEMINI_API_KEY_2=…"
          }
        />
      </label>
      <p className="field-help">
        Up to 8 keys, tried in order with automatic failover and cooldowns. Keys
        in the same Google project share its quota. Keys stay in this Edge
        profile; backups never include them.
      </p>
      <div className="action-row">
        <button
          className="ghost-button"
          disabled={busy || !loaded}
          onClick={() => fileInput.current?.click()}
        >
          Import .env
        </button>
        <button
          className="primary-button"
          disabled={busy || !loaded}
          onClick={() => void save()}
        >
          Save settings
        </button>
        <button
          className="ghost-button"
          disabled={busy || !loaded || !settings.keys.length}
          onClick={() => void test()}
        >
          Test saved keys
        </button>
      </div>
      {!!settings.keys.length && (
        <div className="key-health">
          {settings.keys.map((_, index) => (
            <span className="tag-chip" key={index}>
              Key {index + 1} ·{" "}
              {(settings.health[index]?.retryAt ?? 0) > Date.now()
                ? "cooling down"
                : "available"}
            </span>
          ))}
        </div>
      )}
      <p className="field-help">
        Save settings to reset cooldowns after replacing or fixing a key.
        Availability is confirmed by a successful request.
      </p>
      <input
        hidden
        ref={fileInput}
        type="file"
        aria-label="Import Gemini environment file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            if (file.size > 64000)
              throw new Error("Choose a small .env text file (under 64 KB).");
            const text = await file.text();
            const parsed = parseGeminiEnv(text);
            if (!parsed.keys.length)
              throw new Error("No GEMINI_API_KEY entries found.");
            setKeyInput(parsed.keys.join("\n"));
            if (parsed.model)
              setSettings((current) => ({ ...current, model: parsed.model! }));
            setNotice(
              `Loaded ${parsed.keys.length} keys. Choose Save settings to apply them.`,
            );
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : "Could not read the file.",
            );
          }
        }}
      />
      <div className="action-row">
        <button
          className="text-button danger-button"
          disabled={busy || !loaded}
          onClick={async () => {
            setBusy(true);
            try {
              const next = defaultGeminiSettings();
              await saveGeminiSettings(next);
              await chrome.permissions.remove({ origins: [GEMINI_ORIGIN] });
              setSettings(next);
              setKeyInput("");
              setNotice("Keys removed. Gemini is off.");
            } catch {
              setNotice("Could not remove keys. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Remove all keys
        </button>
      </div>
      {notice && (
        <p className="inline-notice" role="status">
          {notice}
        </p>
      )}
      <div className="section-divider" />
      <h3>Local storage</h3>
      <p className="muted">
        Packages live on this device. Export a backup to keep a copy of your
        conversations and original files.
      </p>
      <button
        className="ghost-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const [packages, draft] = await Promise.all([
              getPackages(),
              getActiveDraft(),
            ]);
            const keep = new Set(
              [
                ...packages.flatMap((item) => item.assets ?? []),
                ...(draft?.assets ?? []),
              ].map((asset) => asset.id),
            );
            await removeUnusedAssetBlobs(keep);
            setNotice(
              "Removed unattached file copies older than 24 hours. Saved packages, your draft and recent files were kept.",
            );
          } catch {
            setNotice("Could not clean up files. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Clean up unattached files
      </button>
    </section>
  );
}
