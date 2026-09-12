import type { Board, Item } from '../components/types';
import type { Nestable, Path } from '../dnd/types';
import {
  getEntityFromPath,
  insertEntity,
  moveEntity,
  removeEntity,
  updateEntity,
} from '../dnd/util/data';

/** Stable partition. Preserve the original array when it is already grouped. */
export function groupPinnedItems<T extends { data: { pinned?: boolean } }>(items: T[]): T[] {
  const grouped = [
    ...items.filter((item) => item.data.pinned),
    ...items.filter((item) => !item.data.pinned),
  ];
  return grouped.every((item, index) => item === items[index]) ? items : grouped;
}

export function normalizePinnedBoard(board: Board): Board {
  const children = board.children.map((lane) => {
    const children = groupPinnedItems(lane.children);
    return children === lane.children ? lane : { ...lane, children };
  });
  return children.every((lane, index) => lane === board.children[index])
    ? board
    : { ...board, children };
}

/** Incoming pins join the pinned group's end; ordinary insertions stay below it. */
export function insertPinnedItems<T extends { data: { pinned?: boolean } }>(
  items: T[],
  incoming: T[],
  requestedIndex: number,
  reorderPinned = false
): T[] {
  const grouped = groupPinnedItems(items);
  const pinCount = grouped.filter((item) => item.data.pinned).length;
  const pins = incoming.filter((item) => item.data.pinned);
  const ordinary = incoming.filter((item) => !item.data.pinned);
  const pinIndex = reorderPinned ? Math.max(0, Math.min(requestedIndex, pinCount)) : pinCount;
  const ordinaryIndex = Math.max(pinCount, Math.min(requestedIndex, grouped.length));
  const result = [...grouped];
  result.splice(ordinaryIndex, 0, ...ordinary);
  result.splice(pinIndex, 0, ...pins);
  return result;
}

/** Board-specific insertion. Lane moves still use the generic DnD operations. */
export function insertBoardEntities(
  board: Board,
  destination: Path,
  entities: Nestable[],
  reorderPinned = false
): Board {
  if (destination.length !== 2)
    return normalizePinnedBoard(insertEntity(board, destination, entities));
  const lane = board.children[destination[0]];
  return updateEntity(board, [destination[0]], {
    children: { $set: insertPinnedItems(lane.children, entities, destination[1], reorderPinned) },
  });
}

export function moveBoardEntity(
  board: Board,
  source: Path,
  destination: Path,
  transform?: (entity: Nestable) => Nestable | Nestable[],
  replace?: (entity: Nestable) => Nestable
): Board {
  if (source.length !== 2 || destination.length !== 2) {
    return normalizePinnedBoard(moveEntity(board, source, destination, transform, replace));
  }
  const original = getEntityFromPath(board, source);
  const transformed = transform ? transform(original) : original;
  const replacement = replace?.(original);
  const sameLane = source[0] === destination[0];
  const requestedIndex =
    destination[1] - (sameLane && source[1] < destination[1] && !replacement ? 1 : 0);
  const removed = removeEntity(board, source, replacement);
  const lane = removed.children[destination[0]];
  return updateEntity(removed, [destination[0]], {
    children: {
      $set: insertPinnedItems(
        lane.children,
        Array.isArray(transformed) ? transformed : [transformed],
        requestedIndex,
        sameLane
      ),
    },
  });
}

export function toggleItemPinned(board: Board, path: Path): Board {
  const lane = board.children[path[0]];
  const item = lane.children[path[1]];
  const changed: Item = { ...item, data: { ...item.data, pinned: !item.data.pinned } };
  const remaining = lane.children.filter((_, index) => index !== path[1]);
  return updateEntity(board, [path[0]], {
    data: { $unset: ['sorted'] },
    children: { $set: insertPinnedItems(remaining, [changed], 0) },
  });
}
