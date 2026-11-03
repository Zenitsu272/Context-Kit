# Context Kit Permission Justification

## Edge extension permissions used

### `storage`

- stores local Context Packages
- stores draft recovery state
- stores local-dev auth session and selected workspace state
- stores optional Gemini credentials, model and cooldowns, restricted to trusted extension contexts

### `clipboardWrite`

- copies the user-selected handoff to paste into another AI tool

### `scripting` and `activeTab`

- reconnects a supported tab after an extension reload
- reads selected text on a user-invoked ordinary webpage

### `sidePanel`

- provides the main extension interface without disrupting the active AI tab

### `tabs` and active tab inspection

- detects whether the current page is a supported AI tool
- gathers page title and URL for package metadata

### content script access on supported hosts

- extracts visible conversation content from supported AI interfaces
- inserts rendered context back into the active prompt surface when requested
- captures highlighted text for manual fallback flows

## Why these permissions are necessary

- without `storage`, the extension cannot save context or recover drafts
- without page access, the extension cannot capture conversation content or insert context back into the tool
- without the side panel, the product loses its core review-and-save workflow

## Current minimization choices

- Required host permissions are limited to supported AI properties (and localhost only in development builds).
- Optional HTTPS host permission is declared for attachments on different CDNs. Access is requested for one specific origin after the user clicks **Import file**, never for all sites at once. No extra content scripts run on those hosts.
- Enabling Gemini requests only `https://generativelanguage.googleapis.com/*`. Requests use the API key header; keys are not put into URLs.
- PDF workers and parsing code are packaged with the extension; no remote JavaScript is executed.
- unsupported pages do not receive conversation extraction behavior
- insertion happens only on explicit user action
- sensitive-content scanning runs locally inside the extension workflow

## Future hardening recommendations

- narrow host permissions further if support scope stays small
- add clearer user-facing permission explanations in the store listing
- document data flow separately for legal and security review
