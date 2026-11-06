# Changelog

## Sticky PR Navigation 0.1.0

- First release of the separate sticky PR navigation userscript.
- Compact 36px pinned tabs with full-width background and preserved selected-tab indicator.
- View-specific alignment: centered on Overview, wider content gutters on Changes.
- Coordinated offsets for GitHub's native sticky toolbar, active diff headers and file tree.
- Preserved layout space, responsive sizing, route cleanup and safe reapplication.

The versions below refer to GitHub OverType Comments.

## 0.1.1

- Match the hidden field's text metrics to OverType so content-sized fields do not leave excess trailing space.
- Remove the integration's fixed height floor while retaining GitHub's minimum/maximum sizes.
- Restore vertical resizing: dragging the grip resizes the real field and overlay together.
- Add real mouse-drag sizing regression tests.

## 0.1.0

First public release of GitHub OverType Comments: persistent OverType editing, GitHub-token styling, Markdown list/fence completion, JS/TS highlighting, and autocomplete keyboard forwarding.
