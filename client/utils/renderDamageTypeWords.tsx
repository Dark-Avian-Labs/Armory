import type { ReactNode } from 'react';

import { splitDisplayTextByDamageWords } from './damageTypeWords';

const DAMAGE_TYPE_ICON_STYLE = {
  width: 12,
  height: 12,
  verticalAlign: '-0.12em',
  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
} as const;

export function renderDamageTypeWords(raw: string): ReactNode {
  if (!raw) return null;

  return splitDisplayTextByDamageWords(raw).map((segment, index) => {
    if (segment.kind === 'text') {
      return <span key={`t-${index}`}>{segment.value}</span>;
    }
    if (!segment.iconFile) {
      return <span key={`w-${index}`}>{segment.value}</span>;
    }

    return (
      <span key={`w-${index}`} className="inline">
        <img
          src={`/icons/elements/${segment.iconFile}.png`}
          alt=""
          aria-hidden
          className="mr-[0.15em] inline-block"
          style={DAMAGE_TYPE_ICON_STYLE}
          draggable={false}
        />
        {segment.value}
      </span>
    );
  });
}
