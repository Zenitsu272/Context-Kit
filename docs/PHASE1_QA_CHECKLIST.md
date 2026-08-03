# Context Kit Phase 1 QA Checklist

Use this checklist before calling the local MVP stable.

## Automated Smoke Test

Run:

```bash
npm install
npm run build
npm run test:phase1
```

Current automated coverage:

- unpacked extension loads in Chrome
- unsupported-tab messaging is shown
- manual draft autosave works
- recovered draft resume works
- manual save works
- JSON export works
- delete and import round-trip works
- selected-text capture message path works on ChatGPT
- prompt insertion message path works on ChatGPT
- selected-text capture message path works on Gemini
- prompt insertion message path works on Gemini

## Manual Browser QA

### Save Flow

- Save a short ChatGPT conversation
- Save a long ChatGPT conversation
- Save a short Gemini conversation
- Save a long Gemini conversation
- Confirm title, summary, tags, and transcript look reasonable
- Confirm low-confidence warnings appear when extraction is partial

### Fallback Flow

- Highlight part of a ChatGPT conversation and use `Capture Selected Text`
- Highlight part of a Gemini conversation and use `Capture Selected Text`
- Paste a manual transcript into the transcript editor
- Confirm saved package renders correctly after manual cleanup

### Insert Flow

- Insert a package into ChatGPT in `Brief`
- Insert a package into ChatGPT in `Detailed`
- Insert a package into Gemini in `Brief`
- Insert a package into Gemini in `Detailed`
- Confirm clipboard fallback works if direct insertion fails

### Local Library

- Export a saved package to JSON
- Delete the package
- Import the same JSON file
- Confirm the package reappears with the same content

### Draft Recovery

- Start a draft and reload the extension
- Confirm `Recovered Draft` appears
- Resume the draft and save it
- Start another draft and discard it

### Unsupported Sites

- Open a non-supported tab
- Confirm the extension explains the limitation clearly
- Confirm manual context creation is still available

## Release Criteria For Phase 1

- Automated smoke test passes
- No blocker issues in save, recover, capture, insert, export, import, or delete
- Known selector quirks are documented
- The unpacked extension is usable by internal testers without hand-holding
