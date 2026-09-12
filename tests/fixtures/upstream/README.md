# Upstream parser compatibility fixture

`parsers/formats/list.ts` is copied from obsidian-community/obsidian-kanban 2.0.51, commit `8501981a1afacb4c8fc03ec60604aa5eedfbd857`.

Only relative import paths were changed to `src/parsers/...` imports so the fixture can run against the inherited helpers. The parser helpers, Markdown extensions, and Markdown parser used by this fixture are unchanged from that upstream revision. The upstream MIT license is preserved in the repository's `LICENSE.md`.

`tests/pinnedMarkdown.test.ts` passes board Markdown through this unmodified upstream parsing/serialization behavior and back through the maintained parser. This verifies format compatibility, not the upstream Obsidian UI or third-party plugin behavior.
