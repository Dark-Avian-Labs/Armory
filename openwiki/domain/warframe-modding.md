# Warframe Modding Concepts

This section covers the core Warframe game mechanics that Armory models and supports in its mod builder system.

## Equipment Hierarchy

### Equipment Types (`/shared/equipmentTypes.ts`)

```typescript
export type EquipmentType =
  | 'Warframe'
  | 'Primary'
  | 'Secondary'
  | 'Melee'
  | 'Archwing'
  | 'Companion'
  | 'Vehicle'
  | 'Archgun'
  | 'Archmelee'
  | 'Amp'
  | 'Railjack';
```

### Warframes

- **Standard Warframes**: Base variants with standard stats
- **Prime Warframes**: Upgraded variants with improved stats and polarities
- **Special Variants**: Umbra, Prime Access, etc.
- **Signature Traits**: Unique abilities and mechanics per Warframe

### Weapons

- **Primary Weapons**: Rifles, shotguns, bows, launchers
- **Secondary Weapons**: Pistols, throwing weapons, dual pistols
- **Melee Weapons**: Swords, hammers, polearms, whips
- **Special Categories**: Kitguns, Zaws, modular weapons

### Companions

- **Sentinels**: Robotic companions with precept slots
- **Pets**: Kubrows, Kavats, Predasites, etc.
- **Robotic**: MOAs, Hounds
- **Special**: Helminth Charger, Vulpaphyla

## Mod System

### Mod Types

- **Warframe Mods**: Apply to Warframe equipment slots
- **Weapon Mods**: Apply to weapon equipment slots
- **Aura Mods**: Special slot affecting entire loadout capacity
- **Stance Mods**: Melee weapon stance modifiers
- **Exilus Mods**: Utility slot mods for Warframes
- **Archon Shards**: End-game stat modifiers

### Mod Rarity System

- **Common** (Bronze): Basic mods with standard effects
- **Uncommon** (Silver): Enhanced mods with better stats
- **Rare** (Gold): Powerful mods with significant effects
- **Legendary** (Platinum): Top-tier mods with unique effects
- **Primed**: Upgraded versions of existing mods

### Mod Polarity System

- **Madurai (V)**: Offensive mods (damage, crit, etc.)
- **Vazarin (D)**: Defensive mods (health, armor, shields)
- **Naramon (-)**: Utility mods (energy, efficiency, duration)
- **Zenurik (=)**: Ability-focused mods
- **Unairu (Y)**: Specialized and niche mods
- **Penjaga (R)**: Companion and pet mods
- **Universal (=)**: No polarity restriction

## Slot Management

### Warframe Slots

```
┌─────────────────────────────────────────────────────────────┐
│                      Warframe Slots                         │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┤
│ Aura │  1   │  2   │  3   │  4   │  5   │  6   │  7   │  8  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼─────┤
│      │ Exilus               │ Archon Shard Slots (5)        │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴─────┘
```

### Weapon Slots

- **8 Regular Slots**: Standard mod placement
- **Stance Slot** (Melee only): Special slot for stance mods
- **Exilus Slot** (some weapons): Utility slot option

### Capacity System

- **Base Capacity**: Equipment's starting mod capacity
- **Level Scaling**: +1 capacity per level (max 30 for most equipment)
- **Aura Bonus**: Aura mods provide capacity bonus (x2 for matching polarity)
- **Forma Investment**: Each Forma adds +2 capacity and changes polarity
- **Reactors/Catalysts**: Doubles capacity (Orokin Reactor/Catalyst)

## Damage System

### Damage Types (`/shared/damageTypes.ts`)

```typescript
export type DamageType =
  | 'Impact'
  | 'Puncture'
  | 'Slash'
  | 'Heat'
  | 'Cold'
  | 'Electricity'
  | 'Toxin'
  | 'Blast'
  | 'Radiation'
  | 'Viral'
  | 'Corrosive'
  | 'Gas'
  | 'Magnetic'
  | 'Void'
  | 'True';
```

### Damage Calculation (`/shared/damageFromWiki.ts`)

```typescript
export interface DamageCalculation {
  baseDamage: number;
  multipliers: {
    damage: number;
    multishot: number;
    critical: { chance: number; multiplier: number };
    status: { chance: number; effects: StatusEffect[] };
    elemental: Record<DamageType, number>;
  };
  finalDamage: Record<DamageType, number>;
}
```

### Status Effects

- **Impact**: Stagger, reduces accuracy
- **Puncture**: Weaken, reduces damage dealt
- **Slash**: Bleed, true damage over time
- **Heat**: Panic, armor reduction, damage over time
- **Cold**: Slow, reduces movement and attack speed
- **Electricity**: Chain, stuns and damages nearby enemies
- **Toxin**: Poison, bypasses shields
- **Combined Effects**: Special effects from combined elements

## Set Bonuses

### Mod Sets

- **Vigilante**: Critical enhancement set
- **Gladiator**: Melee critical set
- **Augur**: Shield conversion set
- **Synth**: Companion and utility set
- **Aero**: Parkour and mobility set
- **Amalgam**: Hybrid weapon set

### Set Bonus Mechanics

- **Progressive Bonuses**: Effects improve with more set mods equipped
- **Cross-Equipment**: Some sets work across multiple pieces of equipment
- **Stacking Rules**: Limits on how many times bonuses can stack
- **Interaction Rules**: How set bonuses interact with other mod effects

## Special Systems

### Helminth System (`/shared/helminthRegistry.ts`)

- **Ability Subsumption**: Extract abilities from Warframes
- **Compatibility Rules**: Which Warframes can receive which abilities
- **Resource Costs**: Helminth resource requirements for subsumption
- **Ability Modding**: Subsumed abilities can be modded like regular abilities

### Archon Shards

- **Tauforged vs Regular**: Different strength levels
- **Slot Configuration**: 5 shard slots per Warframe
- **Shard Types**: Crimson (strength), Azure (duration), Amber (efficiency)
- **Stacking Effects**: How multiple shards of same type interact

### Incarnon Weapons

- **Evolution System**: Multiple evolution stages
- **Perk Selection**: Choose between evolution perks
- **Transformation**: Alternate fire mode transformation
- **Adapter System**: Convert regular weapons to Incarnon

## Game Mechanics Integration

### Ability Scaling

- **Strength**: Increases ability damage and healing
- **Duration**: Increases ability effect duration
- **Range**: Increases ability area of effect
- **Efficiency**: Reduces ability energy cost

### Survivability Stats

- **Health**: Base health pool
- **Shields**: Regenerating protective barrier
- **Armor**: Damage reduction for health
- **Energy**: Resource for ability casting

### Movement & Utility

- **Sprint Speed**: Base movement speed
- **Parkour Velocity**: Bullet jump and aim glide effectiveness
- **Ability Cast Speed**: How quickly abilities activate
- **Knockdown Recovery**: Time to recover from knockdowns

## Compatibility Rules

### Mod Conflicts

- **Exclusive Mods**: Cannot be equipped together
- **Stacking Limits**: Maximum number of similar effects
- **Polarity Restrictions**: Mods can only go in specific polarity slots
- **Equipment Restrictions**: Mods limited to specific equipment types

### Build Validation

- **Capacity Validation**: Ensure build doesn't exceed capacity
- **Mod Compatibility**: Check for conflicting mod combinations
- **Equipment Restrictions**: Verify mods are allowed on equipment
- **Set Bonus Calculation**: Calculate active set bonuses

## Source References

### Type Definitions

- **Equipment Types**: `/shared/equipmentTypes.ts`
- **Damage Types**: `/shared/damageTypes.ts`
- **Mod Types**: `/shared/mods.ts`

### Game Data

- **Helminth Registry**: `/shared/helminthRegistry.generated.ts`
- **Archon Shards**: `/shared/archonShardRegistry.ts`
- **Damage Formulas**: `/shared/damageFromWiki.ts`

### Business Logic

- **Damage Calculation**: `/shared/damageFromFireBehaviors.ts`
- **Equipment Stats**: `/shared/equipmentRankStats.ts`
- **Polarity System**: `/shared/polarities.ts`
