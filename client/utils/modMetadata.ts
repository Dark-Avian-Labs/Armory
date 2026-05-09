import type { Mod } from '../types/warframe';

const WEAPON_EXILUS_NAME_FALLBACK = new Set(
  [
    'Eagle Eye',
    'Fatal Acceleration',
    'Gun Glide',
    'Hush',
    'Kinetic Diversion',
    'Lethal Momentum',
    'Meticulous Aim',
    'Projectile Speed',
    'Quick Reload',
    'Shell Compression',
    'Sinister Reach',
    'Stabilizer',
    'Steady Hands',
    'Terminal Velocity',
    'Twitch',
    'Vile Precision',
    'Vigilante Supplies',
  ].map((n) => n.toLowerCase()),
);

export function isWeaponExilusMod(mod: Pick<Mod, 'is_utility' | 'unique_name' | 'name'>): boolean {
  const u: unknown = mod.is_utility;
  if (u === 1 || u === true) return true;
  if (typeof u === 'number' && Number.isFinite(u) && Math.trunc(u) === 1) return true;
  if (typeof u === 'string' && (u === '1' || u.toLowerCase() === 'true')) return true;

  const path = (mod.unique_name || '').toLowerCase();
  const nm = (mod.name || '').toLowerCase();
  if (path.includes('convertammo') || path.includes('convert_ammo')) return true;
  if (nm.includes('ammo mutation')) return true;
  if (WEAPON_EXILUS_NAME_FALLBACK.has(nm)) return true;
  return false;
}
