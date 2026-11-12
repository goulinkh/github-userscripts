# Changelog

## Google Docs Markdown Clipboard 0.1.1

- Pasting from Markdown no longer leaves an empty line, or a line break before the rest of the line, after the pasted content. Docs always ends the paste with a paragraph break, whatever the clipboard ends with; the script removes it with one Backspace once the paste lands. The break is kept when the pasted Markdown ends with a code block, table or horizontal rule, and the Backspace is skipped if you press a key or click before the paste lands. Undo first undoes that Backspace, then the paste.

## Google Docs Markdown Clipboard 0.1.0

- First version of the separate Google Docs Markdown Clipboard userscript.
- ⌘C/Ctrl+C in a document runs Docs' Copy as Markdown, and ⌘V/Ctrl+V runs Paste from Markdown, through the existing menu commands.
- Falls back to native copy/paste when the Markdown command is disabled or hidden, when clipboard permission is denied (paste), or outside Chrome-based browsers (paste).
- Content copied from Google Docs, Sheets or Slides (including ⌘X/Ctrl+X cuts) keeps pasting natively with full formatting.
- Other shortcuts and inputs outside the document body are unchanged.

## Repository rename (OverType 0.1.3, Sticky PR Navigation 0.1.1, Google Docs Copy as Markdown 0.2.1)

- Repository renamed from `github-userscripts` to `userscripts`; update, download, homepage and support links point to the new name. The namespace is unchanged, so installed copies update in place. No behavior changes.

## Google Docs Copy as Markdown 0.2.0 (unreleased)

- New option in the right-click menu for how comments appear: hidden HTML comments in place (default), visible quote blocks in place, or a list at the end that names each comment's quoted text, surrounding sentence and section.
- Google rate-limiting exports (HTTP 429) now shows "try again in a minute" instead of a bare HTTP error.

## Google Docs Copy as Markdown 0.1.0 (pushed to main, not released)

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
