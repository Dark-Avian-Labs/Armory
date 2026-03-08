import { useState, useRef, useEffect } from 'react';

import {
  type CardLayout,
  type Rarity,
  DEFAULT_LAYOUT,
  DAMAGE_COLORS,
  getRarityBorderColor,
  getModAsset,
} from './cardLayout';
import {
  getDamageTypeIconPath,
  splitDisplayTextByDamageTokens,
} from '../../utils/damageTypeTokens';

export interface CardPreviewProps {
  layout?: CardLayout;
  rarity: Rarity;
  polarity: string;
  modArt: string;
  modName: string;
  modType: string;
  modDescription: string;
  setDescription?: string;
  setActive?: number;
  setTotal?: number;
  modSet?: string;
  drain: number;
  rank: number;
  maxRank: number;
  damageValue?: string;
  damageType?: string;
  slotIcon?: string;
  polarityMatch?: 'match' | 'mismatch';
  showGuides?: boolean;
  showOutlines?: boolean;
  collapsed?: boolean;
}

export function CardPreview({
  layout: layoutProp,
  rarity,
  polarity,
  modArt,
  modName,
  modType,
  modDescription,
  setDescription = '',
  setActive = 0,
  setTotal = 0,
  modSet,
  drain,
  rank,
  maxRank,
  damageValue = '',
  damageType = 'none',
  slotIcon = '',
  polarityMatch,
  showGuides = false,
  showOutlines = false,
  collapsed = false,
}: CardPreviewProps) {
  const L = layoutProp ?? DEFAULT_LAYOUT;
  const s = L.scale;
  const h = collapsed ? L.collapsedHeight : L.cardHeight;
  const isEmptyCard = rarity === 'Empty';
  const slotRarity =
    rarity === 'Common' || rarity === 'Uncommon' || rarity === 'Rare'
      ? rarity
      : 'Uncommon';
  const slotIconAsset = slotIcon
    ? `/icons/${slotRarity}${slotIcon.charAt(0).toUpperCase() + slotIcon.slice(1)}Icon.png`
    : '';
  const primaryTextColor = isEmptyCard ? 'var(--color-foreground)' : '#ffffff';
  const secondaryTextColor = isEmptyCard
    ? 'color-mix(in srgb, var(--color-foreground) 80%, transparent)'
    : 'rgba(255,255,255,0.8)';

  const textBlockRef = useRef<HTMLDivElement>(null);
  const [autoContentY, setAutoContentY] = useState(L.contentAreaY);

  useEffect(() => {
    if (!textBlockRef.current || collapsed) return undefined;
    const observer = new ResizeObserver(() => {
      if (!textBlockRef.current) return;
      const blockH = textBlockRef.current.offsetHeight;
      const topY = L.descOffsetY - blockH / s;
      setAutoContentY(topY - 30);
    });
    observer.observe(textBlockRef.current);
    return () => observer.disconnect();
  }, [L.descOffsetY, L.nameFontSize, L.descFontSize, s, collapsed]);

  const effectiveContentY = collapsed ? L.contentAreaY : autoContentY;

  const renderTextWithDamageIcons = (
    text: string,
    iconSize: number,
  ): React.ReactNode => {
    return text.split('\n').map((line, lineIndex) => (
      <span key={lineIndex} className="block">
        {splitDisplayTextByDamageTokens(line).map((segment, segmentIndex) => {
          if (segment.kind === 'text') {
            return (
              <span key={`${lineIndex}-t-${segmentIndex}`}>
                {segment.value}
              </span>
            );
          }
          const iconPath = getDamageTypeIconPath(segment.value);
          if (!iconPath) {
            return (
              <span key={`${lineIndex}-u-${segmentIndex}`}>
                {segment.value}
              </span>
            );
          }
          return (
            <img
              key={`${lineIndex}-i-${segmentIndex}`}
              src={iconPath}
              alt={segment.value}
              className="mx-[0.08em] inline-block"
              style={{
                width: iconSize,
                height: iconSize,
                verticalAlign: '-0.16em',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
              }}
              draggable={false}
            />
          );
        })}
      </span>
    ));
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: L.cardWidth * s,
        height: h * s,
        transition: collapsed ? 'none' : 'height 0.2s ease-out',
        outline: showOutlines ? '1px dashed rgba(255,255,255,0.2)' : 'none',
        textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ transform: `translateY(${L.cardOffsetY * s}px)` }}
      >
        {!collapsed && (
          <img
            src={getModAsset(rarity, 'Background')}
            alt="bg"
            className="absolute left-1/2"
            style={{
              zIndex: 0,
              transform: `translateX(-50%)`,
              marginLeft: L.bgOffsetX * s,
              top: L.bgOffsetY * s,
              width: L.bgWidth * s,
              height: L.bgHeight * s,
            }}
            draggable={false}
          />
        )}

        {modArt && (
          <div
            className="absolute overflow-hidden"
            style={{
              zIndex: 1,
              left: L.artOffsetX * s,
              top: L.artOffsetY * s,
              width: L.artWidth * s,
              height: collapsed
                ? L.collapsedArtHeight * s
                : Math.min(
                    L.artHeight,
                    Math.max(0, effectiveContentY - L.artOffsetY + 30),
                  ) * s,
              outline:
                showOutlines && !collapsed
                  ? '1px dashed rgba(0,200,255,0.4)'
                  : 'none',
              maskImage: collapsed
                ? 'none'
                : `linear-gradient(to bottom, black calc(100% - ${10 * s}px), transparent 100%)`,
              WebkitMaskImage: collapsed
                ? 'none'
                : `linear-gradient(to bottom, black calc(100% - ${10 * s}px), transparent 100%)`,
            }}
          >
            <img
              src={modArt}
              alt="art"
              className="object-cover"
              style={{
                width: L.artWidth * s,
                height: L.artHeight * s,
                filter: collapsed ? 'grayscale(0.8) brightness(0.4)' : 'none',
              }}
              draggable={false}
            />
          </div>
        )}

        {damageValue && damageType !== 'none' && (
          <div
            className="absolute rounded"
            style={{
              zIndex: 2,
              left: L.damageBadgeOffsetX * s,
              top: L.damageBadgeOffsetY * s,
              minWidth: L.damageBadgeWidth * s,
              height: L.damageBadgeHeight * s,
              background: 'var(--color-surface-thead)',
              border: `${1.5 * s}px solid ${DAMAGE_COLORS[damageType] ?? 'var(--color-dmg-true)'}`,
            }}
          />
        )}
        {(drain > 0 || polarity) && (
          <svg
            viewBox="0 0 70 34"
            className="absolute"
            style={{
              zIndex: 2,
              left: L.drainOffsetX * s,
              top: L.drainOffsetY * s,
              width: L.drainBadgeWidth * s,
              height: L.drainBadgeHeight * s,
            }}
          >
            <polygon
              points="1,17 13,1 69,1 69,33 13,33"
              fill="rgba(8,8,8,0.88)"
              stroke={getRarityBorderColor(rarity)}
              strokeWidth="1.5"
              strokeLinejoin="miter"
            />
          </svg>
        )}

        {!collapsed && (
          <>
            <img
              src={getModAsset(rarity, 'SideLight')}
              alt="side-l"
              className="absolute"
              style={{
                zIndex: 3,
                left: L.sideLeftOffsetX * s,
                top: L.sideLeftOffsetY * s,
                width: L.sideLeftWidth * s,
                height: L.sideLeftHeight * s,
                transform: 'scaleX(-1)',
              }}
              draggable={false}
            />
            <img
              src={getModAsset(rarity, 'SideLight')}
              alt="side-r"
              className="absolute"
              style={{
                zIndex: 3,
                right: L.sideLeftOffsetX * s,
                top: L.sideLeftOffsetY * s,
                width: L.sideLeftWidth * s,
                height: L.sideLeftHeight * s,
              }}
              draggable={false}
            />
          </>
        )}
        <img
          src={getModAsset(rarity, 'FrameTop', modSet)}
          alt="frame-top"
          className="absolute left-1/2"
          style={{
            zIndex: 3,
            transform: 'translateX(-50%)',
            marginLeft: L.frameTopOffsetX * s,
            top: L.frameTopOffsetY * s,
            width: L.frameTopWidth * s,
            height: L.frameTopHeight * s,
          }}
          draggable={false}
        />
        <img
          src={getModAsset(rarity, 'FrameBottom')}
          alt="frame-bot"
          className="absolute left-1/2"
          style={{
            zIndex: 3,
            transform: 'translateX(-50%)',
            marginLeft: L.frameBotOffsetX * s,
            top:
              (collapsed ? L.collapsedFrameBotOffsetY : L.frameBotOffsetY) * s,
            width: L.frameBotWidth * s,
            height:
              (collapsed ? L.collapsedFrameBotHeight : L.frameBotHeight) * s,
          }}
          draggable={false}
        />
        {!collapsed && (
          <img
            src={getModAsset(rarity, 'LowerTab')}
            alt="lower-tab"
            className="absolute left-1/2"
            style={{
              zIndex: 3,
              transform: 'translateX(-50%)',
              marginLeft: L.lowerTabOffsetX * s,
              top: L.lowerTabOffsetY * s,
              width: L.lowerTabWidth * s,
              height: L.lowerTabHeight * s,
              outline: showOutlines ? '1px dashed rgba(255,200,0,0.3)' : 'none',
            }}
            draggable={false}
          />
        )}

        {slotIcon && (
          <img
            src={slotIconAsset}
            alt={slotIcon}
            className="absolute left-1/2"
            style={{
              zIndex: 4,
              transform: 'translateX(-50%)',
              top: L.slotIconOffsetY * s,
              height: L.slotIconSize * s,
              width: 'auto',
              filter: 'drop-shadow(0px 0px 2px #000)',
            }}
            draggable={false}
          />
        )}

        {damageValue && damageType !== 'none' && (
          <div
            className="absolute flex items-center justify-center rounded font-bold"
            style={{
              zIndex: 4,
              left: L.damageBadgeOffsetX * s,
              top: L.damageBadgeOffsetY * s,
              minWidth: L.damageBadgeWidth * s,
              height: L.damageBadgeHeight * s,
              fontSize: L.damageBadgeFontSize * s,
              color: DAMAGE_COLORS[damageType] ?? 'var(--color-dmg-true)',
              lineHeight: 1,
              padding: `0 ${4 * s}px`,
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {damageValue}
          </div>
        )}

        {drain > 0 && (
          <div
            className="absolute font-bold"
            style={{
              zIndex: 4,
              left: L.drainTextOffsetX * s,
              top: L.drainTextOffsetY * s,
              fontSize: L.drainFontSize * s,
              lineHeight: 1,
              color:
                polarityMatch === 'match'
                  ? 'var(--color-success)'
                  : polarityMatch === 'mismatch'
                    ? 'var(--color-danger)'
                    : 'var(--color-dmg-true)',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {drain}
          </div>
        )}

        {polarity && (
          <img
            src={`/icons/polarity/${polarity}.svg`}
            alt={polarity}
            className="absolute"
            style={{
              zIndex: 4,
              left: L.polarityOffsetX * s,
              top: L.polarityOffsetY * s,
              width: L.polaritySize * s,
              height: L.polaritySize * s,
              filter:
                polarityMatch === 'match'
                  ? 'brightness(0) invert(0.5) sepia(1) saturate(5) hue-rotate(85deg)'
                  : polarityMatch === 'mismatch'
                    ? 'brightness(0) invert(0.5) sepia(1) saturate(5) hue-rotate(-10deg)'
                    : 'brightness(0) invert(1)',
            }}
            draggable={false}
          />
        )}

        {!collapsed && modType && (
          <div
            className="absolute left-1/2 flex items-center justify-center font-semibold uppercase tracking-wider"
            style={{
              zIndex: 4,
              transform: 'translateX(-50%)',
              marginLeft: L.lowerTabOffsetX * s,
              top: L.lowerTabOffsetY * s,
              width: L.lowerTabWidth * s,
              height: L.lowerTabHeight * s,
              fontSize: L.typeFontSize * s,
              color: primaryTextColor,
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {modType}
          </div>
        )}

        {collapsed ? (
          <>
            <div
              className="absolute left-1/2 -translate-x-1/2 text-center"
              style={{
                zIndex: 4,
                top: L.collapsedNameOffsetY * s,
                width: (L.cardWidth - L.textPaddingX * 2) * s,
                fontSize: L.collapsedNameFontSize * s,
                fontWeight: 400,
                lineHeight: '100%',
                color: primaryTextColor,
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              }}
            >
              {modName}
            </div>
            {setTotal > 0 && (
              <div
                className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
                style={{
                  zIndex: 4,
                  top:
                    (L.collapsedNameOffsetY + L.collapsedNameFontSize + 10) * s,
                  gap: 3 * s,
                }}
              >
                {Array.from({ length: setTotal }, (_, i) => {
                  const active = i < setActive;
                  return (
                    <div
                      key={i}
                      style={{
                        width: 10 * s,
                        height: 10 * s,
                        borderRadius: 1.5 * s,
                        border: `${1 * s}px solid rgba(200,170,100,${active ? '0.9' : '0.35'})`,
                        backgroundColor: active
                          ? 'color-mix(in srgb, var(--color-warning) 70%, transparent)'
                          : 'transparent',
                      }}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div
            ref={textBlockRef}
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              zIndex: 4,
              bottom: (h - L.descOffsetY) * s,
              width: (L.cardWidth - L.textPaddingX * 2) * s,
            }}
          >
            <div
              className="text-center"
              style={{
                fontSize: L.nameFontSize * s,
                fontWeight: 400,
                color: primaryTextColor,
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                marginBottom: 4 * s,
              }}
            >
              {modName}
            </div>
            {modDescription && (
              <div
                className="text-center"
                style={{
                  fontSize: L.descFontSize * s,
                  fontWeight: 400,
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  color: secondaryTextColor,
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {renderTextWithDamageIcons(
                  modDescription,
                  L.descFontSize * s * 1.05,
                )}
              </div>
            )}
            {setTotal > 0 && setDescription && (
              <>
                <div
                  className="mx-auto flex items-center justify-center"
                  style={{
                    marginTop: 4 * s,
                    marginBottom: 3 * s,
                    gap: 3 * s,
                  }}
                >
                  {Array.from({ length: setTotal }, (_, i) => {
                    const active = i < setActive;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 6 * s,
                          height: 6 * s,
                          borderRadius: 1 * s,
                          border: `${1 * s}px solid rgba(200,170,100,${active ? '0.9' : '0.35'})`,
                          backgroundColor: active
                            ? 'color-mix(in srgb, var(--color-warning) 70%, transparent)'
                            : 'transparent',
                          transition: 'all 0.2s',
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  className="text-center"
                  style={{
                    fontSize: L.descFontSize * s * 0.9,
                    fontWeight: 400,
                    lineHeight: 1.3,
                    color:
                      'color-mix(in srgb, var(--color-warning) 80%, transparent)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {renderTextWithDamageIcons(
                    setDescription,
                    L.descFontSize * s * 0.95,
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div
          className="absolute flex items-center justify-center"
          style={{
            zIndex: 4,
            left: 0,
            width: L.cardWidth * s,
            top: (collapsed ? L.collapsedRankOffsetY : L.rankOffsetY) * s,
          }}
        >
          <div
            className="relative flex items-center"
            style={{ gap: L.rankStarGap * s }}
          >
            {Array.from({ length: maxRank }, (_, i) => {
              const starSize = collapsed
                ? L.collapsedRankStarSize
                : L.rankStarSize;
              const active = i < rank;
              return (
                <div
                  key={i}
                  style={{
                    width: starSize * s,
                    height: starSize * s,
                    fontSize: starSize * s,
                    lineHeight: 1,
                    color: active ? '#a6e6ff' : 'rgba(255,255,255,0.2)',
                    filter: active ? 'drop-shadow(0 0 0.1rem #a6e6ff)' : 'none',
                  }}
                >
                  ★
                </div>
              );
            })}
            {rank > 0 && rank >= maxRank && (
              <div
                style={{
                  position: 'absolute',
                  left: -(L.cardWidth * 0.1 * s),
                  right: -(L.cardWidth * 0.1 * s),
                  top: '62.5%',
                  transform: 'translateY(-50%)',
                  height: 1,
                  background: '#a6e6ff',
                  filter: 'drop-shadow(0 0 0.2rem #a6e6ff)',
                  opacity: 0.8,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
      </div>

      {showGuides && (
        <>
          <div
            className="absolute left-1/2 top-0 h-full"
            style={{ width: 1, background: 'rgba(255,0,0,0.2)' }}
          />
          <div
            className="absolute left-0 top-1/2 w-full"
            style={{ height: 1, background: 'rgba(255,0,0,0.2)' }}
          />
        </>
      )}
    </div>
  );
}
