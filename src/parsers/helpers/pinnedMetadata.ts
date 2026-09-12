import type { ListItem } from 'mdast-util-from-markdown/lib';

export const pinnedMarker = '<!-- ys-kanban:pinned -->';

/** Only a real HTML comment at the first line's metadata suffix is a pin. */
export function getPinnedMarkerRange(md: string, item: ListItem) {
  const firstLine = md.slice(item.position.start.offset).split(/\r?\n/, 1)[0];
  // The inherited task extension can expose a fence's info string as paragraph
  // HTML because a checkbox precedes it. Check the source as well as the AST.
  if (/^(?:[-+*]|\d+[.)])[ \t]+(?:\[[^\]]*\][ \t]*)?(?:`{3,}|~{3,})/.test(firstLine)) {
    return undefined;
  }
  for (const child of item.children) {
    const nodes = child.type === 'paragraph' ? child.children : [child];
    for (const node of nodes) {
      if (node.type !== 'html' || node.value !== pinnedMarker) continue;
      if (node.position.start.line !== item.position.start.line) continue;
      const start = node.position.start.offset;
      const end = node.position.end.offset;
      const lineEnd = md.indexOf('\n', end);
      const suffix = md.slice(end, lineEnd === -1 ? md.length : lineEnd);
      if (/^[ \t]*(?:\^[a-zA-Z0-9-]+)?[ \t]*\r?$/.test(suffix)) return { start, end };
    }
  }
  return undefined;
}

export function addPinnedMetadata(content: string, pinned: boolean | undefined): string {
  if (!pinned) return content;
  // Multiline inline formatting/code can contain a first-line suffix, and a
  // fence would treat it as an info string. Keep metadata outside that content.
  if (/[\r\n]/.test(content) || /^\s*(?:`{3,}|~{3,}|>|#{1,6}\s|[-+*]\s|\d+[.)]\s)/.test(content)) {
    return `${pinnedMarker}\n${content}`;
  }
  const lines = content.split(/\r?\n/);
  lines[0] = lines[0] ? `${lines[0]} ${pinnedMarker}` : pinnedMarker;
  return lines.join('\n');
}
