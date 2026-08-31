import { useCallback, useEffect, useRef, useState } from 'react';

import { useCompare } from '../../../context/CompareContext';
import type { IncarnonData, IncarnonSelection } from '../../../types/incarnon';
import type { EquipmentType, ModSlot, ValenceBonus, Weapon } from '../../../types/warframe';
import { calculateBuildDamage } from '../../../utils/damage';
import { calculateWeaponDps } from '../../../utils/damageCalc';

const COMPARE_TOAST_MS = 1500;
const MAX_COMPARE_SNAPSHOTS = 3;

export function useAddToCompare(args: {
  selectedEquipment: Weapon | null;
  equipmentType: EquipmentType;
  buildName: string;
  hydratedSlots: ModSlot[];
  effectiveValenceBonus: ValenceBonus | null;
  hasIncarnon: boolean;
  incarnonEnabled: boolean;
  incarnonData: IncarnonData | null;
  incarnonSelections: IncarnonSelection[] | undefined;
}): {
  addToCompare: () => void;
  compareToast: boolean;
  compareCount: number;
  compareFull: boolean;
} {
  const { addSnapshot, snapshots } = useCompare();
  const [compareToast, setCompareToast] = useState(false);
  const compareToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (compareToastTimeoutRef.current !== null) {
        clearTimeout(compareToastTimeoutRef.current);
      }
    };
  }, []);

  const addToCompare = useCallback(() => {
    const weapon = args.selectedEquipment;
    if (!weapon || args.equipmentType === 'warframe') return;
    const vb = args.effectiveValenceBonus;
    const incarnonInput =
      args.hasIncarnon && args.incarnonEnabled
        ? { enabled: true, data: args.incarnonData, selections: args.incarnonSelections }
        : undefined;
    const calc = calculateWeaponDps(weapon, args.hydratedSlots, vb, incarnonInput);
    const { totalDamage, damageBreakdown } = calculateBuildDamage(
      weapon,
      args.hydratedSlots,
      undefined,
      vb,
    );
    addSnapshot({
      id: crypto.randomUUID(),
      label: args.buildName,
      weaponName: weapon.name,
      weaponImage: weapon.image_path,
      equipmentType: args.equipmentType,
      calc,
      elementBreakdown: damageBreakdown,
      totalElementDamage: totalDamage,
      timestamp: Date.now(),
    });
    setCompareToast(true);
    if (compareToastTimeoutRef.current !== null) {
      clearTimeout(compareToastTimeoutRef.current);
    }
    compareToastTimeoutRef.current = setTimeout(() => {
      setCompareToast(false);
      compareToastTimeoutRef.current = null;
    }, COMPARE_TOAST_MS);
  }, [
    addSnapshot,
    args.buildName,
    args.effectiveValenceBonus,
    args.equipmentType,
    args.hasIncarnon,
    args.hydratedSlots,
    args.incarnonData,
    args.incarnonEnabled,
    args.incarnonSelections,
    args.selectedEquipment,
  ]);

  return {
    addToCompare,
    compareToast,
    compareCount: snapshots.length,
    compareFull: snapshots.length >= MAX_COMPARE_SNAPSHOTS,
  };
}
