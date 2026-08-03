# Context Kit

Phase 1 MVP scaffold for a Chrome extension that saves AI conversations as reusable Context Packages.

Execution backlog: [docs/DEVELOPMENT_BACKLOG.md](D:/Vaishak%20Files/context_bridge/docs/DEVELOPMENT_BACKLOG.md)
Phase 1 QA checklist: [docs/PHASE1_QA_CHECKLIST.md](D:/Vaishak%20Files/context_bridge/docs/PHASE1_QA_CHECKLIST.md)
Backend scaffold: [backend/README.md](D:/Vaishak%20Files/context_bridge/backend/README.md)
Privacy draft: [docs/PRIVACY_POLICY_DRAFT.md](D:/Vaishak%20Files/context_bridge/docs/PRIVACY_POLICY_DRAFT.md)
Permissions note: [docs/PERMISSIONS_JUSTIFICATION.md](D:/Vaishak%20Files/context_bridge/docs/PERMISSIONS_JUSTIFICATION.md)
Security and retention: [docs/SECURITY_AND_RETENTION.md](D:/Vaishak%20Files/context_bridge/docs/SECURITY_AND_RETENTION.md)
Launch checklist: [docs/CHROME_WEB_STORE_LAUNCH_CHECKLIST.md](D:/Vaishak%20Files/context_bridge/docs/CHROME_WEB_STORE_LAUNCH_CHECKLIST.md)
Listing draft: [docs/STORE_LISTING_DRAFT.md](D:/Vaishak%20Files/context_bridge/docs/STORE_LISTING_DRAFT.md)
Publishing status: [docs/PUBLISHING_STATUS.md](D:/Vaishak%20Files/context_bridge/docs/PUBLISHING_STATUS.md)

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

## Local development

```bash
npm install
npm run build
npm run build:store
npm run package:store
npm run capture:store-assets
npm run test:phase1
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:store
```

## Backend Development

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload
```

Then sign in from the extension using:

- API Base URL: `http://127.0.0.1:8000`
- any email address for local-dev login

## Load in Chrome

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the `dist` folder from this project
5. Open ChatGPT or Gemini and click the Context Kit extension icon

## Store Build

- copy [.env.store.example](D:/Vaishak%20Files/context_bridge/.env.store.example) to `.env.store.local` and replace the placeholder public URLs
- run `npm run package:store` to create a publish-safe zip in `release/`
- run `npm run capture:store-assets` to generate listing screenshots in `release/store-assets/`
- host the static pages in [site](D:/Vaishak%20Files/context_bridge/site) or replace them with your own public site before submission

## Current boundaries

- Production auth providers, database migrations, and embedding-backed semantic search are not implemented yet
- Extraction relies on DOM selectors and may need tuning as site markup changes
- Local dev auth is intentionally lightweight and not production-grade
- Workspace invites are local-dev API invites, not email-delivery invites yet
- The Chrome Web Store build intentionally disables cloud sync until a production backend and public privacy/support URLs are ready
