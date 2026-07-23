export interface MarkdownPreviewVisibility {
  isVisible: boolean;
  show(): void;
}

/**
 * Keep board-card markdown mounted when it leaves a lane's viewport.
 *
 * Dynamic markdown processors, such as Tasks queries, can update their height
 * asynchronously. Detaching their DOM based on a stale cached measurement can
 * leave a visible card blank after a viewport resize. We still restore previews
 * that were detached by an older cached view, but we no longer detach them here.
 */
export function syncMarkdownPreviewVisibility(
  preview: MarkdownPreviewVisibility,
  isVisible: boolean
) {
  if (isVisible && !preview.isVisible) {
    preview.show();
  }
}
