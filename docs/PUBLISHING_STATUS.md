# Publishing Status

## Ready inside the repo

- store-safe build command for Chromium-based store releases
- Chrome Web Store package generation
- Microsoft Edge Add-ons package generation
- screenshot and Edge asset automation
- privacy, permissions, and security documentation
- publish-safe manifest without localhost permissions
- local-first extension UI for browser-store review

## Still external

- create the Microsoft Edge Add-ons developer account entry in Partner Center
- upload the Edge package and assets
- complete the Availability, Properties, Privacy, Store listings, and Notes tabs
- submit the listing for certification review

## Recommended Edge release flow

1. Run `npm run package:edge`.
2. Run `npm run test:edge`.
3. Run `npm run test:edge-local`.
4. Run `npm run capture:edge-assets`.
5. Upload the generated zip and assets to a `Hidden` Microsoft Edge Add-ons submission in Partner Center.
6. Complete the Properties, Privacy, Store listings, and Notes sections using the current local-first build behavior.
7. Run one last manual QA pass against the reviewed build before switching visibility to `Public`.
