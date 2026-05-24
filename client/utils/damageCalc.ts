import type { IncarnonData, IncarnonSelection } from '../types/incarnon';
import type { ValenceBonus, Weapon, ModSlot } from '../types/warframe';
import { calculateBuildDamage } from './damage';
import { applyIncarnonStatBonuses } from './incarnonStats';
import { aggregateAllMods, type StatEffects } from './modStatParser';

export interface ModdedStats {
  totalDamage: number;
  critChance: number;
  critMultiplier: number;
  statusChance: number;
  fireRate: number;
  multishot: number;
  magazineSize: number;
  reloadTime: number;
}

export interface WeaponCalcResult {
  base: {
    totalDamage: number;
    critChance: number;
    critMultiplier: number;
    statusChance: number;
    fireRate: number;
    multishot: number;
    magazineSize: number;
    reloadTime: number;
  };
  modded: ModdedStats;
  modEffects: StatEffects;
  averageHit: number;
  burstDps: number;
  sustainedDps: number;
  statusPerSec: number;
  ammoCost: number;
  isMelee: boolean;
}

function parseAmmoCost(weapon: Weapon): number {
  if (!weapon.fire_behaviors) return 1;
  try {
    const behaviors = JSON.parse(weapon.fire_behaviors);
    if (Array.isArray(behaviors) && behaviors.length > 0) {
      return behaviors[0].ammoRequirement ?? 1;
    }
  } catch {
    // ignore
  }
  return 1;
}

export function calculateWeaponDps(
  weapon: Weapon,
  slots: ModSlot[],
  valence?: ValenceBonus | null,
  incarnon?: {
    enabled: boolean;
    data: IncarnonData | null;
    selections: IncarnonSelection[] | undefined;
  },
): WeaponCalcResult {
  const effects = aggregateAllMods(slots);

  let incarnonBase = {
    total_damage: weapon.total_damage,
    critical_chance: weapon.critical_chance,
    proc_chance: weapon.proc_chance,
    fire_rate: weapon.fire_rate,
    multishot: weapon.multishot,
    magazine_size: weapon.magazine_size,
    reload_time: weapon.reload_time,
  };

  if (incarnon?.enabled && incarnon.data) {
    const adjusted = applyIncarnonStatBonuses(
      {
        totalDamage: weapon.total_damage,
        criticalChance: weapon.critical_chance,
        procChance: weapon.proc_chance,
        fireRate: weapon.fire_rate,
        multishot: weapon.multishot,
        magazineSize: weapon.magazine_size,
        reloadTime: weapon.reload_time,
      },
      incarnon.data,
      incarnon.selections,
      true,
    );
    incarnonBase = {
      total_damage: adjusted.totalDamage ?? weapon.total_damage,
      critical_chance: adjusted.criticalChance ?? weapon.critical_chance,
      proc_chance: adjusted.procChance ?? weapon.proc_chance,
      fire_rate: adjusted.fireRate ?? weapon.fire_rate,
      multishot: adjusted.multishot ?? weapon.multishot,
      magazine_size: adjusted.magazineSize ?? weapon.magazine_size,
      reload_time: adjusted.reloadTime ?? weapon.reload_time,
    };
  }

  const effectiveWeapon = { ...weapon, ...incarnonBase };
  const { totalDamage: buildTotalDamage } = calculateBuildDamage(
    effectiveWeapon,
    slots,
    effects,
    valence,
  );
  const isMelee = weapon.range != null;

  const base = {
    totalDamage: incarnonBase.total_damage ?? 0,
    critChance: incarnonBase.critical_chance ?? 0,
    critMultiplier: weapon.critical_multiplier ?? 1,
    statusChance: incarnonBase.proc_chance ?? 0,
    fireRate: incarnonBase.fire_rate ?? 1,
    multishot: incarnonBase.multishot ?? 1,
    magazineSize: incarnonBase.magazine_size ?? 1,
    reloadTime: incarnonBase.reload_time ?? 0,
  };

  const fallbackTotalDamage = base.totalDamage * (1 + effects.baseDamage);
  const moddedTotalDamage = buildTotalDamage > 0 ? buildTotalDamage : fallbackTotalDamage;
  const moddedCritChance = base.critChance * (1 + effects.critChance);
  const moddedCritMultiplier = base.critMultiplier * (1 + effects.critMultiplier);
  const moddedStatusChance = base.statusChance * (1 + effects.statusChance);
  const moddedFireRate = base.fireRate * (1 + effects.fireRate);
  const moddedMultishot = base.multishot * (1 + effects.multishot);
  const reloadDivisor = 1 + effects.reloadSpeed;
  const moddedReloadTime = reloadDivisor > 0 ? base.reloadTime / reloadDivisor : base.reloadTime;
  const moddedMagazineSize = Math.ceil(base.magazineSize * (1 + effects.magazineCapacity));

  const modded: ModdedStats = {
    totalDamage: moddedTotalDamage,
    critChance: moddedCritChance,
    critMultiplier: moddedCritMultiplier,
    statusChance: moddedStatusChance,
    fireRate: moddedFireRate,
    multishot: moddedMultishot,
    magazineSize: moddedMagazineSize,
    reloadTime: moddedReloadTime,
  };

  const avgCritMult = 1 + moddedCritChance * (moddedCritMultiplier - 1);

  let averageHit: number;
  let burstDps: number;
  let sustainedDps: number;
  const ammoCost = isMelee ? 1 : parseAmmoCost(weapon);

  if (isMelee) {
    averageHit = moddedTotalDamage * avgCritMult;
    burstDps = averageHit * moddedFireRate;
    sustainedDps = burstDps;
  } else {
    averageHit = moddedTotalDamage * moddedMultishot * avgCritMult;
    burstDps = averageHit * moddedFireRate;

    const shotsPerMag = Math.floor(moddedMagazineSize / ammoCost);
    if (shotsPerMag > 0 && moddedReloadTime > 0) {
      const fireTime = shotsPerMag / moddedFireRate;
      sustainedDps = burstDps * (fireTime / (fireTime + moddedReloadTime));
    } else {
      sustainedDps = burstDps;
    }
  }

  const statusPerSec = moddedStatusChance * moddedMultishot * moddedFireRate;

  return {
    base,
    modded,
    modEffects: effects,
    averageHit,
    burstDps,
    sustainedDps,
    statusPerSec,
    ammoCost: isMelee ? 0 : ammoCost,
    isMelee,
  };
}
