import { memo } from 'react';

type SaveToast = { tone: 'success' | 'error'; message: string };

type ModBuilderToastsProps = {
  saveToast: SaveToast | null;
  compareToast: boolean;
  compareCount: number;
  rivenToastMessage: string | null;
  pipToastMessage: string | null;
};

export const ModBuilderToasts = memo(function ModBuilderToasts({
  saveToast,
  compareToast,
  compareCount,
  rivenToastMessage,
  pipToastMessage,
}: ModBuilderToastsProps) {
  return (
    <>
      {saveToast ? (
        <div className="toast-pill" data-tone={saveToast.tone} role="status" aria-live="polite">
          {saveToast.message}
        </div>
      ) : null}
      {compareToast ? (
        <div className="toast-pill" role="status" aria-live="polite">
          Added to comparison ({compareCount}/3)
        </div>
      ) : null}
      {rivenToastMessage ? (
        <div className="toast-pill" data-tone="warning" role="status" aria-live="polite">
          {rivenToastMessage}
        </div>
      ) : null}
      {pipToastMessage ? (
        <div className="toast-pill" data-tone="warning" role="status" aria-live="polite">
          {pipToastMessage}
        </div>
      ) : null}
    </>
  );
});
