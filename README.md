# Context Kit

Context Kit is a Manifest V3 browser extension that saves AI conversations as reusable Context Packages and inserts curated context back into supported AI tools.

Useful project docs:

- [Execution backlog](docs/DEVELOPMENT_BACKLOG.md)
- [Phase 1 QA checklist](docs/PHASE1_QA_CHECKLIST.md)
- [Backend scaffold](backend/README.md)
- [Privacy draft](docs/PRIVACY_POLICY_DRAFT.md)
- [Permissions note](docs/PERMISSIONS_JUSTIFICATION.md)
- [Security and retention](docs/SECURITY_AND_RETENTION.md)
- [Chrome Web Store launch checklist](docs/CHROME_WEB_STORE_LAUNCH_CHECKLIST.md)
- [Store listing draft](docs/STORE_LISTING_DRAFT.md)
- [Publishing status](docs/PUBLISHING_STATUS.md)

## What is included

- Manifest V3 extension scaffold using Vite, React, and TypeScript
- Chrome side panel UI for local package management
- Supported page detection for ChatGPT and Gemini
- Conversation extraction hooks for ChatGPT and Gemini
- Local-only Context Package storage with import/export JSON
- Render-and-insert flow back into the current supported AI tool
- Basic sensitive-content warning pass
- FastAPI backend with local-dev auth, health, audit logging, and context package CRUD/import routes
- Extension cloud sign-in and cloud-backed save/list/update/delete flows
- Workspace creation, switching, member invites, and workspace-scoped package sharing
- Package version history with restore support in the extension
- Search, filters, and heuristic relevance ranking for package discovery
- Auto-structure suggestions, related-package matching, and save-as-new-version guidance
- Prompt templates, focus-based message selection, and smarter insertion preview
- Expanded sensitive-content scanning and one-click redaction
- Store-safe build pipeline, screenshot automation, and Chrome Web Store submission docs

## Frontend development

Prerequisites:

- Node.js with npm
- Google Chrome for the Playwright smoke tests
- On Windows PowerShell, use `npm.cmd` if `npm` is blocked by script execution policy

```bash
npm install
npm run build
```

Load the extension locally:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the `dist` folder from this project
5. Open ChatGPT or Gemini and click the Context Kit extension icon

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

## Store builds

```bash
npm run build:store
npm run package:store
npm run capture:store-assets
```

Before packaging for a store:

- copy [.env.store.example](.env.store.example) to `.env.store.local` and replace the placeholder public URLs
- run `npm run test:store` to verify the Chrome Web Store manifest does not include localhost permissions
- run `npm run test:edge` to verify the Edge Add-ons manifest does not include localhost permissions
- host the static pages in [site](site) or replace them with your own public site before submission

## Smoke tests

```bash
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:store
npm run test:edge
```

The phase smoke tests launch a real Chrome instance through Playwright, load the built extension from `dist/`, and interact with live ChatGPT or Gemini pages. Run `npm run build` first. Phase 2 and later also expect the backend virtual environment at `backend/.venv`.

## Known flaws found during local audit

- `npm audit --audit-level=moderate` currently reports 5 vulnerabilities: vulnerable `postcss`, `rollup` through `@crxjs/vite-plugin`, and `esbuild` through Vite. Some fixes may require a breaking Vite/CRX plugin upgrade.
- `npm run test:phase1` failed locally because the Context Kit service worker did not appear in Chrome within the script timeout. Store and Edge manifest verification still pass.
- Several docs outside this README still contain old machine-specific `D:/Vaishak Files/context_bridge` links and should be converted to relative links.

## Current boundaries

- Production auth providers, database migrations, and embedding-backed semantic search are not implemented yet
- Extraction relies on DOM selectors and may need tuning as site markup changes
- Local dev auth is intentionally lightweight and not production-grade
- Workspace invites are local-dev API invites, not email-delivery invites yet
- The Chrome Web Store build intentionally disables cloud sync until a production backend and public privacy/support URLs are ready
