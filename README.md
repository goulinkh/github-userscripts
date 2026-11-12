# Userscripts

Small, independent browser userscripts by [goulinkh](https://github.com/goulinkh) for sites such as GitHub and Google Docs. Each script installs, updates and is versioned separately; install only the ones you need with a userscript manager such as Tampermonkey.

| Script | Site | What it does |
| --- | --- | --- |
| [Google Docs Copy as Markdown](#google-docs-copy-as-markdown) | docs.google.com | Copies a document as Markdown, optionally with comments, to the clipboard |
| [Google Docs Markdown Clipboard](#google-docs-markdown-clipboard) | docs.google.com | Makes ⌘C/Ctrl+C copy as Markdown and ⌘V/Ctrl+V paste from Markdown |
| [GitHub Sticky PR Navigation](#github-sticky-pr-navigation) | github.com | Keeps a compact pull-request tab row pinned while scrolling (GitHub's experimental new pull request pages only) |
| [GitHub OverType Comments](#github-overtype-comments) | github.com, gist.github.com | Markdown editing and code highlighting in comment fields |

## Google Docs Copy as Markdown

[Latest script](https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/google-docs-copy-md.user.js)

Adds a Markdown icon button next to Share in Google Docs. Clicking it requests Google's own exports and copies the document as Markdown to the clipboard instead of downloading a file. The icon turns into a check mark when copied, or an error mark with the reason in its tooltip.

By default a click copies the Markdown **with comments**, and Shift-, ⌘- or Ctrl-click copies it without them. Right-click the icon (or use the keyboard's context-menu key) for two options: what a plain click copies (the modifier click always does the other), and how comments appear. The choices are saved in this browser for docs.google.com and apply to open documents immediately. While hovering, a blue dot on the icon shows that the click will include comments.

Google's Markdown export (the same output as File → Download → Markdown) omits comments, so the script also reads the Word export, which records each comment's exact range, author, text and replies. Comments can appear in three ways:

- **Hidden comments in place** (default): an HTML comment directly after the paragraph, list item, table, heading or code block the comment belongs to. It stays invisible when the Markdown is rendered.

  ```markdown
  Intro with a commented phrase here.

  <!-- Comment from Ada on “commented phrase”: Please rephrase -->
  ```

- **Visible quotes in place**: a quote block at the same position, shown when rendered.

  ```markdown
  > **Comment from Ada** on “commented phrase”: Please rephrase
  ```

- **List at the end**: the document stays unchanged, followed by a `## Comments` section. Each entry names the commented text, the sentence around it and the section heading it falls under.

  ```markdown
  ## Comments

  - **Comment from Ada** on “commented phrase” in “Intro with a commented phrase here.”, under “Overview”
    > Please rephrase
  ```

Comments in place are inserted only between blocks, so they never break code, tables or links. Paragraphs are matched to Markdown blocks by their text; content the Markdown export renders differently (such as smart chips) may place a comment after the preceding block. Resolved comments and suggestions are not included.

The export covers the saved document, so wait for Docs to finish saving recent edits. Whether it includes every document tab or only the current one depends on Google's export. Embedded images are exported inline as data URIs, which can make the copied text large. Documents whose owners disabled downloading cannot be exported. Copying with comments downloads two exports, and Google temporarily refuses exports after many in quick succession; the error then says to try again in a minute.

No dependencies; requests go only to Google's export endpoints, and nothing in the document is modified. Tested in an isolated fixture and by injection into a live document; userscript-manager installation remains unverified. If the tab loses focus before a copy finishes (for example, switching apps right after clicking), the browser refuses the clipboard write; the icon turns amber and the next click copies the already prepared text. For debugging: `window.__googleDocsCopyMarkdown.status()` (including recent `failures` with phase, error, timing and focus, never document text) and `.destroy()`; `.render(true)` returns the text that would be copied without using the clipboard.

## Google Docs Markdown Clipboard

[**Install Google Docs Markdown Clipboard v0.1.0**](https://github.com/goulinkh/userscripts/releases/download/gdocs-md-clipboard-v0.1.0/google-docs-md-clipboard.user.js) · [Latest script](https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/google-docs-md-clipboard.user.js)

Makes Google Docs' own **Copy as Markdown** and **Paste from Markdown** commands the default clipboard shortcuts in the document body: ⌘C (Ctrl+C on Windows and Linux) copies the selection as Markdown, and ⌘V (Ctrl+V) pastes the clipboard as Markdown. Docs does the conversion; the script only runs its menu commands when you press the shortcut.

Turn on Markdown in Docs first: **Tools → Preferences → Enable Markdown**. That setting adds both commands to the Edit and right-click menus; without it the shortcuts keep their normal behavior.

The shortcuts fall back to normal copy and paste whenever Docs' Markdown command is unavailable, for example when nothing is selected, in view-only documents, or when Markdown is turned off. Paste also stays normal if the site's clipboard permission is blocked, and outside Chrome-based browsers, where Docs answers Paste from Markdown with a dialog instead of pasting. Paste from Markdown reads the clipboard through the browser, so Chrome may ask once to allow docs.google.com to see the clipboard.

Content copied from Google Docs, Sheets or Slides themselves still pastes with its full formatting, because converting it through Markdown would only lose detail. That covers ⌘X (Ctrl+X), which keeps cutting normally, so cut and paste moves text within a document exactly as before, and anything copied with the regular **Copy** command in the Edit or right-click menu. Everything else on the clipboard, such as text from web pages, chats or code editors, is pasted as Markdown; Docs' Markdown import converts or drops formatting it cannot express.

The rest is unchanged: ⌘⇧V (Ctrl+Shift+V) still pastes without formatting, text boxes outside the document (comments, find, rename) are not affected, and the regular **Copy** and **Paste** remain in the menus.

No dependencies and no network requests. Tested in an isolated fixture and by injection into a live, signed-in document with Markdown enabled (copy as Markdown and paste from Markdown); installation through a userscript manager remains unverified. For debugging: `window.__googleDocsMarkdownClipboard.status()` reports whether each shortcut currently uses Markdown and counts (never clipboard contents); `.destroy()` restores the native shortcuts.

## GitHub Sticky PR Navigation

[**Install Sticky PR Navigation v0.1.0**](https://github.com/goulinkh/userscripts/releases/download/sticky-pr-v0.1.0/github-sticky-pr.user.js) · [Latest script](https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/github-sticky-pr.user.js)

> **Only works with GitHub's new pull request experience,** which GitHub currently offers as an experimental preview. The stable pull request pages are not supported or tested.

A separate script in `userscripts/github-sticky-pr.user.js`. Pins a compact 36px PR tab row below GitHub's compact header, then offsets the existing Changes toolbar, active diff headers and sticky file tree. It retains GitHub's own sticky behavior and preserves the tabs' original layout space to avoid scroll jumps.

Disable the older “Sticky PR navigation and Changes” script before installing this one; do not run both. Its old anonymous listeners cannot be safely removed by the replacement, so preserve unsaved work before reloading. Temporary development injection does not persist across reloads.

The background spans the page. Overview retains the original centered tab alignment; Changes aligns tabs with its wider content gutters. The selected tab keeps GitHub's native underline and colors. No external dependencies are loaded.

Tested against the preview's desktop Overview and Changes views and an isolated fixture covering grid layout, compact spacing, responsive widths, stack alignment, reapplication and cleanup. Other GitHub layouts and userscript-manager installation remain unverified. Layouts without native sticky toolbars/sidebars retain their native behavior.

For debugging: `window.__githubStickyPR.status()` reports state; `window.__githubStickyPR.destroy()` restores adjusted styles and removes the integration.

## GitHub OverType Comments

A Markdown editing surface for GitHub comments and pull-request reviews, powered by [OverType](https://github.com/panphora/overtype).

[**Install GitHub OverType v0.1.1**](https://github.com/goulinkh/userscripts/releases/download/v0.1.1/github-overtype.user.js) · [Latest script](https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/github-overtype.user.js)

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
