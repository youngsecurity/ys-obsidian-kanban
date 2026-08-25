## 2.0.51+ys.2 (2026-08-25)

- Make the card menu "Move to list" action respect the `Prepend / append new cards` setting instead of always inserting at the top of the destination list.
- With `Append` (the default), cards moved between lists via the menu now land at the bottom, leaving cards at the top of the list, such as Tasks query cards, in place.
- `Prepend` and `Prepend (compact)` keep the previous insert-at-top behavior.
- Add focused regression tests for the new insertion-index helper.

## 2.0.51+ys.1 (2026-07-23)

- Keep dynamic Markdown cards mounted when they leave a lane viewport.
- Prevent Tasks and other asynchronously rendered code blocks from appearing blank after window resizing.
- Preserve Kanban drag-and-drop visibility tracking and table-view virtualization.
- Establish the Young Security maintained copy as a drop-in replacement for `obsidian-kanban`.

Young Security's first maintained release, based on upstream Kanban 2.0.51.
