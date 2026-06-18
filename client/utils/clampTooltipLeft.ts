export const TOOLTIP_VIEWPORT_EDGE_PADDING = 8;

export function clampTooltipLeft(
  anchorCenterX: number,
  tooltipWidth: number,
  viewportWidth = window.innerWidth,
  padding = TOOLTIP_VIEWPORT_EDGE_PADDING,
): number {
  const idealLeft = anchorCenterX - tooltipWidth / 2;
  return Math.max(padding, Math.min(idealLeft, viewportWidth - tooltipWidth - padding));
}
