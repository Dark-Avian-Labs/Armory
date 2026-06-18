import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { clampTooltipLeft } from '../utils/clampTooltipLeft';

interface GlassTooltipProps {
  children: ReactNode;
  content: ReactNode;
  width?: string;
  disabled?: boolean;
}

interface TooltipPos {
  left: number;
  top: number;
  centered: boolean;
}

const WINDOW_REPOSITION_LISTENERS: AddEventListenerOptions = { capture: true, passive: true };

function sameTooltipPos(a: TooltipPos | null, b: TooltipPos): boolean {
  return a !== null && a.left === b.left && a.top === b.top && a.centered === b.centered;
}

export function GlassTooltip({ children, content, width = 'w-56', disabled }: GlassTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [hovered, setHovered] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const anchorCenterX = rect.left + rect.width / 2;
    const tooltipWidth = tooltipRef.current?.getBoundingClientRect().width ?? 0;

    if (tooltipWidth > 0) {
      const next: TooltipPos = {
        left: clampTooltipLeft(anchorCenterX, tooltipWidth),
        top: rect.top,
        centered: false,
      };
      setPos((prev) => (sameTooltipPos(prev, next) ? prev : next));
      return;
    }

    const next: TooltipPos = { left: anchorCenterX, top: rect.top, centered: true };
    setPos((prev) => (sameTooltipPos(prev, next) ? prev : next));
  }, []);

  useLayoutEffect(() => {
    if (!hovered || disabled) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [hovered, disabled, pos, content, width, updatePosition]);

  useEffect(() => {
    if (!hovered || disabled) return () => undefined;

    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, WINDOW_REPOSITION_LISTENERS);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, WINDOW_REPOSITION_LISTENERS);
    };
  }, [hovered, disabled, updatePosition]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered &&
        pos &&
        !disabled &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`glass-tooltip-surface pointer-events-none fixed z-[9999] mb-1 ${width} rounded-lg p-2`}
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.centered
                ? 'translate(-50%, calc(-100% - 0.25rem))'
                : 'translateY(calc(-100% - 0.25rem))',
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
