import type { IncarnonData, IncarnonSelection } from '../types/incarnon';
import type { ValenceBonus, Weapon, ModSlot } from '../types/warframe';
import { calculateBuildDamage, parseDamageArray } from './damage';
import { applyIncarnonStatBonuses, type IncarnonAdjustedWeaponStats } from './incarnonStats';
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

function applyIncarnonStatsToWeapon(weapon: Weapon, adjusted: IncarnonAdjustedWeaponStats): Weapon {
  const result: Weapon = { ...weapon };
  const damageArray = parseDamageArray(weapon);
  const arrayTotal = damageArray.reduce((sum, value) => sum + (value || 0), 0);
  const weaponTotal = weapon.total_damage ?? arrayTotal;
  const adjustedTotal = adjusted.totalDamage ?? weaponTotal;

  if (adjustedTotal !== weaponTotal) {
    result.total_damage = adjustedTotal;
    if (arrayTotal > 0) {
      const scale = adjustedTotal / arrayTotal;
      result.damage_per_shot = JSON.stringify(damageArray.map((value) => value * scale));
    }
  }

  if (adjusted.criticalChance !== undefined) result.critical_chance = adjusted.criticalChance;
  if (adjusted.procChance !== undefined) result.proc_chance = adjusted.procChance;
  if (adjusted.fireRate !== undefined) result.fire_rate = adjusted.fireRate;
  if (adjusted.multishot !== undefined) result.multishot = adjusted.multishot;
  if (adjusted.magazineSize !== undefined) result.magazine_size = adjusted.magazineSize;
  if (adjusted.reloadTime !== undefined) result.reload_time = adjusted.reloadTime;

  return result;
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

  let effectiveWeapon = weapon;
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
    effectiveWeapon = applyIncarnonStatsToWeapon(weapon, adjusted);
  }

  const { totalDamage: buildTotalDamage } = calculateBuildDamage(
    effectiveWeapon,
    slots,
    effects,
    valence,
  );
  const isMelee = weapon.range != null;

  const base = {
    totalDamage: effectiveWeapon.total_damage ?? 0,
    critChance: effectiveWeapon.critical_chance ?? 0,
    critMultiplier: weapon.critical_multiplier ?? 1,
    statusChance: effectiveWeapon.proc_chance ?? 0,
    fireRate: effectiveWeapon.fire_rate ?? 1,
    multishot: effectiveWeapon.multishot ?? 1,
    magazineSize: effectiveWeapon.magazine_size ?? 1,
    reloadTime: effectiveWeapon.reload_time ?? 0,
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
