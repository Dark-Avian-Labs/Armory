# Mod Building Workflow

The mod building workflow is the core user interaction in Armory, allowing players to create, configure, and save mod builds for Warframe equipment.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Mod Building Process                    │
├─────────────────────────────────────────────────────────────┤
│  1. Equipment Selection  →  2. Slot Configuration          │
│                             • Available slots              │
│                             • Polarity matching            │
│                             • Capacity calculation         │
├─────────────────────────────────────────────────────────────┤
│  3. Mod Placement        →  4. Stats Calculation           │
│  • Search & filter       │  • Real-time updates            │
│  • Drag & drop           │  • Damage formulas              │
│  • Rank adjustment       │  • Set bonuses                  │
├─────────────────────────────────────────────────────────────┤
│  5. Build Management     →  6. Sharing & Export            │
│  • Save to profile       │  • Shareable links              │
│  • Add to loadouts       │  • Image export                 │
│  • Mark as favorite      │  • Codex integration            │
└─────────────────────────────────────────────────────────────┘
```

## 1. Equipment Selection

### Equipment Types

- **Warframes**: Standard, Prime, and special variants
- **Weapons**: Primary, secondary, melee, archguns
- **Companions**: Sentinels, pets, robotic companions
- **Archwings**: Space combat equipment
- **Vehicles**: K-Drives and other vehicles

### Selection Interface (`/client/components/ModBuilder/EquipmentSelector.tsx`)

- **Category Filtering**: Browse by equipment type
- **Search Functionality**: Filter by name, stats, or traits
- **Favorite Marking**: Quick access to frequently used equipment
- **Recent History**: Recently used equipment for quick selection

### Data Source

- Catalog database (`armory.db`) via `/api/catalog/equipment`
- Real-time filtering client-side for performance

## 2. Slot Configuration

### Slot Types

- **Warframe Slots**: Aura, Exilus, 8 regular slots, archon shards
- **Weapon Slots**: 8 regular mod slots
- **Companion Slots**: Precept, 8 regular slots
- **Archwing Slots**: Aura, 8 regular slots

### Polarity System

- **Polarity Types**: Madurai (V), Vazarin (D), Naramon (-), etc.
- **Matching Bonus**: Halved mod capacity cost when polarity matches
- **Mismatch Penalty**: Increased capacity cost when polarity doesn't match

### Capacity Calculation

```typescript
// Simplified capacity calculation
function calculateCapacity(equipment: Equipment, mods: ModPlacement[]): number {
  const baseCapacity = equipment.baseCapacity;
  const auraBonus = equipment.auraSlot?.mod?.capacityBonus || 0;
  const formaAdjustments = equipment.formaCount * 2;

  return baseCapacity + auraBonus + formaAdjustments;
}
```

## 3. Mod Placement

### Mod Browser (`/client/components/ModBuilder/ModBrowser.tsx`)

- **Search & Filter**: By name, type, polarity, stats
- **Category Tabs**: Organized by mod function (damage, utility, etc.)
- **Set Display**: Grouped by mod set for easy identification
- **Rank Selection**: Adjust mod rank before placement

### Drag & Drop Interface

- **Visual Feedback**: Highlight valid slots during drag
- **Polarity Indicators**: Show matching/mismatching polarities
- **Capacity Updates**: Real-time capacity remaining display
- **Conflict Detection**: Prevent incompatible mod combinations

### Mod Configuration

- **Rank Adjustment**: Slider for mod rank (0 to max)
- **Stat Preview**: Show resulting stat changes
- **Cost Calculation**: Update capacity cost based on rank and polarity
- **Set Bonus Tracking**: Track progress toward set bonuses

## 4. Stats Calculation

### Real-time Calculation (`/client/utils/damage.ts`)

```typescript
// Damage calculation pipeline
export function calculateDamage(build: Build): DamageStats {
  const baseStats = getBaseStats(build.equipment);
  const modEffects = applyModEffects(build.mods);
  const damageMultipliers = calculateMultipliers(modEffects);
  const finalStats = applyMultipliers(baseStats, damageMultipliers);

  return finalStats;
}
```

### Damage Types

- **Physical**: Impact, Puncture, Slash
- **Elemental**: Heat, Cold, Electricity, Toxin
- **Combined**: Blast, Radiation, Viral, Corrosive, etc.
- **Special**: Void, True, etc.

### Stat Display Components

- **Comparison View**: Side-by-side with base stats
- **Color Coding**: Green for improvements, red for reductions
- **Tooltip Details**: Breakdown of calculation sources
- **Historical Tracking**: Compare with previous versions

## 5. Build Management

### Save Process (`/server/routes/buildsRouter.ts`)

```typescript
// Build saving endpoint
router.post('/api/builds', clerkMiddleware, async (req, res) => {
  const userId = req.auth.userId;
  const buildData = validateBuildData(req.body);

  const savedBuild = await saveBuild(userDb, userId, buildData);
  res.json(savedBuild);
});
```

### Build Metadata

- **Title & Description**: User-provided build information
- **Tags & Categories**: Organization and discovery
- **Visibility Settings**: Public, private, or unlisted
- **Version History**: Track changes over time

### Loadout Integration

- **Collections**: Group related builds together
- **Quick Switching**: Switch between loadout builds
- **Export/Import**: Share entire loadouts

## 6. Sharing & Export

### Shareable Links

- **URL Encoding**: Build data encoded in URL parameters
- **Compression**: LZMA compression for URL length reduction
- **Validation**: Server-side validation on link load
- **Preview Generation**: Thumbnail and metadata for social sharing

### Image Export (`/client/components/Share/BuildImageExport.tsx`)

- **HTML-to-Image**: Using `html-to-image` library
- **Template System**: Customizable export templates
- **Quality Settings**: Resolution and format options
- **Watermarking**: Optional Armory branding

### Codex Integration

- **Database Sync**: Codex reads build data directly from `builds.db`
- **Format Compatibility**: Ensure shared data format
- **Update Propagation**: Real-time or periodic sync

## Error Handling & Validation

### Client-side Validation

- **Capacity Limits**: Prevent over-capacity builds
- **Mod Conflicts**: Detect incompatible mod combinations
- **Equipment Restrictions**: Enforce slot type limitations
- **Data Consistency**: Validate build structure before save

### Server-side Validation

- **Authentication**: Verify user ownership
- **Data Integrity**: Sanitize and validate all inputs
- **Database Constraints**: Enforce foreign key relationships
- **Rate Limiting**: Prevent abuse of save endpoints

## Performance Optimizations

### Client-side Caching

- **Equipment Cache**: Local storage of frequently accessed equipment
- **Mod Cache**: Pre-loaded mod data for faster searching
- **Build Cache**: Recently viewed builds for quick access

### Lazy Loading

- **Mod Images**: Load on demand rather than upfront
- **Detailed Stats**: Calculate only when viewing details
- **Export Features**: Load heavy libraries only when needed

### Batch Operations

- **Stat Calculations**: Batch updates for multiple mod changes
- **Database Writes**: Transaction-based save operations
- **Image Preloading**: Background loading of commonly used images

## User Experience Features

### Undo/Redo System

- **Action History**: Track mod placement and configuration changes
- **State Restoration**: Restore previous build states
- **Keyboard Shortcuts**: Ctrl+Z, Ctrl+Y for quick navigation

### Comparison Tools

- **Side-by-Side**: Compare two builds simultaneously
- **Difference Highlighting**: Visualize stat differences
- **Import/Export**: Compare with imported builds

### Template System

- **Pre-built Templates**: Community-voted popular builds
- **Personal Templates**: User-created template library
- **Quick Apply**: One-click template application

## Source References

### Client Components

- **Main Builder**: `/client/components/ModBuilder/ModBuilder.tsx`
- **Equipment Selector**: `/client/components/ModBuilder/EquipmentSelector.tsx`
- **Mod Browser**: `/client/components/ModBuilder/ModBrowser.tsx`
- **Slot Grid**: `/client/components/ModBuilder/SlotGrid.tsx`

### Utilities

- **Damage Calculation**: `/client/utils/damage.ts`
- **Mod Logic**: `/client/utils/mods.ts`
- **Capacity Calculation**: `/client/utils/capacity.ts`

### Server Endpoints

- **Build Management**: `/server/routes/buildsRouter.ts`
- **Catalog Data**: `/server/routes/catalogRouter.ts`
- **Validation**: `/server/validation/builds.ts`

### Shared Types

- **Build Interfaces**: `/shared/builds.ts`
- **Mod Interfaces**: `/shared/mods.ts`
- **Equipment Types**: `/shared/equipmentTypes.ts`
