# YS Obsidian Kanban

Young Security's maintained copy of the Markdown-backed Kanban plugin for Obsidian.

This independently owned repository preserves the upstream Git history through [`obsidian-community/obsidian-kanban`](https://github.com/obsidian-community/obsidian-kanban) release `2.0.51`, commit `8501981a1afacb4c8fc03ec60604aa5eedfbd857`. Young Security maintenance begins with `2.0.51+ys.1`.

## Versioning

Young Security releases use:

```text
X.Y.Z+ys.N
```

- `X.Y.Z` identifies the adopted upstream base.
- `N` starts at `1` and increments for Young Security changes.
- Adopting a newer upstream base resets `N` to `1`.
- This repository does not publish a bare `X.Y.Z` release as a Young Security release.

SemVer build metadata does not affect version precedence. GitHub tags distinguish `+ys.N` releases, but installers that ignore build metadata may require a manual update.

## 2.0.51+ys.1 rendering fix

Kanban 2.0.51 detached rendered Markdown whenever a card left a lane's observed viewport. Dynamic Markdown processors such as Tasks can populate or resize content asynchronously, leaving the cached placeholder measurement stale and causing a query card to appear blank after window resizing.

YS Obsidian Kanban keeps board-card Markdown mounted while retaining:

- lane intersection tracking used by drag and drop;
- restoration of previews detached by an older cached view;
- table-view virtualization;
- existing board Markdown, frontmatter, lanes, and cards;
- compatibility with the Tasks plugin without modifying Tasks code.

## Development

Requirements:

- Node.js 20
- Bun for tests

```bash
npm install --ignore-scripts
bun test
npx eslint src/components/MarkdownRenderer/MarkdownRenderer.tsx src/components/MarkdownRenderer/markdownVisibility.ts
npm run build
```

Release artifacts are generated at the repository root:

- `main.js`
- `manifest.json`
- `styles.css`

The inherited full-project typecheck and lint commands currently report upstream legacy errors unrelated to this fix. CI runs the focused regression tests, targeted lint, and production build.

## Switching from upstream Kanban 2.0.51

YS Obsidian Kanban retains the original plugin ID, `obsidian-kanban`, as a drop-in replacement. Existing board Markdown and `.obsidian/plugins/obsidian-kanban/data.json` settings remain in place.

Do not install the upstream build and this maintained copy as separate active plugins. They register the same plugin ID, view type, and commands.

### Manual installation

1. Back up or commit your vault.
2. Disable the existing **Kanban** plugin in Obsidian.
3. Make a backup copy of `.obsidian/plugins/obsidian-kanban/`.
4. Keep the existing `data.json` file.
5. Replace only these files with assets from the YS Obsidian Kanban GitHub release:
   - `main.js`
   - `manifest.json`
   - `styles.css`
6. Reload Obsidian once, then enable **YS Kanban**.
7. Verify existing boards, Tasks query cards, drag and drop, and both short and tall window heights.

### BRAT installation

While the plugin is disabled, add `youngsecurity/ys-obsidian-kanban` through BRAT. Confirm that BRAT installs the release under the existing `obsidian-kanban` plugin ID, reload Obsidian once, and then enable YS Kanban.

### Restoring 2.0.51

If needed, disable YS Kanban, restore the backed-up `main.js`, `manifest.json`, and `styles.css`, preserve `data.json`, reload Obsidian once, and re-enable Kanban.

## Releases

A GitHub release tag exactly matches the version in `manifest.json`, without a `v` prefix. The first Young Security tag is:

```text
2.0.51+ys.1
```

Each release provides:

- `main.js`
- `manifest.json`
- `styles.css`

## License and attribution

The upstream license and Git history are preserved unchanged in this repository. See [`LICENSE.md`](LICENSE.md) for the applicable license text.

Young Security modifications are identified by versioned commits and release notes beginning with `2.0.51+ys.1` on July 23, 2026.
