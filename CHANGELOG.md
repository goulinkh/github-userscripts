# Changelog

## Google Docs Copy as Markdown 0.1.0 (unreleased)

- First version of the separate Google Docs userscript.
- Compact Markdown icon button beside Share copies Google's Markdown export to the clipboard.
- Copies with comments by default; Shift, ⌘ or Ctrl-click copies the other variant. A right-click menu chooses the default, saved per browser.
- Comments are added as HTML comments directly after the block they belong to, with author, exact quoted text and replies, read from the Word export.
- Clipboard write starts within the click so slow exports keep the user gesture; falls back to plain text writing.
- If the clipboard is refused after exporting (for example, the tab lost focus), the prepared text is kept and the next click copies it.
- Records recent failures (phase, error, timing, focus) in `status().failures` and the console, without document text.
- Clear failures for HTTP errors and non-Markdown responses; keeps editor focus; remounts after title-bar re-renders.

## Sticky PR Navigation 0.1.0

- First release of the separate sticky PR navigation userscript.
- Compact 36px pinned tabs with full-width background and preserved selected-tab indicator.
- View-specific alignment: centered on Overview, wider content gutters on Changes.
- Coordinated offsets for GitHub's native sticky toolbar, active diff headers and file tree.
- Preserved layout space, responsive sizing, route cleanup and safe reapplication.

The versions below refer to GitHub OverType Comments.

## 0.1.2

- Notify GitHub when the visible editor gains focus so lazily loaded mention suggestions do not remain stuck loading.
- Keep actual focus in OverType without changing text or emitting input/change events.
- Add six regression checks for lazy suggestion loading and focus forwarding.

## 0.1.1

- Match the hidden field's text metrics to OverType so content-sized fields do not leave excess trailing space.
- Remove the integration's fixed height floor while retaining GitHub's minimum/maximum sizes.
- Restore vertical resizing: dragging the grip resizes the real field and overlay together.
- Add real mouse-drag sizing regression tests.

## 0.1.0

First public release of GitHub OverType Comments: persistent OverType editing, GitHub-token styling, Markdown list/fence completion, JS/TS highlighting, and autocomplete keyboard forwarding.
