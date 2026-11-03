# Context Kit

Context Kit is a Microsoft Edge extension for carrying conversations, documents and images into your next AI chat. Capture a conversation, keep the original files, and copy a useful handoff instead of starting from scratch.

## Version 0.2

- A warm cream, charcoal and terracotta sidebar with a searchable library and separate settings.
- Quick save with duplicate prevention, draft recovery, and review before replacing a changed transcript.
- ChatGPT and Gemini capture that preserves line breaks, code indentation and repeated turns. Full mode includes every saved message; compact modes include the latest work and disclose omissions.
- Copy context, insert into the current supported tool, or copy and open ChatGPT, Gemini, Claude or Copilot. Insertion preserves an existing unsent prompt and never submits it.
- Original files stored locally in IndexedDB. PDF and plain-text content is extracted on-device. Images, scanned PDFs and short MP4/WebM/MOV clips can be read with optional Gemini.
- Detected image, video and document links can be imported individually with permission for that source. Unavailable or protected files can be attached manually.
- Portable JSON backups include original file bytes and extracted text. Import validates the backup and creates copies on ID collisions. Markdown export contains the selected handoff text.
- Optional Gemini enhancement with multiple keys, bounded failover, cooldowns, strict output checks and local fallback. Credentials are never bundled or included in backups.

## Gemini setup

Open **Settings**, paste keys (one per line) or import a `.env` file, enable Gemini, and choose **Save settings**. Edge will ask for access to Google's API. Use **Test saved keys** to verify the connection.

Copy [.env.gemini.example](.env.gemini.example) to the ignored `.env.gemini.local` file:

```dotenv
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_backup_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

`GEMINI_API_KEYS=first_key,second_key` is also supported, up to eight unique keys. Import the file in Settings; it is not automatically read or watched by the build. Never put secrets in `VITE_` variables.

Requests start with the last working key and try available backup keys on rejection, quota errors, network failures, timeouts or unusable output. Failed keys cool down; saving settings resets cooldowns. Keys in the same Google project share its quota. Requests have a 45-second overall budget. If none works, your transcript and files remain intact and local Auto-Structure, PDF extraction, save and copy still work.

The model is editable. The default is [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), which supports text, images, PDFs and video. Live account access, quota and model availability are verified by **Test saved keys**, not by the fixture tests.

Gemini only runs when you click **Enhance with Gemini**, **Read with Gemini**, or **Test saved keys**. Enhancement sends draft text and extracted file text with common secret patterns redacted. File reading sends the selected original file to Google without redaction. Review sensitive files before choosing it. Keys are stored in this Edge profile, restricted to extension contexts; this is not an encrypted credential vault.

## Moving files and their content

1. Capture a supported conversation or choose **Create Manual Context**.
2. Use **Import file** for a detected link or **Attach files** for files on your device.
3. Readable PDF/text content is extracted locally. For images, scans or short videos, choose **Read with Gemini** and review the resulting text.
4. Save the package and choose **Copy context** or **Copy & open**. Extracted content travels with the summary and messages.
5. To send the actual binary file, choose **Download original** and upload it in the destination tool.

| Content | Without Gemini | Optional Gemini action |
| --- | --- | --- |
| Text PDF | Local text extraction | Read visual layout, charts or scans |
| PNG/JPEG/WebP/HEIC/HEIF | Store/download original | Extract text and describe visual content |
| MP4/WebM/MOV | Store/download original | Summarize short clips and spoken content |
| TXT/Markdown/CSV/JSON/code | Local text extraction | Use extracted text in a handoff summary |
| Other documents | Store/download original | Convert to PDF/text for content extraction |

Limits: 20 MB per original, 60 MB of files per package/backup, 40 attachments per package, and 8 MB per Gemini file request. Local PDF extraction stops at 200 pages or 120,000 characters and reports truncation. Images and scanned pages need Gemini for automatic content reading. Binary files cannot be pasted into every AI tool automatically. Links can expire, require login or redirect; manual attachment remains available. Only messages present in the page DOM are captured—load older turns first when needed.

Useful project docs:

- [Execution backlog](docs/DEVELOPMENT_BACKLOG.md)
- [Phase 1 QA checklist](docs/PHASE1_QA_CHECKLIST.md)
- [Backend scaffold](backend/README.md)
- [Privacy draft](docs/PRIVACY_POLICY_DRAFT.md)
- [Permissions note](docs/PERMISSIONS_JUSTIFICATION.md)
- [Security and retention](docs/SECURITY_AND_RETENTION.md)
- [Edge Add-ons launch checklist](docs/EDGE_ADDONS_LAUNCH_CHECKLIST.md)
- [Edge listing draft](docs/EDGE_STORE_LISTING_DRAFT.md)
- [Publishing status](docs/PUBLISHING_STATUS.md)

## What is included

- Manifest V3 extension scaffold using Vite, React, and TypeScript
- Edge side panel UI for local package management
- Supported page detection for ChatGPT and Gemini
- Conversation extraction hooks for ChatGPT and Gemini
- Local Context Package storage with original-file backups
- Render-and-insert flow back into the current supported AI tool
- Basic sensitive-content warning pass
- FastAPI backend with local-dev auth, health, audit logging, and context package CRUD/import routes
- Extension cloud sign-in and cloud-backed save/list/update/delete flows
- Workspace creation, switching, member invites, and workspace-scoped package sharing
- Package version history with restore support in the extension
- Search, filters, and heuristic relevance ranking for package discovery
- Auto-structure suggestions, related-package matching, and update guidance
- Prompt templates, focus-based message selection, and smarter insertion preview
- Expanded sensitive-content scanning and one-click redaction
- Edge-safe build pipeline, screenshot automation, and Microsoft Edge Add-ons submission docs

## Frontend development

Prerequisites:

- Node.js 22.13+ or 24 with npm
- Microsoft Edge for the Playwright smoke tests
- On Windows PowerShell, use `npm.cmd` if `npm` is blocked by script execution policy

```bash
npm ci
npm run build:edge
```

Load the extension locally:

1. Open `edge://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the `dist` folder from this project
5. Open ChatGPT or Gemini and click the Context Kit extension icon

For an existing unpacked installation, rebuild and choose **Reload** on Context Kit in `edge://extensions`. Keep using the same `dist` folder to preserve its extension identity and stored data.

## Backend development

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
copy .env.example .env
uvicorn app.main:app --reload
```

Then sign in from the extension using:

- API Base URL: `http://127.0.0.1:8000`
- any email address for local-dev login

Backend docs live in [backend/README.md](backend/README.md).

## Edge Add-ons builds

```bash
npm run build:edge
npm run package:edge
npm run capture:edge-assets
```

Before packaging for a store:

- optionally copy [.env.store.example](.env.store.example) to `.env.store.local` to override public privacy/support links
- run `npm run test:edge` to verify the Edge Add-ons manifest does not include localhost permissions
- host the static pages in [site](site) or replace them with your own public site before submission

## Smoke tests

```bash
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:edge
npm run test:edge-local
npm run test:core
npm run test:quality
```

The browser smoke tests launch Microsoft Edge through Playwright and load the built extension from `dist/`. Phase 1 uses deterministic ChatGPT/Gemini fixture pages on supported hostnames so the test is not blocked by live-site login or markup changes. Phases 2 and 3 expect the backend virtual environment at `backend/.venv`.

The quality test covers PDF extraction in the packaged extension, image bytes and Gemini output, key failover, safe fallback, linked-file import, backups, copy, capture and narrow sidebar layouts. API responses and permission outcomes are mocked; no test needs a real key or sends private content to Google. Core checks cover error codes, empty/invalid output, timeouts, cooldowns, full transcripts, parsing and backup validation. Phase 2 rebuilds with development cloud enabled; run `build:edge` again afterward.

## Known flaws found during local audit

- `npm audit --audit-level=moderate` currently reports 0 vulnerabilities after the Vite 8 upgrade.
- Some legacy Chrome Web Store docs remain in `docs/` for reference, but the active browser target is Microsoft Edge.
- Several docs outside this README still contain old machine-specific `D:/Vaishak Files/context_bridge` links and should be converted to relative links.

## Current boundaries

- Production auth providers, database migrations, and embedding-backed semantic search are not implemented yet
- Extraction relies on DOM selectors and may need tuning as site markup changes
- Local dev auth is intentionally lightweight and not production-grade
- Workspace invites are local-dev API invites, not email-delivery invites yet
- The Edge Add-ons build intentionally disables cloud sync until a production backend and public privacy/support URLs are ready
- Attachment packages are local-only; development cloud upload is blocked for those packages to avoid losing files
- Local updates replace package contents; historical restore is a development cloud feature. Export a backup before replacing a version you need to keep
- Deleted/removed attachments become eligible for Settings → Clean up unattached files after 24 hours; saved packages and the recovered draft are protected
- A GitHub push or release does not publish the extension to Microsoft Edge Add-ons. Partner Center submission and Microsoft certification remain separate steps
