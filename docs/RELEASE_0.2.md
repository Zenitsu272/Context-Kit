# Context Kit 0.2 — portable conversation memory

Save your conversation and its supporting files, then continue in another AI tool.

## Included

- Cream-and-terracotta Edge sidebar with library search, compact capture and separate settings.
- Quick save, duplicate prevention, draft recovery and preservation of code formatting and repeated turns.
- Full transcript transfer, contextual copy, copy-and-open destinations, safe prompt insertion and Markdown export.
- Local PDF/text extraction, original files in IndexedDB, individual imports of detected file links, and JSON backups containing original bytes.
- Optional Gemini summaries and image/scanned-PDF/short-video reading with up to eight keys, `.env` import, failover, cooldowns and local fallback.
- Validated imports, sensitive-text scanning/redaction, optional per-origin network access and no credentials in backups or distributed builds.

## Install or update in Edge

Download and extract `context-kit-edge-addons-0.2.0.zip`. In `edge://extensions`, enable Developer mode and choose **Load unpacked**, selecting the extracted folder containing `manifest.json`.

For an existing checkout installation, build with `npm run build:edge` and reload Context Kit using the same `dist/` folder. Keeping the same installation preserves your local library; export a backup before changing its location or uninstalling it.

In **Settings**, import your own `.env` file or paste keys, enable Gemini, save settings and test the connection. The model ID is editable. See the [README](../README.md) for configuration and transfer instructions.

## Boundaries

Files are limited to 20 MB each, 60 MB per package/backup and 40 attachments per package. Gemini file reading is limited to 8 MB per request. Local PDF reading is capped at 200 pages/120,000 characters with a visible truncation warning. Content from files is included in copied context; uploading actual binary files to the next tool remains a separate user action.

Only loaded conversation messages can be captured. Login-protected, redirected or expired file links may need manual attachment. Gemini extraction is fallible and should be reviewed. Local features work without Gemini. Development cloud synchronization remains disabled in the release.

Automated Gemini tests use mocked responses and permission outcomes; they verify request handling, failover and fallback, not a live account's credentials or model quota. This downloadable release is not a certified Microsoft Edge Add-ons listing.
