# Agent guide

## Scope and release layout

This public repository contains independent userscripts for different websites: GitHub OverType Comments, GitHub Sticky PR Navigation and Google Docs Copy as Markdown. It is not limited to GitHub. Each script has its own source file, generated userscript, tests, version and release tags; keep scripts separate and do not add speculative features during maintenance. Name new files after the site and feature (`src/<site>-<feature>.js`, `userscripts/<site>-<feature>.user.js`).

- `src/github-overtype.js`: OverType integration and editor lifecycle. Keep runtime source free of explanatory comments; put explanations here or in documentation.
- `src/highlighter.js`: Twinkleplop adapter; escaped token spans and bounded cache.
- `src/github-sticky-pr.js`, `src/google-docs-copy-md.js`: the other scripts, each self-contained.
- `userscripts/*.user.js`: committed, installable release artifacts. Required userscript metadata and dependency license notices are exceptions to comment removal.
- `vendor/`: pinned OverType test bytes, SHA-256 checksum, dependency licenses.
- `scripts/`: reproducible build, checks, isolated browser test runners (one per script).
- `tests/`: Playwright function snippets, each accepting `page`.
- `build/`: ignored generated injection/fixture snippets and highlighter bundle.

Never edit only the generated userscript. Change source, rebuild, and commit the resulting artifact together when publishing is authorized.

## Sticky PR navigation

`src/github-sticky-pr.js` builds to `userscripts/github-sticky-pr.user.js` independently of OverType (script version 0.1.0). `scripts/test-sticky.mjs` uses a fresh, unauthenticated browser context with an intercepted synthetic GitHub URL; never point these tests at a live profile. `build/apply-sticky.playwright.js` only applies layout changes to the shared GitHub tab. Bring the tab forward before measuring animation-frame updates.

Preserve GitHub's native sticky positions: adjust offsets, not the positioning mode of toolbars, file headers or sidebars. A spacer must preserve the navigation's named grid area, flex properties, margins and original height when tabs become fixed. The pinned background spans the viewport; on Changes, tab content follows the diff viewer/main content gutters rather than the narrower title grid. On Overview and other PR views, retain the original navigation spacer's centered left/right gutters. Keep the active link's native pseudo-element underline inside the compact row by clearing its negative bottom margin as well as its positional offset; retain GitHub's selection attributes and colors. Compact navigation overrides must beat GitHub's layered important padding; use saved inline-important properties and restore them on unpin/cleanup. Keep the native mini header above tabs, toolbar below tabs, diff headers below the toolbar, and the tree below tabs. Only adjust actual sticky/fixed header targets; never turn whole diff containers sticky. Preserve existing node identities and click handlers; do not clone/reparent navigation or modify form content. Mutation observation excludes inline styles to avoid feedback from offset writes. Disconnect observers/listeners and restore modified properties on destroy, route exit and reapplication. Do not try to remove anonymous listeners from the user's older script; require it to be disabled separately.

## Google Docs Copy as Markdown

`src/google-docs-copy-md.js` builds to `userscripts/google-docs-copy-md.user.js` with its own `VERSION` and tags `gdocs-copy-md-vX.Y.Z`; do not bump the package version for it. It uses Google's `/export?format=md` endpoint. That endpoint redirects to a signed `googleusercontent.com` URL that answers `Access-Control-Allow-Origin: *`, so the fetch must use `same-origin` credentials: `include` is rejected by CORS. Start `navigator.clipboard.write` with a promise-backed `ClipboardItem` inside the click, before the export resolves, so the user gesture is not lost. A plain click copies with comments unless the user chose "Markdown only" in the right-click menu (stored in `localStorage` key `gdocs-copy-md:click`); Shift/⌘/Ctrl inverts the choice. Keep the in-page menu rather than `GM_registerMenuCommand`, which would require grants and move the script out of page context. Docs enforces Trusted Types: build DOM with elements and `textContent`, never HTML strings. Parsing the Word export's XML with `DOMParser` requires the script's own Trusted Types policy; a plain string is blocked. Comment copying reads the official Word export: `word/document.xml` has exact `commentRangeStart`/`commentRangeEnd` positions and `word/comments.xml` authors and text. The HTML export only marks range ends without authors; the internal `docos/p/sync` feed needs session tokens and an undocumented positional format. Do not depend on either. The zip is read with `DecompressionStream('deflate-raw')`, no dependency. Notes are inserted only between Markdown blocks (after the block containing the range start), never inside code, tables or lines; escape `-->` in comment text. Paragraph-to-block matching is sequential over punctuation-free text so duplicate paragraphs resolve in order. `scripts/test-gdocs-copy-md.mjs` serves the fixture from `localhost` and redirects to `127.0.0.1` to model the cross-origin redirect, and builds a real `.docx` zip; Playwright route fulfilment does not intercept redirect targets. The test stubs the clipboard and never touches the system clipboard. Live checks may inject `build/apply-gdocs-copy-md.playwright.js` and inspect `window.__googleDocsCopyMarkdown.render(true)`, which builds output without the clipboard; never edit document text or click Copy on the user's behalf without permission, since that overwrites their clipboard.

## GitHub OverType Comments: behavioral invariants

OverType is always the visible editor. Do not add automatic native fallback or an editor-switch button. GitHub's textarea is an inert, hidden-text React/form bridge, not disabled: it must still participate in FormData. Its public focus method forwards to its own OverType input; cleanup restores original properties, attributes, listeners and wrapper styles.

Preserve existing text, selection and focus during reapplication. Initialization must dispatch no native input/change events. Native input/change updates synchronize immediately; polling handles silent property changes. Synchronous host insertions during bridge dispatch must not be overwritten with stale text.

Both text layers and the hidden bridge share GitHub's monospace stack, small text token and line-height; visible layers also share padding. Matching bridge typography is necessary for GitHub's `field-sizing: content` to measure the same text as OverType. Do not freeze the wrapper's initial height or impose a separate 160px minimum. The overlay fills the native field; GitHub's minimum/maximum height still applies. The visible textarea's vertical resize grip writes its requested border-box height back to the bridge (subtracting padding/borders for content-box sizing), then clears its own inline height so both layers follow the field. Disconnect the style observer on cleanup. Manual resizing changes geometry only, never values or input/change events. Use live CSS variable references, not copied resolved colors/sizes. Keep editing overlays transparent so the original input paints its own background. Inline-important padding is necessary because GitHub's layered important rules outrank unlayered rules regardless of specificity. Typography selectors must outrank OverType's stylesheet even on first initialization, when its stylesheet is injected later.

Keep fenced-code body/fence backgrounds joined without interior rounded corners. Highlighting changes color only, not metrics. Preserve code byte-for-byte at the JavaScript string level, including whitespace and Unicode; escape HTML and retain gaps between token ranges. Unknown languages, tokenizer failures, JSX/TSX and blocks over the cutoff remain plain. Do not enable ANSI rendering that strips source escape sequences.

Ordinary editing keys are handled locally before GitHub's bubbling shortcuts; call OverType's pinned handler exactly once. Smart lists stay enabled. IME composition bypasses smart transformations. Shift+Enter remains a plain newline. Fence completion stays undoable and does not duplicate an existing closer.

When the visible OverType input gains focus, dispatch a bubbling `focusin` notification on its native textarea bridge without actually focusing it or sending input/change events. GitHub's React textarea uses focus to initialize lazy suggestion data; skipping that notification can leave the mention popup showing loading skeletons indefinitely. Register the listener before initial focus transfer and remove it during cleanup. The `autocomplete-loading` fixture models delegated lazy loading independently of popup keyboard handling.

An expanded textarea combobox with its own visible ARIA listbox gets unmodified Enter/Tab/Escape/Up/Down forwarded to that original textarea. Only a consumed key skips OverType handling. Do not route keys to unrelated/global popups or move focus to the native field. Mirror combobox ARIA attributes to the visible input. Synthetic-key acceptance is host-dependent; fixture success is not proof of every live GitHub popup.

## Safety on live sites

Never change user data on a live site as a test. Live checks are read-only inspection and text-preserving injection; each script's section lists its specific limits. The rules below are for GitHub.

Never submit comments/reviews, save review drafts, or modify repository data as a test. Do not automate typing/filling/deleting text in actual comment boxes: GitHub may autosave. Do all synthetic typing, keyboard reproduction, undo, FormData and cleanup tests in the isolated fixture. Do not click submission controls. Ask the user to reproduce live-only typing failures.

Read-only DOM/computed-style inspection, text-preserving injection, and carefully scoped popup navigation are the live checks. Do not log comment contents, secrets or complete page HTML. Diagnostics record lengths, selections, timing, modifiers and handler results, not text. Keep private URLs, screenshots, session transcripts and browser recordings out of this repository.

A release must not alter GitHub's CSP or bypass its security policy. Pierre Highlights was tested but WASM initialization was blocked in page context. Twinkleplop runs without WASM; do not reintroduce a WASM dependency without separately validating deployment compatibility.

## Build and automated tests

Use Node.js 22+, npm and Python 3:

```sh
npm ci --ignore-scripts
npm run build
npx playwright install chromium
npm test
```

`npm run check` verifies syntax, version/metadata, license presence and the vendor checksum. `npm test` runs the isolated browser suites, including a direct evaluation of the standalone artifact. CI rebuilds and requires `userscripts/` to be unchanged. On machines without downloaded Chromium, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` may point to an installed Chromium-compatible executable; never reuse an authenticated profile for headless tests.

Pin dependency versions and commit `package-lock.json`. Preserve all required third-party notices when bundling or changing dependencies. Update tests when dependency internals change: local keyboard handling uses the pinned OverType methods.

## Live debugging through a shared browser

The numbered OverType steps below are the most detailed; other scripts have their own `build/apply-*.playwright.js` snippets described in their sections, and the general rules (shared work profile, explicit tab sharing, no private data in the repository) apply to all.

Use the work-profile browser MCP, not an unrelated personal profile. Re-list shared tabs before selecting one; indices and connections change. The user must explicitly share the relevant tab. Do not inspect unshared browser profiles or navigate a replacement tab over existing unsaved work.

1. Reproduce safely in the fixture before patching. Inspect actual live computed styles/ARIA relationships when the problem is host-specific. Do not assume the reported mechanism is the cause.
2. Rebuild. Create/select a new `about:blank` tab and run `build/fixture.playwright.js` via `browser_run_code_unsafe({filename: ABSOLUTE_PATH})`.
3. Run applicable `tests/*.playwright.js` functions. Useful sequence: fixture → theme → alignment → fixture → sizing → fixture → editing → focus-handoff → native-visibility → autocomplete-loading → autocomplete → highlighting → fixture → test. The lifecycle `test` suite leaves the integration stopped.
4. A fixture reset must navigate to a fresh blank document. `setContent` alone removes document listeners but retains OverType's global initialization flags, invalidating repeat keyboard tests. Bring the fixture tab forward if background throttling stalls timers or animation-frame scans.
5. Stop any existing `window.__ghOtDiagnostics` before replacing the integration. Select the actual shared GitHub tab, run `build/apply.playwright.js`, and require preserved native values and zero initialization input/change events. Never run fixture/typing/alignment snippets there.
6. Inspect computed font size/family, semantic token colors, transparent layers, code-block rectangles, associated popup ARIA IDs and active focus. Do not modify real text to manufacture examples.
7. If needed, run `tests/diagnostics.playwright.js`. It stops automatically after ten minutes. Inspect a compact summary of `window.__ghOtDiagnostics.snapshot()` plus only relevant recent events; do not dump the full event array. Track the event's editor, especially when multiple editors are open. Call `.stop()` when done.
8. Ask the user to reproduce the remaining live-only issue without reloading. Reapply after a full reload; temporary injection does not survive it. `tests/stop.playwright.js` or `window.__githubOverType.destroy()` explicitly restores native controls.

Generated injection snippets can be large. Filter MCP output before presenting it:

```js
const result = await tools.mcp__brave_work__browser_run_code_unsafe({ filename: absolutePath });
for (const item of result.content ?? []) {
  if (item.text) text(item.text.split('### Ran Playwright code')[0]);
}
if (result.isError) throw new Error('Browser operation failed');
```

If MCP screenshots are blank, use native macOS capture after permission is granted to the host terminal:

```sh
screencapture -x -o -l WINDOW_ID build/inspection.png
```

Discover the intended browser window ID each session with CoreGraphics `CGWindowListCopyWindowInfo`; do not reuse a hard-coded ID. Capture only the intended window. Visual inspection supplements measured caret/preview DOM-range alignment. The alignment mirror must preserve scrollbar styles and gutter width or wrapped-text measurements can be false positives.

Temporary injection is not a userscript-manager installation test. Verify metadata, dependency loading, page-context globals, execution timing and duplicate-install handling separately in a manager when access permits. State honestly when that has not been tested.

## Publishing

Commit/push/create releases only when the user authorizes publishing. Before a public push, inspect every tracked file and staged diff for private data, machine paths, credentials, screenshots and unrelated artifacts. Use an appropriate public/noreply Git identity; do not expose a private configured email inadvertently.

1. Bump `package.json` and the integration API version together; update lockfile, changelog and installation links.
2. Run a clean install, build and all tests. Confirm deterministic output with a second build and no artifact diff.
3. Smoke-test the build through shared-browser injection without changing form text. Record any unverified manager/live compatibility in release notes.
4. Commit source, tests, docs, lockfile and generated userscript. Push to the intended repository only. Tag `vX.Y.Z` and create a GitHub release attaching `userscripts/github-overtype.user.js` and its SHA-256 checksum.
5. Use `gh` for repository/release operations. Verify public visibility, release asset, installation URL and CI status; do not claim CI passed while it is pending.
6. Test the downloaded asset/checksum against the local artifact. Do not replace published release assets or rewrite tags silently; ship a new version for changes.

Sticky PR Navigation has its own version (`VERSION` in `src/github-sticky-pr.js`, read by the build) and tags `sticky-pr-vX.Y.Z`. Do not bump OverType or the package version for a sticky-only release. Attach `userscripts/github-sticky-pr.user.js` and a basename-only `SHA256SUMS` to its release; document which script each changelog/release concerns. The shared CI runs both scripts' suites.

The release artifacts' metadata points updates to their main-branch raw userscripts. Keep that branch installable. No automatic publishing workflow exists; CI only checks builds and tests.
