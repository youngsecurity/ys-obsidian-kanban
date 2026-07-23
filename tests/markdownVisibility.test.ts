import { describe, expect, test } from 'bun:test';

import { syncMarkdownPreviewVisibility } from '../src/components/MarkdownRenderer/markdownVisibility';

class PreviewDouble {
  isVisible = true;
  showCalls = 0;
  hideCalls = 0;

  show() {
    this.isVisible = true;
    this.showCalls += 1;
  }

  hide() {
    this.isVisible = false;
    this.hideCalls += 1;
  }
}

describe('syncMarkdownPreviewVisibility', () => {
  test('keeps rendered markdown attached when a card leaves the viewport', () => {
    const preview = new PreviewDouble();

    syncMarkdownPreviewVisibility(preview, false);

    expect(preview.hideCalls).toBe(0);
    expect(preview.isVisible).toBe(true);
  });

  test('reattaches a previously detached cached preview when it becomes visible', () => {
    const preview = new PreviewDouble();
    preview.isVisible = false;

    syncMarkdownPreviewVisibility(preview, true);

    expect(preview.showCalls).toBe(1);
    expect(preview.isVisible).toBe(true);
  });
});
