import { useCallback, useEffect, useRef, useState } from 'react';

type DocumentPictureInPictureApi = {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
};

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureApi;
};

const PIP_TOAST_MS = 3000;

export function useDocumentPictureInPicture(title: string): {
  openPip: () => Promise<void>;
  pipToastMessage: string | null;
} {
  const [pipToastMessage, setPipToastMessage] = useState<string | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!pipToastMessage) return undefined;
    const timer = window.setTimeout(() => setPipToastMessage(null), PIP_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [pipToastMessage]);

  useEffect(() => {
    return () => {
      const pipWindow = pipWindowRef.current;
      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
      }
      pipWindowRef.current = null;
    };
  }, []);

  const openPip = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const existing = pipWindowRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }

    const pipApi = (window as WindowWithDocumentPictureInPicture).documentPictureInPicture;
    if (!pipApi?.requestWindow) {
      setPipToastMessage('Picture-in-Picture is not supported in this browser.');
      return;
    }

    try {
      const pipWindow = await pipApi.requestWindow({
        width: Math.min(Math.max(window.innerWidth, 700), 1280),
        height: Math.min(Math.max(window.innerHeight, 500), 900),
      });
      pipWindowRef.current = pipWindow;
      const pipUrl = new URL(window.location.href);
      pipUrl.searchParams.set('view', '1');
      pipUrl.searchParams.set('compact', '1');
      pipUrl.searchParams.set('pip', '1');

      const pipDoc = pipWindow.document;
      pipDoc.title = `Armory - ${title}`;
      pipDoc.documentElement.style.height = '100%';
      pipDoc.documentElement.style.overflow = 'hidden';
      pipDoc.body.style.margin = '0';
      pipDoc.body.style.padding = '0';
      pipDoc.body.style.height = '100%';
      pipDoc.body.style.minHeight = '100%';
      pipDoc.body.style.overflow = 'hidden';
      pipDoc.body.style.background = '#090d18';

      const iframe = pipDoc.createElement('iframe');
      iframe.src = pipUrl.toString();
      iframe.title = 'Armory Build';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';
      iframe.style.display = 'block';

      pipDoc.body.innerHTML = '';
      pipDoc.body.appendChild(iframe);
      pipWindow.addEventListener(
        'pagehide',
        () => {
          if (pipWindowRef.current === pipWindow) {
            pipWindowRef.current = null;
          }
        },
        { once: true },
      );
    } catch (error) {
      console.error('[ModBuilder] Failed to open PiP window', error);
      setPipToastMessage(
        'Unable to open Picture-in-Picture. Your browser may require user interaction or block this page in PiP.',
      );
    }
  }, [title]);

  return { openPip, pipToastMessage };
}
