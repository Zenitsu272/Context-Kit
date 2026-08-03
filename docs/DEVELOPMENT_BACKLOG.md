# Context Kit Development Backlog

This document turns the product plan into an execution backlog for the current codebase.

## Current Status

Completed now:

- Manifest V3 extension scaffold
- React side panel UI
- ChatGPT and Gemini site detection
- Local package storage
- Draft recovery
- Selected-text capture fallback
- JSON export/import
- Prompt rendering and insertion
- Basic sensitive-content scanning
- Extension icons
- Edit flow for saved packages
- Automated Phase 1 smoke test coverage
- FastAPI backend scaffold
- Backend health endpoint
- Backend context package CRUD/import routes
- Local-dev auth session flow
- Extension cloud sign-in and package sync
- Basic audit logging
- Automated Phase 2 cloud smoke coverage
- Workspace creation and switching
- Workspace membership listing and local-dev invites
- Workspace-scoped package visibility and permissions
- Package version history and restore support
- Automated Phase 3 collaboration smoke coverage
- Search, filters, and relevance ranking
- Auto-redaction and expanded sensitive-content scanning
- Related package suggestions and new-version save guidance
- Prompt templates and focus-based insertion preview
- Automated Phase 4 intelligence smoke coverage

Still open inside the current prototype:

- Human exploratory QA on authenticated real-world conversations
- Database migrations
- Embedding-backed semantic search and model-driven structuring
- Production auth and real invite delivery
- Fine-grained share targets beyond team/private workspace visibility

## Phase 1 Finish: Local MVP Stabilization

Goal:

Ship a stable local-only extension that feels reliable for daily internal use.

### Milestone 1.1: Manual QA Pass

Tasks:

- Test save flow on ChatGPT with short, medium, and long conversations
- Test save flow on Gemini with short, medium, and long conversations
- Test selected-text capture on both platforms
- Test insert flow back into ChatGPT
- Test insert flow back into Gemini
- Test unsupported-tab behavior
- Test draft recovery after panel reload and browser restart
- Test import/export JSON round-trip

Exit criteria:

- No blocker failures in save, recover, capture, export, import, or insert flows
- Known issues documented with reproduction notes

### Milestone 1.2: Extraction Hardening

Tasks:

- Add fallback selectors for more ChatGPT message layouts
- Add fallback selectors for more Gemini response layouts
- Improve extraction confidence scoring
- Detect partial extraction and warn the user before save
- Add transcript preview warnings when message count looks suspicious

Exit criteria:

- Extraction works for the common conversation layouts you use internally
- Failed extraction paths clearly guide the user to manual fallback

### Milestone 1.3: UX Polish

Tasks:

- Add extension icons in required Chrome sizes
- Refine empty-state copy and unsupported-site guidance
- Add lightweight success toasts or status banners
- Improve manual transcript editing experience
- Add simple package edit flow after save

Exit criteria:

- Extension feels polished enough for internal non-technical users

## Phase 2: Backend MVP

Goal:

Move from local-only storage to authenticated cloud persistence.

### Milestone 2.1: Backend Scaffold

Tasks:

- Choose backend stack: FastAPI or NestJS
- Create backend service skeleton
- Add environment configuration
- Add health endpoint
- Add local development setup instructions

Exit criteria:

- Backend starts locally and exposes a working health route

### Milestone 2.2: Auth and Identity

Tasks:

- Choose auth provider
- Add login/logout flow
- Add user session validation
- Store minimal auth state in the extension
- Handle logged-out extension UI states

Exit criteria:

- User can authenticate and the extension can make authorized API calls

### Milestone 2.3: Data Model and Persistence

Tasks:

- Create Postgres schema for users, workspaces, packages, versions, messages, tags, and audit logs
- Add database migrations
- Add package create/list/get/update/delete endpoints
- Add version storage structure even if only v1 is used initially
- Add source metadata persistence

Exit criteria:

- Context packages can be created, listed, opened, updated, and deleted from cloud storage

### Milestone 2.4: Extension Sync

Tasks:

- Add API client auth integration
- Add save-to-cloud path from the review screen
- Add package list fetch from backend
- Add local-to-cloud migration flow
- Add sync error states and retry behavior

Exit criteria:

- Signed-in users can use cloud-backed packages from the extension

## Phase 3: Production Team Version

Goal:

Support real multi-user team workflows safely.

### Milestone 3.1: Workspaces and Permissions

Tasks:

- Add workspace creation and switching
- Add member invites
- Add owner/admin/member/viewer roles
- Add package visibility rules
- Enforce permissions in API and UI

Exit criteria:

- Teams can safely share packages within a workspace

### Milestone 3.2: Versioning and Auditability

Tasks:

- Create package version history
- Support compare and rollback flows
- Store audit events for create/update/delete/share actions
- Show basic history UI in the extension or web dashboard

Exit criteria:

- Package changes are recoverable and attributable

### Milestone 3.3: Search

Tasks:

- Add keyword search
- Add semantic search with embeddings
- Add package filters for tags, platform, and recency
- Add relevance ranking in the package list

Exit criteria:

- Users can reliably find old context packages by exact and natural-language queries

### Milestone 3.4: Security and Compliance Readiness

Tasks:

- Expand sensitive-content scanning
- Add redact/remove-before-save flow
- Add privacy policy draft
- Add data retention/deletion behavior
- Add encryption and secret-handling review
- Add permission justification documentation

Exit criteria:

- Product is ready for serious internal team use and later store preparation

## Phase 4: Advanced Intelligence

Goal:

Make Context Kit smarter than a simple save/insert utility.

### Milestone 4.1: Smart Updates

Tasks:

- Detect when a conversation matches an existing package
- Suggest creating a new version instead of a new package
- Highlight new decisions, changed assumptions, and new constraints

Exit criteria:

- The extension can help users keep package history current with low effort

### Milestone 4.2: LLM-Assisted Structuring

Tasks:

- Add summary generation
- Add decision extraction
- Add constraints extraction
- Add open-question extraction
- Add tag suggestions

Exit criteria:

- Saved packages are substantially faster to review and organize

### Milestone 4.3: Smarter Insertion

Tasks:

- Add token estimation
- Add relevance-based partial insertion
- Add section-level include/exclude controls
- Add prompt templates by use case

Exit criteria:

- Users can insert the right amount of context without overloading the prompt

## Recommended Order From Here

1. Run human exploratory QA on logged-in real conversations
2. Add database migrations and Postgres deployment setup
3. Add semantic search
4. Add LLM-assisted structuring and smart updates
5. Harden permissions and invite delivery for production

## Immediate Next Milestone

Best next engineering target:

`Phase 3.3: Search`

Reason:

- The local and cloud MVP paths are now implemented and smoke-tested
- The next major product gap is package discovery across larger team libraries
- Production readiness now depends on migrations, search, and stronger auth/compliance work
