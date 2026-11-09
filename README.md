# Userscripts

Small, independent browser userscripts by [goulinkh](https://github.com/goulinkh) for sites such as GitHub and Google Docs. Each script installs, updates and is versioned separately; install only the ones you need with a userscript manager such as Tampermonkey.

| Script | Site | What it does |
| --- | --- | --- |
| [Google Docs Copy as Markdown](#google-docs-copy-as-markdown) | docs.google.com | Copies a document as Markdown, optionally with comments, to the clipboard |
| [GitHub Sticky PR Navigation](#github-sticky-pr-navigation) | github.com | Keeps a compact pull-request tab row pinned while scrolling |
| [GitHub OverType Comments](#github-overtype-comments) | github.com, gist.github.com | Markdown editing and code highlighting in comment fields |

## Google Docs Copy as Markdown

[Latest script](https://raw.githubusercontent.com/goulinkh/github-userscripts/main/userscripts/google-docs-copy-md.user.js)

Adds a Markdown icon button next to Share in Google Docs. Clicking it requests Google's own exports and copies the document as Markdown to the clipboard instead of downloading a file. The icon turns into a check mark when copied, or an error mark with the reason in its tooltip.

By default a click copies the Markdown **with comments**, and Shift-, ⌘- or Ctrl-click copies it without them. Right-click the icon (or use the keyboard's context-menu key) to choose what a plain click copies; the modifier click always does the other. The choice is saved in this browser for docs.google.com and applies to open documents immediately. While hovering, a blue dot on the icon shows that the click will include comments.

Google's Markdown export (the same output as File → Download → Markdown) omits comments, so the script also reads the Word export, which records each comment's exact range, author and text. Each comment becomes an HTML comment placed directly after the paragraph, list item, table, heading or code block it belongs to, quoting the commented text:

```markdown
Intro with a commented phrase here.

<!-- Comment from Ada on “commented phrase”: Please rephrase -->
```

HTML comments stay hidden when the Markdown is rendered, and placing them between blocks never breaks code, tables or links. Paragraphs are matched to Markdown blocks by their text; content the Markdown export renders differently (such as smart chips) may place a comment after the preceding block. Resolved comments and suggestions are not included.

The export covers the saved document, so wait for Docs to finish saving recent edits. Whether it includes every document tab or only the current one depends on Google's export. Embedded images are exported inline as data URIs, which can make the copied text large. Documents whose owners disabled downloading cannot be exported.

No dependencies; requests go only to Google's export endpoints, and nothing in the document is modified. Tested in an isolated fixture and by injection into a live document; userscript-manager installation remains unverified. If the tab loses focus before a copy finishes (for example, switching apps right after clicking), the browser refuses the clipboard write; the icon turns amber and the next click copies the already prepared text. For debugging: `window.__googleDocsCopyMarkdown.status()` (including recent `failures` with phase, error, timing and focus, never document text) and `.destroy()`; `.render(true)` returns the text that would be copied without using the clipboard.

## GitHub Sticky PR Navigation

[**Install Sticky PR Navigation v0.1.0**](https://github.com/goulinkh/github-userscripts/releases/download/sticky-pr-v0.1.0/github-sticky-pr.user.js) · [Latest script](https://raw.githubusercontent.com/goulinkh/github-userscripts/main/userscripts/github-sticky-pr.user.js)

A separate script in `userscripts/github-sticky-pr.user.js`. Pins a compact 36px PR tab row below GitHub's compact header, then offsets the existing Changes toolbar, active diff headers and sticky file tree. It retains GitHub's own sticky behavior and preserves the tabs' original layout space to avoid scroll jumps.

Disable the older “Sticky PR navigation and Changes” script before installing this one; do not run both. Its old anonymous listeners cannot be safely removed by the replacement, so preserve unsaved work before reloading. Temporary development injection does not persist across reloads.

The background spans the page. Overview retains the original centered tab alignment; Changes aligns tabs with its wider content gutters. The selected tab keeps GitHub's native underline and colors. No external dependencies are loaded.

Tested against the current desktop Overview and Changes views and an isolated fixture covering grid layout, compact spacing, responsive widths, stack alignment, reapplication and cleanup. Other GitHub layouts and userscript-manager installation remain unverified. Layouts without native sticky toolbars/sidebars retain their native behavior.

For debugging: `window.__githubStickyPR.status()` reports state; `window.__githubStickyPR.destroy()` restores adjusted styles and removes the integration.

## GitHub OverType Comments

A Markdown editing surface for GitHub comments and pull-request reviews, powered by [OverType](https://github.com/panphora/overtype).

[**Install GitHub OverType v0.1.1**](https://github.com/goulinkh/github-userscripts/releases/download/v0.1.1/github-overtype.user.js) · [Latest script](https://raw.githubusercontent.com/goulinkh/github-userscripts/main/userscripts/github-overtype.user.js)

Open the install link in a browser with a userscript manager and confirm installation. Disable older copies to avoid duplicate editors. Preserve any unsaved text before reloading GitHub.

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

### Dependencies and privacy

OverType 2.4.0 is loaded from a pinned jsDelivr URL by the userscript manager. Twinkleplop 0.1.7 is bundled. Highlighting runs locally; this script does not send comment contents to a highlighting service. Normal GitHub features, network requests, and draft behavior remain GitHub's responsibility.

## Develop

All scripts share one build and test setup. Requires Node.js 22+, npm, and Python 3.

```sh
npm ci --ignore-scripts
npm run build
npx playwright install chromium
npm test
```

Installable outputs are in `userscripts/`; each script's source is in `src/` and its isolated browser tests run under `npm test`. Build artifacts for safe browser debugging are generated under `build/`. See [AGENTS.md](AGENTS.md) for the full workflow.

## License

MIT licensed. Dependency notices are included under `vendor/` and in bundled output.
