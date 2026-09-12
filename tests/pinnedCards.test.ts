import { describe, expect, test } from 'bun:test';

import { getMoveToLaneInsertionIndex } from '../src/components/Item/moveDestination';
import type { Board, Item, Lane } from '../src/components/types';
import {
  groupPinnedItems,
  insertBoardEntities,
  insertPinnedItems,
  moveBoardEntity,
  normalizePinnedBoard,
  toggleItemPinned,
} from '../src/helpers/pinnedCards';

// Obsidian supplies this nonstandard Array method at runtime.
Object.defineProperty(Array.prototype, 'last', {
  configurable: true,
  value() {
    return this[this.length - 1];
  },
});

function item(id: string, pinned = false): Item {
  return {
    id,
    type: 'item',
    accepts: ['item'],
    children: [],
    data: {
      pinned,
      title: id,
      titleRaw: id,
      titleSearch: id,
      titleSearchRaw: id,
      checked: false,
      checkChar: ' ',
      metadata: {},
    },
  };
}
function board(...groups: Item[][]): Board {
  const children: Lane[] = groups.map((children, index) => ({
    id: `lane-${index}`,
    type: 'lane',
    accepts: ['item'],
    children,
    data: { title: `Lane ${index}` },
  }));
  return {
    id: 'board',
    type: 'board',
    accepts: [],
    children,
    data: {
      archive: [],
      frontmatter: {},
      settings: {},
      isSearching: false,
      errors: [],
    },
  };
}
const ids = (items: Item[]) => items.map((item) => item.id);

const p = item('p', true),
  q = item('q', true),
  a = item('a'),
  b = item('b');

describe('pinned card ordering', () => {
  test('stable partition and no-op identity', () => {
    expect(ids(groupPinnedItems([a, p, b, q]))).toEqual(['p', 'q', 'a', 'b']);
    const original = [p, q, a];
    expect(groupPinnedItems(original)).toBe(original);
    const originalBoard = board(original);
    expect(normalizePinnedBoard(originalBoard)).toBe(originalBoard);
  });
  test('pin joins the group end; unpin joins the ordinary section start', () => {
    const pinned = toggleItemPinned(board([p, a, b]), [0, 2]);
    expect(ids(pinned.children[0].children)).toEqual(['p', 'b', 'a']);
    expect(pinned.children[0].children[1].data.pinned).toBe(true);
    const unpinned = toggleItemPinned(pinned, [0, 0]);
    expect(ids(unpinned.children[0].children)).toEqual(['b', 'p', 'a']);
    expect(unpinned.children[0].children[1].data.pinned).toBe(false);
  });
  test.each(['prepend', 'prepend-compact', 'append', undefined] as const)(
    'Move to list respects %s inside the ordinary section',
    (method) => {
      const source = board([b], [p, q, a]);
      const index = getMoveToLaneInsertionIndex(method, 3);
      const result = moveBoardEntity(source, [0, 0], [1, index]);
      expect(ids(result.children[1].children)).toEqual(
        method?.startsWith('prepend') ? ['p', 'q', 'b', 'a'] : ['p', 'q', 'a', 'b']
      );
      expect(source.children[0].children).toEqual([b]);
    }
  );
  test('ordinary drops cannot enter the pinned group at any drop index', () => {
    for (let i = 0; i <= 4; i++) {
      const result = moveBoardEntity(board([p, q, a, b]), [0, 3], [0, i]);
      expect(ids(result.children[0].children).slice(0, 2)).toEqual(['p', 'q']);
      expect(result.children[0].children).toHaveLength(4);
    }
  });
  test('pins can be reordered in the same list but never below ordinary cards', () => {
    expect(ids(moveBoardEntity(board([p, q, a]), [0, 1], [0, 0]).children[0].children)).toEqual([
      'q',
      'p',
      'a',
    ]);
    expect(ids(moveBoardEntity(board([p, q, a]), [0, 0], [0, 3]).children[0].children)).toEqual([
      'q',
      'p',
      'a',
    ]);
  });
  test('cross-list and cross-board pinned moves join the group end', () => {
    expect(ids(moveBoardEntity(board([p], [q, a]), [0, 0], [1, 0]).children[1].children)).toEqual([
      'q',
      'p',
      'a',
    ]);
    expect(ids(insertBoardEntities(board([q, a]), [0, 0], [p]).children[0].children)).toEqual([
      'q',
      'p',
      'a',
    ]);
  });
  test('insert-before, external drops, and batches stay below pins', () => {
    expect(ids(insertBoardEntities(board([p, q]), [0, 0], [a, b]).children[0].children)).toEqual([
      'p',
      'q',
      'a',
      'b',
    ]);
    expect(ids(insertPinnedItems([p, a], [b, q], 0))).toEqual(['p', 'q', 'b', 'a']);
    expect(ids(insertPinnedItems([], [a, p, b, q], 0))).toEqual(['p', 'q', 'a', 'b']);
  });
  test('same-list recurrence replacement does not lose or misplace cards', () => {
    const replacement = item('recurrence');
    const result = moveBoardEntity(board([p, a, b]), [0, 1], [0, 3], undefined, () => replacement);
    expect(ids(result.children[0].children)).toEqual(['p', 'recurrence', 'b', 'a']);
  });
  test('lane moves preserve existing generic behavior', () => {
    const original = board([p, a], [q, b]);
    expect(moveBoardEntity(original, [0], [2]).children.map((lane) => lane.id)).toEqual([
      'lane-1',
      'lane-0',
    ]);
  });
});
