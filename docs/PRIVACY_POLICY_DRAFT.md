# Context Kit Privacy Policy Draft

## What Context Kit stores

- Context Packages created by the user
- message excerpts, summaries, tags, notes, and review warnings inside each package
- lightweight auth session state for local development
- workspace membership and version history when cloud sync is enabled

## How data is used

- to help users save, organize, search, and reuse project context across AI tools
- to support workspace collaboration and package version history
- to support security review features such as sensitive-content warnings and redaction prompts

## Sensitive content handling

- Context Kit scans drafts for likely secrets and personal data before save
- users can manually edit content or use auto-redaction before storing it
- local-dev builds do not guarantee production-grade encryption or secret isolation

## Data sharing

- personal packages remain private by default
- workspace packages can be shared with workspace members based on role and visibility rules
- local-dev invite flows create membership records but do not send production email invites

## Retention and deletion

- local packages remain in browser storage until deleted by the user
- cloud packages remain in backend storage until deleted by the user or retained under team policy
- deleted cloud packages are hidden from normal views and may remain in audit/version history for recovery in development environments

## User controls

- export packages as JSON
- delete packages
- redact drafts before save
- switch between local-only and cloud-backed workflows

## Current limitations

- this draft is for internal review and not final legal language
- production retention windows, subprocessors, and encryption details still need final policy review
