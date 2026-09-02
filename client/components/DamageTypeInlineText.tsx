import {
  getDamageTypeIconPath,
  sanitizeDisplayTextKeepDamageTokens,
  splitDisplayTextByDamageTokens,
} from '../utils/damageTypeTokens';

export function DamageTypeInlineText({ text, iconSize = 12 }: { text: string; iconSize?: number }) {
  return (
    <>
      {splitDisplayTextByDamageTokens(sanitizeDisplayTextKeepDamageTokens(text)).map(
        (segment, segmentIndex) => {
          if (segment.kind === 'text') {
            return <span key={`t-${segmentIndex}`}>{segment.value}</span>;
          }
          const iconPath = getDamageTypeIconPath(segment.value);
          if (!iconPath) {
            return <span key={`u-${segmentIndex}`}>{segment.value}</span>;
          }
          return (
            <img
              key={`i-${segmentIndex}`}
              src={iconPath}
              alt={segment.value}
              className="mx-[0.08em] inline-block"
              style={{
                width: iconSize,
                height: iconSize,
                verticalAlign: '-0.12em',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
              }}
              draggable={false}
            />
          );
        },
      )}
    </>
  );
}
