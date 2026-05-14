import type { ReactNode } from 'react';

import { linkifyPlainText } from '../../utils/linkifyText';

type BuildDescriptionPanelProps = {
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
  className?: string;
};

export function BuildDescriptionPanel({
  value,
  onChange,
  readOnly,
  className = '',
}: BuildDescriptionPanelProps) {
  const footer: ReactNode = readOnly ? null : (
    <p className="text-muted shrink-0 text-[10px] leading-snug">
      Plain text. URLs turn into links when the build is viewed.
    </p>
  );

  return (
    <div className={`glass-shell flex min-h-0 flex-1 flex-col gap-2 p-4 ${className}`.trim()}>
      <h3 className="text-muted shrink-0 text-xs font-semibold tracking-wider uppercase">
        Description
      </h3>
      {readOnly ? (
        <div className="text-foreground/90 min-h-[4.5rem] flex-1 overflow-auto text-sm leading-relaxed break-words whitespace-pre-wrap">
          {value.trim() ? (
            linkifyPlainText(value)
          ) : (
            <span className="text-muted/80">No description.</span>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Notes for this build…"
          spellCheck
          className="border-glass-border bg-glass/40 text-foreground placeholder:text-muted/50 focus:border-accent/50 focus:ring-accent/30 min-h-[6rem] flex-1 resize-none rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1"
          aria-label="Build description"
        />
      )}
      {footer}
    </div>
  );
}
