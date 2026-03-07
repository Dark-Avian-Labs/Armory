import {
  PRIMARY_ELEMENTS,
  ELEMENT_COMBINATIONS,
  ELEMENT_PRIORITY,
  DAMAGE_TYPES,
  type PrimaryElement,
  type DamageType,
} from '../types/warframe';

export interface DamageEntry {
  type: DamageType;
  value: number;
}

interface ElementMod {
  slotIndex: number;
  element: PrimaryElement;
  value: number;
}

export function calculateFinalDamage(
  baseDamage: number[],
  elementMods: ElementMod[],
  damageMultipliers: Partial<Record<DamageType, number>> = {},
): DamageEntry[] {
  const output: Map<DamageType, number> = new Map();

  for (let i = 0; i < DAMAGE_TYPES.length; i++) {
    const val = baseDamage[i] || 0;
    if (val > 0) {
      output.set(DAMAGE_TYPES[i], val);
    }
  }

  for (const [type, mult] of Object.entries(damageMultipliers)) {
    const current = output.get(type as DamageType) || 0;
    if (current > 0) {
      output.set(type as DamageType, current * (1 + mult));
    }
  }

  const innateElements = identifyInnateElements(baseDamage);

  const sortedMods = [...elementMods].sort((a, b) => a.slotIndex - b.slotIndex);

  const elementSequence = buildElementSequence(sortedMods, innateElements);

  const combinedElements = combineElements(elementSequence);

  for (const combined of combinedElements) {
    const existing = output.get(combined.type) || 0;
    output.set(combined.type, existing + combined.value);
  }

  const result: DamageEntry[] = [];
  for (const [type, value] of output) {
    if (value > 0) {
      result.push({ type, value: Math.round(value * 10) / 10 });
    }
  }

  return result;
}

function getPrimaryElementDamageIndex(element: PrimaryElement): number {
  return DAMAGE_TYPES.indexOf(element as DamageType);
}

function identifyInnateElements(
  baseDamage: number[],
): Array<{ element: PrimaryElement; value: number }> {
  const result: Array<{ element: PrimaryElement; value: number }> = [];
  const normalizedBaseDamage =
    baseDamage.length >= DAMAGE_TYPES.length
      ? baseDamage
      : [
          ...baseDamage,
          ...new Array(DAMAGE_TYPES.length - baseDamage.length).fill(0),
        ];

  for (const element of PRIMARY_ELEMENTS) {
    const idx = getPrimaryElementDamageIndex(element);
    if (idx < 0) continue;
    const value = normalizedBaseDamage[idx] || 0;
    if (value > 0) {
      result.push({ element, value });
    }
  }

  result.sort((a, b) => {
    return (
      ELEMENT_PRIORITY.indexOf(a.element) - ELEMENT_PRIORITY.indexOf(b.element)
    );
  });

  return result;
}

interface ElementEntry {
  element: PrimaryElement;
  value: number;
  isInnate: boolean;
}

function buildElementSequence(
  mods: ElementMod[],
  innate: Array<{ element: PrimaryElement; value: number }>,
): ElementEntry[] {
  const sequence: ElementEntry[] = [];
  const consumedInnate = new Set<PrimaryElement>();

  for (const mod of mods) {
    let value = mod.value;

    const innateMatch = innate.find(
      (ie) => ie.element === mod.element && !consumedInnate.has(ie.element),
    );
    if (innateMatch) {
      value += innateMatch.value;
      consumedInnate.add(mod.element);
    }

    sequence.push({
      element: mod.element,
      value,
      isInnate: false,
    });
  }

  for (const ie of innate) {
    if (!consumedInnate.has(ie.element)) {
      sequence.push({
        element: ie.element,
        value: ie.value,
        isInnate: true,
      });
    }
  }

  return sequence;
}

function combineElements(sequence: ElementEntry[]): DamageEntry[] {
  if (sequence.length === 0) return [];

  const result: DamageEntry[] = [];
  let i = 0;

  while (i < sequence.length) {
    const current = sequence[i];

    if (i + 1 < sequence.length) {
      const next = sequence[i + 1];
      const combined = findCombination(current.element, next.element);

      if (combined) {
        result.push({
          type: combined as DamageType,
          value: current.value + next.value,
        });
        i += 2;
        continue;
      }
    }

    result.push({
      type: current.element as DamageType,
      value: current.value,
    });
    i++;
  }

  return result;
}

function findCombination(a: PrimaryElement, b: PrimaryElement): string | null {
  for (const [result, { a: ea, b: eb }] of Object.entries(
    ELEMENT_COMBINATIONS,
  )) {
    if ((a === ea && b === eb) || (a === eb && b === ea)) {
      return result;
    }
  }
  return null;
}

export function getElementColor(element: string): string {
  const colors: Record<string, string> = {
    Impact: 'var(--color-dmg-impact)',
    Puncture: 'var(--color-dmg-puncture)',
    Slash: 'var(--color-dmg-slash)',
    Heat: 'var(--color-dmg-heat)',
    Cold: 'var(--color-dmg-cold)',
    Electricity: 'var(--color-dmg-electricity)',
    Toxin: 'var(--color-dmg-toxin)',
    Blast: 'var(--color-dmg-blast)',
    Radiation: 'var(--color-dmg-radiation)',
    Gas: 'var(--color-dmg-gas)',
    Magnetic: 'var(--color-dmg-magnetic)',
    Viral: 'var(--color-dmg-viral)',
    Corrosive: 'var(--color-dmg-corrosive)',
    Void: 'var(--color-dmg-void)',
    True: 'var(--color-dmg-true)',
  };
  return colors[element] || 'var(--color-muted)';
}
