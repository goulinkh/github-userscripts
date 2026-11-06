# Agent guide

## Scope and release layout

This public repository contains GitHub userscripts. The first is GitHub OverType Comments. Keep unrelated future scripts separate; do not add speculative features during maintenance.

- `src/github-overtype.js`: integration and editor lifecycle. Keep runtime source free of explanatory comments; put explanations here or in documentation.
- `src/highlighter.js`: Twinkleplop adapter; escaped token spans and bounded cache.
- `userscripts/github-overtype.user.js`: committed, installable release artifact. Required userscript metadata and dependency license notices are exceptions to comment removal.
- `vendor/`: pinned OverType test bytes, SHA-256 checksum, dependency licenses.
- `scripts/`: reproducible build, checks, isolated browser test runner.
- `tests/`: Playwright function snippets, each accepting `page`.
- `build/`: ignored generated injection/fixture snippets and highlighter bundle.

Never edit only the generated userscript. Change source, rebuild, and commit the resulting artifact together when publishing is authorized.

## Behavioral invariants

OverType is always the visible editor. Do not add automatic native fallback or an editor-switch button. GitHub's textarea is an inert, hidden-text React/form bridge, not disabled: it must still participate in FormData. Its public focus method forwards to its own OverType input; cleanup restores original properties, attributes, listeners and wrapper styles.

Preserve existing text, selection and focus during reapplication. Initialization must dispatch no native input/change events. Native input/change updates synchronize immediately; polling handles silent property changes. Synchronous host insertions during bridge dispatch must not be overwritten with stale text.

Both text layers share GitHub's monospace stack, small text token, line-height and padding. Use live CSS variable references, not copied resolved colors/sizes. Keep editing overlays transparent so the original input paints its own background. Inline-important padding is necessary because GitHub's layered important rules outrank unlayered rules regardless of specificity. Typography selectors must outrank OverType's stylesheet even on first initialization, when its stylesheet is injected later.

Keep fenced-code body/fence backgrounds joined without interior rounded corners. Highlighting changes color only, not metrics. Preserve code byte-for-byte at the JavaScript string level, including whitespace and Unicode; escape HTML and retain gaps between token ranges. Unknown languages, tokenizer failures, JSX/TSX and blocks over the cutoff remain plain. Do not enable ANSI rendering that strips source escape sequences.

Ordinary editing keys are handled locally before GitHub's bubbling shortcuts; call OverType's pinned handler exactly once. Smart lists stay enabled. IME composition bypasses smart transformations. Shift+Enter remains a plain newline. Fence completion stays undoable and does not duplicate an existing closer.

An expanded textarea combobox with its own visible ARIA listbox gets unmodified Enter/Tab/Escape/Up/Down forwarded to that original textarea. Only a consumed key skips OverType handling. Do not route keys to unrelated/global popups or move focus to the native field. Mirror combobox ARIA attributes to the visible input. Synthetic-key acceptance is host-dependent; fixture success is not proof of every live GitHub popup.

## Safety on real GitHub

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

Use the work-profile browser MCP, not an unrelated personal profile. Re-list shared tabs before selecting one; indices and connections change. The user must explicitly share the relevant tab. Do not inspect unshared browser profiles or navigate a replacement tab over existing unsaved work.

1. Reproduce safely in the fixture before patching. Inspect actual live computed styles/ARIA relationships when the problem is host-specific. Do not assume the reported mechanism is the cause.
2. Rebuild. Create/select a new `about:blank` tab and run `build/fixture.playwright.js` via `browser_run_code_unsafe({filename: ABSOLUTE_PATH})`.
3. Run applicable `tests/*.playwright.js` functions. Useful sequence: fixture → theme → alignment → fixture → editing → focus-handoff → native-visibility → autocomplete → highlighting → fixture → test. The lifecycle `test` suite leaves the integration stopped.
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

The release artifact's metadata points updates to the main-branch raw userscript. Keep that branch installable. No automatic publishing workflow exists; CI only checks builds and tests.
