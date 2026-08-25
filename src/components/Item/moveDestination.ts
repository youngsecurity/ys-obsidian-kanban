export type InsertionMethod = 'prepend' | 'prepend-compact' | 'append';

/**
 * Index at which a card moved via the "Move to list" menu should be inserted
 * in the destination lane. Mirrors the `new-card-insertion-method` handling in
 * DragDropApp: only an explicit `append` (or unset, which defaults to append)
 * inserts at the end; both prepend variants insert at the top.
 */
export function getMoveToLaneInsertionIndex(
  insertionMethod: InsertionMethod | undefined,
  laneChildrenCount: number
): number {
  return (insertionMethod || 'append') === 'append' ? laneChildrenCount : 0;
}
