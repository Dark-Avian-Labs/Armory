import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface GlassTooltipProps {
  children: ReactNode;
  content: ReactNode;
  width?: string;
  disabled?: boolean;
}

const WINDOW_REPOSITION_LISTENERS: AddEventListenerOptions = { capture: true, passive: true };

export function GlassTooltip({ children, content, width = 'w-56', disabled }: GlassTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!hovered || !ref.current || disabled) {
      setPos(null);
      return () => undefined;
    }

    const updatePosition = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, WINDOW_REPOSITION_LISTENERS);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, WINDOW_REPOSITION_LISTENERS);
    };
  }, [hovered, disabled]);

  return (
    <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {children}
      {hovered &&
        pos &&
        !disabled &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className={`glass-tooltip-surface mb-1 ${width} rounded-lg p-2`}>{content}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}
