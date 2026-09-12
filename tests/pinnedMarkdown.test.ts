import { describe, expect, mock, test } from 'bun:test';

// Stub host APIs and UI-only settings/metadata modules. Parsing, serialization,
// hydration, and card ordering below use the production implementation.
mock.module('obsidian', () => ({
  moment: () => ({ format: () => '', isValid: () => false }),
  stringifyYaml: (value: Record<string, unknown>) =>
    Object.entries(value)
      .map(([k, v]) => `${k}: ${v}\n`)
      .join(''),
  parseYaml: () => ({ 'kanban-plugin': 'board' }),
  TFile: class {},
  TFolder: class {},
  MarkdownView: class {},
  Keymap: {},
  Menu: class {},
}));
mock.module('obsidian-dataview', () => ({ getAPI: () => undefined }));
mock.module('../src/Settings', () => ({ settingKeyLookup: new Set() }));
mock.module('../src/components/Item/MetadataTable', () => ({ anyToString: String }));
Object.assign(globalThis, {
  window: { localStorage: { getItem: () => 'en' } },
  app: { vault: { getConfig: () => false }, plugins: { enabledPlugins: new Set() } },
});
Object.defineProperty(Array.prototype, 'first', {
  configurable: true,
  value() {
    return this[0];
  },
});
Object.defineProperty(Array.prototype, 'last', {
  configurable: true,
  value() {
    return this[this.length - 1];
  },
});

const { astToUnhydratedBoard, boardToMd, newItem, updateItemContent, reparseBoard } = await import(
  '../src/parsers/formats/list'
);
const { parseFragment } = await import('../src/parsers/parseMarkdown');
const { pinnedMarker } = await import('../src/parsers/helpers/pinnedMetadata');
const upstream = await import('./fixtures/upstream/parsers/formats/list');
const { getBoardModifiers } = await import('../src/helpers/boardModifiers');
const { normalizePinnedBoard, insertBoardEntities } = await import('../src/helpers/pinnedCards');

const stateManager = {
  file: { path: 'board.md' },
  app: { metadataCache: { getFirstLinkpathDest: () => null } },
  getSetting: (key: string) =>
    ({
      'date-trigger': '@',
      'time-trigger': '@@',
      'date-colors': [],
      'move-tags': false,
      'move-dates': false,
    })[key],
  setError: (error: unknown) => {
    throw error;
  },
};

function parse(md: string) {
  return astToUnhydratedBoard(
    stateManager,
    {},
    { 'kanban-plugin': 'board' },
    parseFragment(stateManager, md),
    md
  );
}
function modifiers(md: string) {
  const manager = {
    ...stateManager,
    state: parse(md),
    setState(fn) {
      this.state = normalizePinnedBoard(fn(this.state));
    },
    updateItemContent(item, content) {
      return updateItemContent(this, item, content);
    },
  };
  return { manager, operations: getBoardModifiers({}, manager) };
}

function roundTrip(content: string, withBlockId = true) {
  const original = newItem(stateManager, content, ' ');
  const pinned = {
    ...original,
    data: { ...original.data, pinned: true, blockId: withBlockId ? 'card-id' : undefined },
  };
  const board = parse('## Tasks\n\n- [ ] Placeholder\n');
  board.children[0].children = [pinned];
  const md = boardToMd(board);
  return { original, pinned, md, parsed: parse(md).children[0].children[0] };
}

describe('board modifier insertion paths', () => {
  const md = `## Tasks\n\n- [ ] P ${pinnedMarker}\n- [ ] Q ${pinnedMarker}\n- [ ] A\n`;
  test.each(['prependItems', 'appendItems', 'insertItems'])(
    '%s keeps ordinary cards below the pins',
    (method) => {
      const { manager, operations } = modifiers(md);
      operations[method]([0, 0], [newItem(manager, 'New', ' ')]);
      const titles = manager.state.children[0].children.map((item) => item.data.titleRaw);
      expect(titles).toEqual(
        method === 'appendItems' ? ['P', 'Q', 'A', 'New'] : ['P', 'Q', 'New', 'A']
      );
    }
  );
  test('duplicates start unpinned without changing the original pin', () => {
    const { manager, operations } = modifiers(md);
    operations.duplicateEntity([0, 0]);
    const cards = manager.state.children[0].children;
    expect(cards.map((item) => item.data.titleRaw)).toEqual(['P', 'Q', 'P', 'A']);
    expect(cards.map((item) => !!item.data.pinned)).toEqual([true, true, false, false]);
    expect(cards[0].id).not.toBe(cards[2].id);
  });
  test('archiving and restoring a pin retains its state and joins the group end', () => {
    const { manager, operations } = modifiers(md);
    operations.archiveItem([0, 0]);
    const archived = manager.state.data.archive[0];
    expect(archived.data.pinned).toBe(true);
    manager.state = insertBoardEntities(manager.state, [0, 0], [archived]);
    expect(manager.state.children[0].children.map((item) => item.data.titleRaw)).toEqual([
      'Q',
      'P',
      'A',
    ]);
    expect(parse(boardToMd(manager.state)).data.archive[0].data.pinned).toBe(true);
  });
  test('replacement preserves pin order; split cards stay below remaining pins', () => {
    const { manager, operations } = modifiers(md);
    operations.replaceItem(
      [0, 0],
      [updateItemContent(manager, manager.state.children[0].children[0], 'Updated')]
    );
    expect(manager.state.children[0].children.map((item) => item.data.titleRaw)).toEqual([
      'Updated',
      'Q',
      'A',
    ]);
    operations.splitItem([0, 0], [newItem(manager, 'First', ' '), newItem(manager, 'Second', ' ')]);
    expect(manager.state.children[0].children.map((item) => item.data.titleRaw)).toEqual([
      'Q',
      'First',
      'Second',
      'A',
    ]);
  });
  test('Move to top and Move to bottom stay within the respective groups', () => {
    const { manager, operations } = modifiers(md);
    operations.moveItemToTop([0, 2]);
    expect(manager.state.children[0].children.map((item) => item.data.titleRaw)).toEqual([
      'P',
      'Q',
      'A',
    ]);
    operations.moveItemToBottom([0, 0]);
    expect(manager.state.children[0].children.map((item) => item.data.titleRaw)).toEqual([
      'Q',
      'P',
      'A',
    ]);
  });
});

describe('pinned Markdown review regressions', () => {
  test.each([true, false])(
    'preserves rendered multiline content across repeated reloads (block ID: %s)',
    (withBlockId) => {
      for (const content of [
        'First\nSecond',
        'Tasks query\n```tasks\nnot done\n```',
        '**First\nSecond**',
        '*First\nSecond*',
        '`First\nSecond`',
        '```tasks\nnot done\n```',
      ]) {
        const { original, parsed, md } = roundTrip(content, withBlockId);
        expect(parsed.data.titleRaw).toBe(original.data.titleRaw);
        expect(parsed.data.title).toBe(original.data.title);
        expect(parsed.data.pinned).toBe(true);
        let current = parsed;
        for (let i = 0; i < 4; i++) {
          current = updateItemContent(stateManager, current, current.data.titleRaw);
          expect(current.data.pinned).toBe(true);
          expect(current.data.titleRaw).toBe(original.data.titleRaw);
          expect(current.data.title).toBe(original.data.title);
        }
        const upstreamBoard = upstream.astToUnhydratedBoard(
          stateManager,
          {},
          {},
          parseFragment(stateManager, md),
          md
        );
        const restored = parse(upstream.boardToMd(upstreamBoard)).children[0].children[0];
        expect(restored.data.titleRaw).toBe(original.data.titleRaw);
        expect(restored.data.pinned).toBe(true);
      }
    }
  );
  test.each(['', ' ^card-id'])(
    'reads manually suffixed multiline metadata without collapsing newlines: %s',
    (blockId) => {
      const board = parse(
        `## Tasks\n\n- [ ] Tasks query ${pinnedMarker}${blockId}\n    \`\`\`tasks\n    not done\n    \`\`\`\n`
      );
      const item = board.children[0].children[0];
      expect(item.data.titleRaw).toBe('Tasks query\n```tasks\nnot done\n```');
      expect(item.data.title).toBe('Tasks query\n```tasks\nnot done\n```');
      expect(item.data.pinned).toBe(true);
    }
  );
  test.each(['```', '~~~'])('does not treat literal fence-info markers as pins: %s', (fence) => {
    const content = `${fence}html ${pinnedMarker}\nexample\n${fence}`;
    const ordinary = newItem(stateManager, content, ' ');
    expect(ordinary.data.pinned).toBe(false);
    expect(ordinary.data.titleRaw).toBe(content);
    const { parsed } = roundTrip(content, false);
    expect(parsed.data.pinned).toBe(true);
    expect(parsed.data.titleRaw).toBe(content);
  });
});

describe('pinned Markdown', () => {
  test('round trips the marker before a block ID, outside editable/search text', () => {
    const { md, parsed } = roundTrip('Tasks query');
    expect(md).toContain(`- [ ] Tasks query ${pinnedMarker} ^card-id`);
    expect(parsed.data.pinned).toBe(true);
    expect(parsed.data.blockId).toBe('card-id');
    expect(parsed.data.titleRaw).toBe('Tasks query');
    expect(parsed.data.title).toBe('Tasks query');
    expect(parsed.data.titleSearchRaw).not.toContain('ys-kanban');
  });
  test.each([
    'First line\nSecond line',
    '```tasks\nnot done\n```',
    '~~~tasks\nnot done\n~~~',
    '',
    '> Quoted text',
  ])('round trips multiline/block-first content: %s', (content) => {
    const { original, parsed } = roundTrip(content);
    expect(parsed.data.pinned).toBe(true);
    expect(parsed.data.blockId).toBe('card-id');
    expect(parsed.data.titleRaw).toBe(original.data.titleRaw);
  });
  test('card edits and board reparsing retain pins without duplicate markers', () => {
    const { pinned } = roundTrip('Old title');
    const edited = updateItemContent(stateManager, pinned, 'New title\nMore text');
    expect(edited.data.pinned).toBe(true);
    expect(edited.data.titleRaw).toBe('New title\nMore text');
    const board = parse(`## Tasks\n\n- [ ] A ${pinnedMarker}\n`);
    const reparsed = reparseBoard(stateManager, board);
    expect(reparsed.children[0].children[0].data.pinned).toBe(true);
    expect(boardToMd(reparsed).match(/ys-kanban:pinned/g)).toHaveLength(1);
  });
  test('unmarked boards and literal examples are not pinned', () => {
    for (const content of [
      'Ordinary',
      `Example \`${pinnedMarker}\``,
      `Before ${pinnedMarker} after`,
      `First\n${pinnedMarker}`,
      `\`\`\`html\n${pinnedMarker}\n\`\`\``,
      `\\<!-- ys-kanban:pinned -->`,
      '<!-- ys-kanban:pin=0 -->',
    ]) {
      const item = newItem(stateManager, content, ' ');
      expect(item.data.pinned).toBe(false);
      expect(item.data.titleRaw).toBe(content);
    }
  });
  test.each(['Tasks query', 'First\nSecond', '```tasks\nnot done\n```', ''])(
    'survives an upstream 2.0.51 round trip: %s',
    (content) => {
      const { md, original } = roundTrip(content);
      const upstreamBoard = upstream.astToUnhydratedBoard(
        stateManager,
        {},
        { 'kanban-plugin': 'board' },
        parseFragment(stateManager, md),
        md
      );
      const upstreamMd = upstream.boardToMd(upstreamBoard);
      expect(upstreamMd).toContain(pinnedMarker);
      const restored = parse(upstreamMd).children[0].children[0];
      expect(restored.data.pinned).toBe(true);
      expect(restored.data.titleRaw).toBe(original.data.titleRaw);
      expect(restored.data.blockId).toBe('card-id');
    }
  );
  test('external edits group pins stably and archives retain markers', () => {
    const board = parse(
      `## Tasks\n\n- [ ] A\n- [ ] P ${pinnedMarker}\n- [ ] B\n- [ ] Q ${pinnedMarker}\n\n***\n\n## Archive\n\n- [x] Archived ${pinnedMarker}\n`
    );
    expect(board.children[0].children.map((item) => item.data.titleRaw)).toEqual([
      'P',
      'Q',
      'A',
      'B',
    ]);
    expect(board.data.archive[0].data.pinned).toBe(true);
    expect(parse(boardToMd(board)).data.archive[0].data.pinned).toBe(true);
  });
});
