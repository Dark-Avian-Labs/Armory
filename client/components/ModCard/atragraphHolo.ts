export const ATRAGRAPH_HOLO_IDLE_POINTER = { px: 0.4, py: 0.35 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function adjust(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  return toMin + ((value - fromMin) * (toMax - toMin)) / (fromMax - fromMin);
}

export function getAtragraphHoloCssVars(px: number, py: number): Record<string, string> {
  const percentX = clamp(Math.round(px * 100), 0, 100);
  const percentY = clamp(Math.round(py * 100), 0, 100);
  const centerX = percentX - 50;
  const centerY = percentY - 50;
  const fromCenter = clamp(Math.sqrt(centerX * centerX + centerY * centerY) / 50, 0, 1);

  const bgY = adjust(percentY, 0, 100, 33, 67);
  const baseBgY = clamp(bgY - 11, 8, 92);
  const basePointerX = clamp(percentX + 7, 0, 100);
  const basePointerY = clamp(percentY - 6, 0, 100);

  return {
    '--holo-opacity': '1',
    '--holo-bg-y': `${bgY.toFixed(1)}%`,
    '--holo-pointer-x': `${percentX}%`,
    '--holo-pointer-y': `${percentY}%`,
    '--holo-pointer-from-center': fromCenter.toFixed(3),
    '--holo-base-bg-y': `${baseBgY.toFixed(1)}%`,
    '--holo-base-pointer-x': `${basePointerX}%`,
    '--holo-base-pointer-y': `${basePointerY}%`,
  };
}

export function getIdleAtragraphHoloCssVars(): Record<string, string> {
  return getAtragraphHoloCssVars(ATRAGRAPH_HOLO_IDLE_POINTER.px, ATRAGRAPH_HOLO_IDLE_POINTER.py);
}

export function applyAtragraphHoloCssVars(target: HTMLElement, px: number, py: number): void {
  for (const [key, value] of Object.entries(getAtragraphHoloCssVars(px, py))) {
    target.style.setProperty(key, value);
  }
}

export function applyIdleAtragraphHoloCssVars(target: HTMLElement): void {
  applyAtragraphHoloCssVars(target, ATRAGRAPH_HOLO_IDLE_POINTER.px, ATRAGRAPH_HOLO_IDLE_POINTER.py);
}
