import { useLayoutEffect, useRef, useState } from 'react';

const MIN_PX = 10;
const MAX_PX = 112;
/** Extra px so scrollWidth fits stay inside the content box (subpixel / rasterization). */
const FIT_SAFETY_PX = 2;

export function ShareHeroTitle({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(32);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const span = measureRef.current;
    if (!container || !span) return;

    const fit = () => {
      const cs = getComputedStyle(container);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      // clientWidth includes horizontal padding; text is laid out in the content box only.
      const w = Math.max(0, container.clientWidth - padL - padR - FIT_SAFETY_PX);
      if (w <= 0) return;
      let lo = MIN_PX;
      let hi = MAX_PX;
      span.style.fontSize = `${hi}px`;
      if (span.scrollWidth <= w) {
        setFontSize(hi);
        return;
      }
      for (let i = 0; i < 24 && hi - lo > 0.25; i++) {
        const mid = (lo + hi) / 2;
        span.style.fontSize = `${mid}px`;
        if (span.scrollWidth <= w) lo = mid;
        else hi = mid;
      }
      setFontSize(lo);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div ref={containerRef} className="w-full min-w-0 px-2">
      <span
        ref={measureRef}
        className="block w-full text-center leading-none font-bold tracking-tight whitespace-nowrap text-[#f6f8ff] drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
        style={{ fontSize: `${fontSize}px` }}
      >
        {text}
      </span>
    </div>
  );
}
