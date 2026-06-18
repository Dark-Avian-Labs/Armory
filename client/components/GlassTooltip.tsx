import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { clampTooltipLeft } from '../utils/clampTooltipLeft';

interface GlassTooltipProps {
  children: ReactNode;
  content: ReactNode;
  width?: string;
  disabled?: boolean;
}

const WINDOW_REPOSITION_LISTENERS: AddEventListenerOptions = { capture: true, passive: true };

export function GlassTooltip({ children, content, width = 'w-56', disabled }: GlassTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; centered: boolean } | null>(null);
  const [hovered, setHovered] = useState(false);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const anchorCenterX = rect.left + rect.width / 2;
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 0;

    if (tooltipWidth > 0) {
      const next = {
        left: clampTooltipLeft(anchorCenterX, tooltipWidth),
        top: rect.top,
        centered: false,
      };
      setPos((prev) =>
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.centered === next.centered
          ? prev
          : next,
      );
      return;
    }

    const next = { left: anchorCenterX, top: rect.top, centered: true };
    setPos((prev) =>
      prev && prev.left === next.left && prev.top === next.top && prev.centered === next.centered
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    if (!hovered || !triggerRef.current || disabled) {
      setPos(null);
      return () => undefined;
    }

    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, WINDOW_REPOSITION_LISTENERS);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, WINDOW_REPOSITION_LISTENERS);
    };
  }, [hovered, disabled, updatePosition]);

  useLayoutEffect(() => {
    if (!hovered) return;
    updatePosition();
  }, [hovered, content, width, updatePosition]);

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
            className="pointer-events-none fixed z-[9999]"
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.centered ? 'translate(-50%, -100%)' : 'translate(0, -100%)',
            }}
          >
            <div className={`glass-tooltip-surface mb-1 ${width} rounded-lg p-2`}>{content}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}
