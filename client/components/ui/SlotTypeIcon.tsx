import clsx from 'clsx';
import type { CSSProperties } from 'react';

import { getSlotIconPath, getSlotIconRarityColor, type SlotTypeName } from '../../utils/slotIcons';
import type { Rarity } from '../ModCard/cardLayout';

type SlotTypeIconProps = {
  type: SlotTypeName;
  variant: 'watermark' | 'card';
  size: number;
  rarity?: Rarity;
  className?: string;
  style?: CSSProperties;
  opacity?: number;
};

export function SlotTypeIcon({
  type,
  variant,
  size,
  rarity = 'Uncommon',
  className,
  style,
  opacity,
}: SlotTypeIconProps) {
  const src = getSlotIconPath(type);

  if (variant === 'card') {
    return (
      <span
        className={clsx('inline-block shrink-0', className)}
        role="img"
        aria-label={type}
        style={{
          width: size,
          height: size,
          backgroundColor: getSlotIconRarityColor(rarity),
          opacity,
          maskImage: `url(${src})`,
          WebkitMaskImage: `url(${src})`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
          filter: 'drop-shadow(0px 0px 2px #000)',
          ...style,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={clsx('invert-on-light pointer-events-none object-contain', className)}
      style={{
        width: size,
        height: size,
        opacity,
        filter: 'brightness(0) invert(1)',
        ...style,
      }}
      draggable={false}
    />
  );
}
