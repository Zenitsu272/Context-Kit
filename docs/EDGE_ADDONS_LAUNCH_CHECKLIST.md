# Microsoft Edge Add-ons Launch Checklist

Verified against official Microsoft Edge Add-ons documentation on 2026-06-02.

## Required before submission

- build the Edge Add-ons package with `npm run package:edge`
- verify the published manifest with `npm run test:edge`
- verify local runtime compatibility in Microsoft Edge with `npm run test:edge-local`
- generate Edge-sized screenshots and promotional assets with `npm run capture:edge-assets`
- create or sign in to a Microsoft Edge Add-ons developer account in Partner Center
- upload the extension `.zip` package in Partner Center
- fill in Availability and choose `Hidden` for the first review pass
- fill in Properties with the website URL, support URL, and privacy policy URL
- fill in Privacy with accurate single-purpose, permission, remote-code, and data-usage disclosures
- fill in Store listings with the logo, small promotional tile, description, and screenshots
- add certification testing notes before submission

## Current repo artifacts

- Edge Add-ons build pipeline: `npm run build:edge`
- packaged zip output: `release/context-kit-edge-addons-<version>.zip`
- Edge listing assets: `release/edge-assets/`
- privacy policy draft: [PRIVACY_POLICY_DRAFT.md](D:/Vaishak%20Files/context_bridge/docs/PRIVACY_POLICY_DRAFT.md)
- permission rationale: [PERMISSIONS_JUSTIFICATION.md](D:/Vaishak%20Files/context_bridge/docs/PERMISSIONS_JUSTIFICATION.md)
- Edge listing draft: [EDGE_STORE_LISTING_DRAFT.md](D:/Vaishak%20Files/context_bridge/docs/EDGE_STORE_LISTING_DRAFT.md)

## Asset sizes to upload

- extension logo: 1:1 image, recommended `300 x 300`, minimum `128 x 128`
- small promotional tile: `440 x 280`
- large promotional tile: `1400 x 560` if you choose to provide it
- screenshots: use the Edge-ready `1280 x 800` assets from `release/edge-assets`

## Current public URLs

- website: https://zennet-ai.vercel.app/
- support: https://zennet-ai.vercel.app/#contact
- privacy: https://zennet-ai.vercel.app/privacy

## Recommended submission mode

- first submit as `Hidden` so only the listing URL can be shared during validation
- switch to `Public` only after review passes and the release build is manually validated

## Pre-submit smoke pass

- confirm capture works on real ChatGPT and Gemini accounts in Microsoft Edge
- confirm unsupported-tab messaging is clear
- confirm no cloud-login UI appears in the published Edge build
- confirm the permission set is limited to supported AI sites plus storage
- confirm the privacy disclosures match the actual local-first behavior
