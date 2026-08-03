# Context Kit Security and Retention Notes

## Current security controls

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
