# Context Kit Security and Retention Notes

## Current security controls

- optional Gemini credentials restricted to trusted extension storage contexts, excluded from backups and builds
- API errors never echo provider response bodies or key values; requests have bounded timeouts and per-key cooldowns
- AI-generated summaries are schema-checked, incomplete generations rejected, original transcripts retained
- documents/transcripts are explicitly treated as reference material, not instructions, in AI requests
- original file blobs stored separately from package metadata in IndexedDB; backups validate shape, size and URL protocols
- draft import never replaces an existing local package with a colliding ID

- pre-save sensitive-content scanning for likely secrets, personal identifiers, and business-sensitive text
- one-click auto-redaction in the draft review flow
- workspace role enforcement in the backend for shared packages
- package version history for recovery and auditability
- audit logging for auth and package mutations

## Current retention behavior

- local packages stay in `chrome.storage.local` until removed
- cloud packages are soft-deleted by status and hidden from normal package lists
- version history is preserved to support restore flows
- audit logs remain available for traceability in local development
- removed original file blobs can be cleared manually after 24 hours if no saved package or active draft references them
- local updates replace contents; export backups for local historical recovery
- original files sent to Gemini are not redacted; text redaction is best-effort and does not modify stored binary files

## Development limitations

- local-dev auth is intentionally lightweight
- SQLite is used by default, without formal migrations yet
- deleted records are not yet automatically purged on a timed retention schedule
- semantic search is heuristic-based today, not embedding-backed

## Recommended production next steps

- add real database migrations
- adopt production auth and invitation delivery
- define retention windows for deleted packages, versions, and audit logs
- add encryption-at-rest review for production database storage
- add explicit purge jobs for expired deleted data
