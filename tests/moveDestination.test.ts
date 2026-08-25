import { describe, expect, test } from 'bun:test';

import { getMoveToLaneInsertionIndex } from '../src/components/Item/moveDestination';

describe('getMoveToLaneInsertionIndex', () => {
  test('appends to the end of the destination lane when the setting is append', () => {
    expect(getMoveToLaneInsertionIndex('append', 4)).toBe(4);
  });

  test('defaults to append when the setting is unset', () => {
    expect(getMoveToLaneInsertionIndex(undefined, 3)).toBe(3);
  });

  test('inserts at the top when the setting is prepend', () => {
    expect(getMoveToLaneInsertionIndex('prepend', 4)).toBe(0);
  });

  test('inserts at the top when the setting is prepend-compact', () => {
    expect(getMoveToLaneInsertionIndex('prepend-compact', 4)).toBe(0);
  });

  test('appends into an empty lane at index 0', () => {
    expect(getMoveToLaneInsertionIndex('append', 0)).toBe(0);
  });
});
