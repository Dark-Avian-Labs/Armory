import { useEffect, useRef, useState } from 'react';

import { readAtragraphHoloTiltFromElement } from './atragraphHolo';
import { AtragraphHoloRenderer, isAtragraphHoloGlitterSupported } from './atragraphHoloGlitter';

const TILT_ROOT_SELECTOR = '.mod-slot-expanded, .mod-selector-tilt, .mod-card-art-window';

export interface AtragraphHoloCanvasProps {
  src: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
}

export function AtragraphHoloCanvas({ src, width, height, style }: AtragraphHoloCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useFallback, setUseFallback] = useState(() => !isAtragraphHoloGlitterSupported());

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || useFallback) return undefined;

    let renderer: AtragraphHoloRenderer | null = null;
    let frameId = 0;
    let disposed = false;
    let visible = true;

    const tick = (): void => {
      if (disposed || !renderer) return;
      if (visible) {
        const tiltRoot =
          root.closest<HTMLElement>(TILT_ROOT_SELECTOR) ??
          root.closest<HTMLElement>('.mod-card-art-window') ??
          root;
        renderer.setTargetTilt(readAtragraphHoloTiltFromElement(tiltRoot));
        renderer.renderFrame();
      }
      frameId = window.requestAnimationFrame(tick);
    };

    const updateSize = (): void => {
      const rect = root.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        renderer?.setSize(rect.width, rect.height);
      }
    };

    try {
      renderer = new AtragraphHoloRenderer(canvas);
    } catch {
      setUseFallback(true);
      return undefined;
    }

    renderer.setSize(width, height);

    void renderer
      .loadTexture(src)
      .then(() => {
        if (disposed) return;
        updateSize();
        frameId = window.requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!disposed) setUseFallback(true);
      });

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(root);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(root);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      renderer?.dispose();
    };
  }, [src, useFallback, width, height]);

  if (useFallback) {
    return null;
  }

  return (
    <div ref={rootRef} className="mod-card-holo-sparkle absolute inset-0" style={style} aria-hidden>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
