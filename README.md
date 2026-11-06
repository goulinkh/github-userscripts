# GitHub userscripts

Small userscripts for GitHub by [goulinkh](https://github.com/goulinkh).

## GitHub OverType Comments

A Markdown editing surface for GitHub comments and pull-request reviews, powered by [OverType](https://github.com/panphora/overtype).

[**Install GitHub OverType v0.1.1**](https://github.com/goulinkh/github-userscripts/releases/download/v0.1.1/github-overtype.user.js) · [Latest script](https://raw.githubusercontent.com/goulinkh/github-userscripts/main/userscripts/github-overtype.user.js)

Install a userscript manager such as Tampermonkey, then open the install link and confirm installation. Disable older copies to avoid duplicate editors. Preserve any unsaved text before reloading GitHub.

### Features

- OverType stays visible; no editor switch or native fallback mode.
- Small monospace text, GitHub color tokens, and the original input background.
- Markdown list continuation and paired code fences.
- JavaScript/TypeScript code highlighting through Twinkleplop.
- GitHub autocomplete keyboard forwarding while its associated popup is open.
- Synchronization with GitHub's original form field.

Supports eligible comment fields on github.com and gist.github.com. Unknown code languages remain plain text. Highlighting is bounded to 50,000 characters per block. JSX/TSX are not enabled.

### Status and limitations

This is an initial release. Browser-injected builds have been tested; userscript-manager installation timing still needs independent verification. GitHub's UI can change, and autocomplete forwarding does not guarantee every popup works. Always check your text before submitting. Local browser tests never submit GitHub comments.

### Develop

Requires Node.js 22+, npm, and Python 3.

```sh
npm ci --ignore-scripts
npm run build
npx playwright install chromium
npm test
```

Installable output: `userscripts/github-overtype.user.js`. Build artifacts for safe browser debugging are generated under `build/`. See [AGENTS.md](AGENTS.md) for the full workflow.

### Dependencies and privacy

OverType 2.4.0 is loaded from a pinned jsDelivr URL by the userscript manager. Twinkleplop 0.1.7 is bundled. Highlighting runs locally; this script does not send comment contents to a highlighting service. Normal GitHub features, network requests, and draft behavior remain GitHub's responsibility.

MIT licensed. Dependency notices are included under `vendor/` and in bundled output.
