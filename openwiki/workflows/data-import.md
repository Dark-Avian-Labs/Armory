# Data Import Workflow

Armory's data import pipeline is a critical system that fetches, processes, and stores game data from multiple sources. It combines official Digital Extremes exports with supplementary wiki data to create a comprehensive catalog.

## Import Pipeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Import Pipeline                     │
├─────────────────────────────────────────────────────────────┤
│  1. Startup Check      → 2. DE Export Download             │
│  • Catalog empty?      │  • Fetch manifest                │
│  • Data stale?         │  • Download exports              │
│  • Import needed?      │  • Verify hashes                 │
├─────────────────────────────────────────────────────────────┤
│  3. JSON Processing    → 4. Database Insertion             │
│  • Parse exports       │  • Normalize data                │
│  • Extract entities    │  • Create relationships          │
│  • Transform formats   │  • Handle duplicates             │
├─────────────────────────────────────────────────────────────┤
│  5. Wiki Scraping      → 6. Image Caching                 │
│  • Fetch wiki pages    │  • Download images               │
│  • Parse HTML          │  • Cache locally                 │
│  • Extract data        │  • Update references             │
├─────────────────────────────────────────────────────────────┤
│  7. Derived Data       → 8. Cleanup & Reporting           │
│  • Generate registries │  • Update metadata               │
│  • Calculate stats     │  • Log results                   │
│  • Create indexes      │  • Notify completion             │
└─────────────────────────────────────────────────────────────┘
```

## 1. Startup Check

### Import Trigger Conditions (`/server/import/startupPipeline.ts`)

```typescript
export async function shouldRunImport(catalogDb: Database): Promise<boolean> {
  // Check if catalog is empty
  const hasData = catalogDb.prepare('SELECT 1 FROM mods LIMIT 1').get();
  if (!hasData) return true;

  // Check if import is stale (older than 7 days)
  const lastImport = getLastImportRun(catalogDb);
  const daysSinceImport = (Date.now() - lastImport.finishedAt) / (1000 * 60 * 60 * 24);

  return daysSinceImport > 7;
}
```

### Lease System (`/server/import/importRuns.ts`)

- **Prevents Concurrent Imports**: Only one import can run at a time
- **Lease Acquisition**: Time-limited lock on import process
- **Lease Recovery**: Automatic recovery of stale leases on startup
- **Status Tracking**: Real-time import progress monitoring

## 2. Digital Extremes Export Download

### Manifest System (`/server/import/manifest.ts`)

```typescript
interface ExportManifest {
  timestamp: string;
  exports: ExportEntry[];
}

interface ExportEntry {
  name: string;
  url: string;
  sha256: string;
  size: number;
  category: string;
}
```

### Download Process

1. **Fetch Manifest**: Download latest manifest from DE's export server
2. **Filter Exports**: Select only needed export categories (Mods, Equipment, etc.)
3. **Parallel Downloads**: Download multiple exports simultaneously
4. **Hash Verification**: Verify SHA256 hashes for data integrity
5. **Temporary Storage**: Store downloads in `data/exports/` directory

### Required Exports

- `Mods.json`: All mod definitions and stats
- `ExportRegions.json`: Equipment and item definitions
- `Languages.json`: Localized text data
- `Customizations.json`: Cosmetic and visual data

## 3. JSON Processing

### Parser Pipeline (`/server/import/pipeline.ts`)

```typescript
export async function processExports(exportsDir: string): Promise<ProcessedData> {
  const processors = [
    processModsExport,
    processEquipmentExport,
    processDamageTypesExport,
    processModSetsExport,
  ];

  const results: ProcessedData = {};
  for (const processor of processors) {
    const data = await processor(exportsDir);
    Object.assign(results, data);
  }

  return results;
}
```

### Data Transformation

- **Normalization**: Convert DE's nested structures to flat tables
- **Type Conversion**: String numbers to actual numbers, boolean strings to booleans
- **Relationship Mapping**: Create foreign key relationships between entities
- **Duplicate Handling**: Merge duplicate entries with conflict resolution

## 4. Database Insertion

### Transaction-Based Insertion

```typescript
export function insertCatalogData(db: Database, data: ProcessedData): void {
  db.transaction(() => {
    // Clear existing data (for full re-import)
    db.exec('DELETE FROM mods');
    db.exec('DELETE FROM equipment');
    // ... other tables

    // Insert new data
    insertMods(db, data.mods);
    insertEquipment(db, data.equipment);
    insertEquipmentSlots(db, data.equipmentSlots);
    // ... other inserts
  })();
}
```

### Batch Operations

- **Prepared Statements**: Reuse insert statements for performance
- **Batch Inserts**: Insert multiple rows in single operation
- **Error Recovery**: Continue on non-critical errors with logging

## 5. Wiki Scraping

### Scraper Foundation (`/server/scraping/wikiScraper.ts`)

```typescript
export class WikiScraper {
  private readonly rateLimiter = new RateLimiter({
    requestsPerSecond: 2, // Respect wiki rate limits
    maxQueueSize: 100,
  });

  async scrapePage(url: string): Promise<CheerioStatic> {
    await this.rateLimiter.wait();
    const response = await fetch(url, {
      headers: { 'User-Agent': process.env.WIKI_USER_AGENT },
    });
    return cheerio.load(await response.text());
  }
}
```

### Scraping Targets

- **Helminth Abilities**: `/server/scraping/helminthWikiPage.ts`
- **Incarnon Weapons**: `/server/scraping/incarnonWiki.ts`
- **Weapon Fire Behaviors**: `/server/scraping/weaponFireBehaviorsWiki.ts`
- **Stance Mod Images**: `/server/scraping/stanceImages.ts`

### Data Extraction

- **HTML Parsing**: Cheerio for DOM traversal and data extraction
- **Table Parsing**: Convert wiki tables to structured data
- **Image Extraction**: Download and cache stance mod images
- **Formula Parsing**: Extract damage calculation formulas

## 6. Image Caching

### Image Pipeline (`/server/scraping/imageCache.ts`)

```typescript
export async function cacheImage(url: string, filename: string): Promise<string> {
  const localPath = path.join(IMAGES_DIR, filename);

  // Skip if already cached and recent
  if (await isCachedAndFresh(localPath)) {
    return localPath;
  }

  // Download and cache
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(localPath, Buffer.from(buffer));

  return localPath;
}
```

### Image Types

- **Stance Mod Images**: From wiki, cached for UI display
- **Equipment Icons**: From DE exports, used in equipment selector
- **Damage Type Icons**: Visual indicators for damage types
- **Polarity Icons**: UI elements for slot polarities

## 7. Derived Data Generation

### Registry Generation (`/scripts/generate-helminth-registry.mjs`)

```javascript
// Generate Helminth ability registry from scraped data
const abilities = await scrapeHelminthAbilities();
const registry = transformToRegistry(abilities);

await fs.writeFile(
  'shared/helminthRegistry.generated.ts',
  `export const helminthRegistry = ${JSON.stringify(registry, null, 2)};`,
);
```

### Generated Registries

- **Helminth Registry**: `/shared/helminthRegistry.generated.ts`
- **Warframe Rank Exceptions**: `/shared/warframeRankExceptions.generated.ts`
- **Archon Shard Registry**: `/shared/archonShardRegistry.ts`
- **Damage Formulas**: `/shared/damageFromWiki.ts`

### Statistical Calculations

- **Average Stats**: Calculate average mod stats by category
- **Popularity Metrics**: Track commonly used mod combinations
- **Performance Benchmarks**: Equipment performance rankings

## 8. Cleanup & Reporting

### Import Metadata

```typescript
interface ImportRun {
  id: string;
  startedAt: Date;
  finishedAt: Date;
  status: 'completed' | 'failed' | 'running';
  stats: {
    modsImported: number;
    equipmentImported: number;
    imagesCached: number;
    errors: number;
  };
  errors: string[];
}
```

### Cleanup Tasks

1. **Temporary Files**: Remove downloaded export files
2. **Stale Cache**: Clean up old cached images
3. **Database Optimization**: Run `VACUUM` and `ANALYZE`
4. **Backup Creation**: Create backup of updated catalog

### Notification System

- **Console Logging**: Detailed import progress to console
- **Admin Dashboard**: Web interface for import monitoring
- **Error Alerts**: Email/notification for critical failures

## Admin Controls

### Manual Import Triggers (`/server/import/adminImportJob.ts`)

```typescript
export async function triggerManualImport(): Promise<ImportJob> {
  // Check for existing running import
  if (isAdminImportRunning()) {
    throw new Error('Import already running');
  }

  // Start import job
  const jobId = startImportJob();
  return { jobId, status: 'started' };
}
```

### Import Types

- **Full Re-import**: Complete catalog rebuild
- **Incremental Update**: Update only changed data
- **Wiki Data Only**: Refresh only wiki-scraped data
- **Image Refresh**: Update cached images only

### Monitoring Endpoints

- **`GET /api/admin/import/status`**: Current import status
- **`GET /api/admin/import/history`**: Past import runs
- **`POST /api/admin/import/trigger`**: Manual import trigger (admin only)

## Error Handling & Recovery

### Error Categories

1. **Network Errors**: Failed downloads, timeouts
2. **Parsing Errors**: Malformed JSON, HTML parsing failures
3. **Database Errors**: Constraint violations, transaction failures
4. **Scraping Errors**: Wiki page changes, rate limiting

### Recovery Strategies

- **Retry Logic**: Exponential backoff for transient errors
- **Checkpoint System**: Resume from last successful step
- **Partial Success**: Continue with available data, log errors
- **Fallback Data**: Use cached data when fresh data unavailable

### Validation & Sanitization

- **Data Validation**: Schema validation for all imported data
- **Sanitization**: Clean HTML, prevent injection attacks
- **Consistency Checks**: Verify relationships between entities
- **Duplicate Detection**: Identify and handle duplicate entries

## Performance Optimizations

### Parallel Processing

- **Export Downloads**: Parallel download of multiple files
- **Wiki Scraping**: Concurrent scraping of independent pages
- **Image Caching**: Parallel image downloads
- **Database Operations**: Batch inserts and transactions

### Caching Strategy

- **Export Cache**: Keep recent exports for quick re-import
- **Wiki Cache**: Cache wiki page responses
- **Image Cache**: Local storage of downloaded images
- **Derived Data Cache**: Pre-computed registries and indexes

### Memory Management

- **Stream Processing**: Process large exports as streams
- **Chunked Operations**: Process data in manageable chunks
- **Garbage Collection**: Explicit cleanup of temporary objects
- **Memory Monitoring**: Track memory usage during import

## Source References

### Core Import Logic

- **Pipeline Orchestration**: `/server/import/startupPipeline.ts`
- **Export Processing**: `/server/import/pipeline.ts`
- **Manifest System**: `/server/import/manifest.ts`

### Scraping Components

- **Wiki Scraper**: `/server/scraping/wikiScraper.ts`
- **Helminth Scraper**: `/server/scraping/helminthWikiPage.ts`
- **Image Cache**: `/server/scraping/imageCache.ts`

### Admin Controls

- **Import Job Management**: `/server/import/adminImportJob.ts`
- **Import History**: `/server/import/importRuns.ts`

### Scripts

- **Registry Generation**: `/scripts/generate-helminth-registry.mjs`
- **Exception Generation**: `/scripts/generate-warframe-rank-exceptions.mjs`

### Database

- **Schema Definition**: `/server/db/catalogSchema.ts`
- **Data Insertion**: `/server/import/` (various files)
