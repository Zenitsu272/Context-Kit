# Chrome Web Store Launch Checklist

Verified against official Chrome Web Store documentation on 2026-06-01.

## Required before submission

- build the publish-safe package with `npm run package:store`
- verify the store build with `npm run test:store`
- generate screenshots with `npm run capture:store-assets`
- fill in the Store Listing tab with title, descriptions, category, icons, and screenshots
- fill in the Privacy tab with accurate data-use disclosures
- provide a public privacy policy URL in the Developer Dashboard
- choose a visibility setting in the Distribution tab

## Current repo artifacts

- store-safe build pipeline: `npm run build:store`
- packaged zip output: `release/context-kit-chrome-store-<version>.zip`
- screenshot generation: `release/store-assets/`
- privacy policy draft: [PRIVACY_POLICY_DRAFT.md](D:/Vaishak%20Files/context_bridge/docs/PRIVACY_POLICY_DRAFT.md)
- permission rationale: [PERMISSIONS_JUSTIFICATION.md](D:/Vaishak%20Files/context_bridge/docs/PERMISSIONS_JUSTIFICATION.md)
- listing draft: [STORE_LISTING_DRAFT.md](D:/Vaishak%20Files/context_bridge/docs/STORE_LISTING_DRAFT.md)

## External items still needed

- public hosting for:
  - privacy policy
  - support page
  - official site URL
- Chrome Web Store developer dashboard entry
- screenshots uploaded in the listing
- final privacy disclosures checked against the published build

## Recommended submission mode

- first submit as `Unlisted` for review-safe validation
- once accepted and manually validated, switch to `Public` if desired

## Pre-submit smoke pass

- confirm capture works on real ChatGPT and Gemini accounts
- confirm unsupported-tab messaging is clear
- confirm no local backend sign-in UI appears in the store build
- confirm the permission prompt only references supported AI sites and storage
