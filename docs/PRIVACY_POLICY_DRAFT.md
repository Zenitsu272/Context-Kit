# Context Kit Privacy Policy

Updated November 3, 2026. Applies to the local Edge extension, version 0.2.

## What Context Kit stores

- Context Packages created by the user
- message excerpts, summaries, tags, notes, and review warnings inside each package
- lightweight auth session state for local development
- workspace membership and version history when cloud sync is enabled
- files you explicitly attach or import, stored locally in IndexedDB
- extracted PDF/document text and optional AI descriptions
- optional Gemini keys, model preference and key cooldown status in local extension storage

Keys are restricted to trusted extension contexts, are not synced to other devices, and are excluded from package backups. Browser storage is not an encrypted credential vault; someone with access to your profile may be able to read it.

## How data is used

- to help users save, organize, search, and reuse project context across AI tools
- to support workspace collaboration and package version history
- to support security review features such as sensitive-content warnings and redaction prompts

## Sensitive content handling

- Context Kit scans drafts for likely secrets and personal data before save
- users can manually edit content or use auto-redaction before storing it
- local-dev builds do not guarantee production-grade encryption or secret isolation

## Data sharing

The release build does not enable cloud sync, telemetry or background AI processing. Capture and local PDF/text extraction do not send the captured content to Context Kit servers.

**Enhance with Gemini** sends draft text and extracted attachment text to Google's Gemini API. Common secret patterns are redacted first, but this is not a guarantee that all sensitive information is removed. **Read with Gemini** sends the selected original image, PDF or short video without redaction. **Test saved keys** sends a fixed test prompt. These actions require enabling Gemini with your own keys; Google's API data policies, quota and billing apply. Nothing is sent to Gemini solely because a file or conversation was saved.

**Import file** downloads a specific link you selected and asks Edge for access to that source origin. It may use your existing cookies to retrieve a file you can access. Redirected, expired and protected links may require manual download. No files are fetched automatically during capture.

Copy and insertion include extracted file text and any source links. Original binary files are sent to another AI tool only when you upload them yourself. Backups include original files and can contain sensitive information; keep them somewhere you trust.

- personal packages remain private by default
- workspace packages can be shared with workspace members based on role and visibility rules
- local-dev invite flows create membership records but do not send production email invites

## Retention and deletion

- local packages remain in browser storage until deleted by the user
- cloud packages remain in backend storage until deleted by the user or retained under team policy
- deleted cloud packages are hidden from normal views and may remain in audit/version history for recovery in development environments
- deleting a local package removes its library record; original files no longer referenced by any saved package or active draft can be removed with **Clean up unattached files** in Settings after a 24-hour grace period
- **Remove all keys** deletes saved Gemini credentials and disables Gemini
- uninstalling the extension removes its browser-managed storage; exported backups remain wherever you saved them

## User controls

- export portable packages (including original files) as JSON or rendered context as Markdown
- delete packages
- redact drafts before save
- switch between local-only and cloud-backed workflows

## Contact

Report product or privacy issues at [Context Kit support](https://github.com/Zenitsu272/Context-Kit/issues). Do not include API keys or private documents in public issues.

## Development-only cloud features

- Cloud sign-in, workspaces and historical restore are development features, disabled in the distributed Edge build. Attachment packages cannot be uploaded to this backend.
- Production authentication, cloud retention and backend encryption require a separate deployment review before enabling public cloud sync.
