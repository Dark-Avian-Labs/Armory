# Integrations

Armory integrates with several external systems and services to provide a comprehensive Warframe modding experience. This section details each integration point.

## Clerk Authentication

Clerk provides authentication, user management, and session handling for Armory.

### Integration Points

#### 1. Client-Side Authentication (`/client/features/auth/`)

```typescript
// Clerk React provider setup
import { ClerkProvider } from '@clerk/react';

function App() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <AppContent />
    </ClerkProvider>
  );
}
```

#### 2. Server-Side Middleware (`/server/auth/middleware.js`)

```javascript
// Express middleware for Clerk authentication
import { clerkMiddleware } from '@clerk/express';

export const clerkAuthMiddleware = clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});
```

#### 3. Webhook Handling (`/server/routes/webhooks.ts`)

```typescript
// Handle Clerk webhook events
router.post('/api/webhooks/clerk', async (req, res) => {
  const event = await verifyClerkWebhook(req);

  switch (event.type) {
    case 'user.created':
      await handleUserCreated(event.data);
      break;
    case 'user.deleted':
      await handleUserDeleted(event.data);
      break;
    case 'session.created':
      await handleSessionCreated(event.data);
      break;
  }

  res.json({ received: true });
});
```

### Required Configuration

#### Environment Variables

```bash
# Production (required)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# Development
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
```

#### Clerk Dashboard Setup

1. **Create Application**: Set up Armory application in Clerk dashboard
2. **Configure Redirects**:
   - Sign-in URL: `https://armory.example.com/sign-in`
   - Sign-up URL: `https://armory.example.com/sign-up`
   - After-sign-in URL: `https://armory.example.com/`
   - After-sign-out URL: `https://armory.example.com/`
3. **Configure Webhooks**:
   - Endpoint: `https://armory.example.com/api/webhooks/clerk`
   - Subscribe to: `user.created`, `user.deleted`, `session.*`
4. **Set Up Roles** (optional):
   - `admin`: Can trigger manual imports
   - `user`: Regular user permissions

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Flow                      │
├─────────────────────────────────────────────────────────────┤
│  1. User clicks "Sign In"                                   │
│  2. Clerk modal appears (handled by @clerk/react)          │
│  3. User authenticates (email, OAuth, etc.)                │
│  4. Clerk returns JWT token to client                      │
│  5. Token sent to server via Authorization header          │
│  6. Clerk middleware validates token and sets req.auth     │
│  7. Server routes check req.auth for user ID and roles     │
└─────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control

```typescript
// Check admin role in route handlers
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check for admin role in session metadata
  const isAdmin = req.auth.sessionClaims?.metadata?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Apply to admin routes
router.post('/api/admin/import/trigger', requireAdmin, triggerManualImport);
```

## Warframe Wiki Integration

Armory scrapes data from the Warframe Wiki to supplement official DE export data.

### Scraping Components

#### 1. Base Scraper (`/server/scraping/wikiScraper.ts`)

```typescript
export class WikiScraper {
  private readonly baseUrl = 'https://warframe.fandom.com/wiki';
  private readonly rateLimiter = new RateLimiter({
    requestsPerSecond: 2, // Respect wiki rate limits
  });

  async fetchPage(pageName: string): Promise<CheerioStatic> {
    const url = `${this.baseUrl}/${encodeURIComponent(pageName)}`;
    const response = await this.rateLimiter.execute(() =>
      fetch(url, {
        headers: {
          'User-Agent': process.env.WIKI_USER_AGENT || 'Armory/1.0',
        },
      }),
    );

    return cheerio.load(await response.text());
  }
}
```

#### 2. Scraping Targets

##### Helminth Abilities (`/server/scraping/helminthWikiPage.ts`)

- **Source**: https://warframe.fandom.com/wiki/Helminth#Abilities
- **Data Extracted**: Ability names, Warframe sources, compatibility
- **Output**: `/shared/helminthRegistry.generated.ts`

##### Incarnon Weapons (`/server/scraping/incarnonWiki.ts`)

- **Source**: Incarnon Genesis weapon pages
- **Data Extracted**: Evolution perks, transformation mechanics
- **Integration**: Weapon mod builder compatibility

##### Weapon Fire Behaviors (`/server/scraping/weaponFireBehaviorsWiki.ts`)

- **Source**: Individual weapon pages
- **Data Extracted**: Fire rate, reload speed, damage calculations
- **Output**: `/shared/damageFromFireBehaviors.ts`

##### Stance Mod Images (`/server/scraping/stanceImages.ts`)

- **Source**: Stance mod pages
- **Data Extracted**: Image URLs for stance mod icons
- **Storage**: Cached in `data/images/`

### Rate Limiting and Etiquette

#### Required Configuration

```bash
# Must be set to respect wiki terms of service
WIKI_USER_AGENT=ArmoryBot/1.0 (https://armory.example.com; admin@example.com)
```

#### Rate Limiting Rules

- **Maximum**: 2 requests per second
- **Caching**: 24-hour cache for successful scrapes
- **Error Handling**: Exponential backoff on failures
- **Respect robots.txt**: Follow wiki's robots.txt directives

### Data Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Wiki Scraping Pipeline                   │
├─────────────────────────────────────────────────────────────┤
│  1. Identify data gap (missing from DE exports)            │
│  2. Determine wiki page to scrape                          │
│  3. Fetch page with rate limiting                          │
│  4. Parse HTML with Cheerio                                │
│  5. Extract structured data                                │
│  6. Transform to internal format                           │
│  7. Store in database or generated file                    │
│  8. Cache result to avoid repeated scraping                │
└─────────────────────────────────────────────────────────────┘
```

## Codex Integration

Codex is an external project that reads Armory's catalog database directly for Warframe data synchronization.

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Codex Integration                        │
├─────────────────────────────────────────────────────────────┤
│  Armory                    │  Codex                         │
│  • Writes catalog data     │  • Reads catalog data         │
│  • Maintains armory.db     │  • Uses ARMORY_DB_PATH        │
│  • Runs import pipeline    │  • Syncs to its own DB        │
└────────────────────────────┴────────────────────────────────┘
```

### Shared Database Configuration

#### Environment Coordination

```bash
# Armory configuration
ARMORY_DB_PATH=/var/lib/armory/data/armory.db

# Codex configuration (in Codex's environment)
ARMORY_DB_PATH=/var/lib/armory/data/armory.db
```

#### Database Schema Stability

- **Backward Compatibility**: Schema changes must not break Codex reads
- **Version Checking**: Codex can check schema version on startup
- **Deprecation Policy**: Old columns kept during transition periods

### Data Flow

1. **Armory Import**: DE exports → Armory processing → `armory.db`
2. **Codex Sync**: Codex reads `armory.db` → Codex processing → Codex database
3. **User Interaction**: Codex uses synced data for its features

### Integration Points

#### 1. Database Path Configuration

- Both applications use same `ARMORY_DB_PATH` environment variable
- Armory creates and maintains the database
- Codex opens database in read-only mode

#### 2. Schema Version Management

```sql
-- Armory stores schema version
PRAGMA user_version = 5;

-- Codex checks version on startup
PRAGMA user_version;
```

#### 3. Data Freshness Coordination

- Codex can check `import_runs` table for last import timestamp
- Armory provides `/api/catalog/last-import` endpoint
- Codex can trigger import via admin API (if configured)

### Error Handling

#### Common Issues

1. **Database Locked**: Codex trying to write to read-only DB
2. **Schema Mismatch**: Codex expects different table structure
3. **Path Incorrect**: `ARMORY_DB_PATH` points to wrong location
4. **Permissions**: Codex cannot read Armory's database file

#### Recovery Procedures

1. Verify `ARMORY_DB_PATH` is identical in both applications
2. Check file permissions on database file
3. Verify Armory is running and has created database
4. Check schema version compatibility

## Digital Extremes Export API

Armory downloads official game data from Digital Extremes' public export server.

### Export Manifest System

#### Manifest Structure (`/server/import/manifest.ts`)

```typescript
interface ExportManifest {
  timestamp: string;
  exports: ExportEntry[];
}

interface ExportEntry {
  name: string; // e.g., "Mods.json"
  url: string; // Full download URL
  sha256: string; // Integrity hash
  size: number; // File size in bytes
  category: string; // e.g., "Mods", "Equipment"
}
```

#### Download Process

1. **Fetch Manifest**: Download `https://content.warframe.com/PublicExport/index.txt`
2. **Parse Entries**: Convert manifest to structured data
3. **Filter**: Select only needed export categories
4. **Download**: Fetch selected JSON files
5. **Verify**: Check SHA256 hashes for integrity

### Required Exports

#### Core Exports

- **`Mods.json`**: All mod definitions, stats, and metadata
- **`ExportRegions.json`**: Equipment, items, and game objects
- **`Languages.json`**: Localized text strings
- **`Customizations.json`**: Cosmetics and visual customizations

#### Optional Exports

- **`ChallengeGroups.json`**: Achievement and challenge data
- **`ConclaveMods.json`**: PvP-specific mods
- **`Skins.json`**: Weapon and Warframe skins

### Update Frequency

#### Automatic Checking

- **Startup Check**: On server startup, if catalog is empty
- **Scheduled Check**: Every 7 days for stale data
- **Manual Trigger**: Admin can force re-import

#### Change Detection

1. Compare manifest timestamp with last import
2. Check if any required exports have changed hashes
3. Only download and process changed files

### Error Handling

#### Network Issues

- **Retry Logic**: Exponential backoff for failed downloads
- **Fallback**: Use cached exports if fresh download fails
- **Partial Import**: Import available data, log missing parts

#### Data Corruption

- **Hash Verification**: SHA256 checking on all downloads
- **JSON Validation**: Schema validation before processing
- **Database Transactions**: Roll back on parsing errors

## Image Caching System

Armory caches images from multiple sources for performance and reliability.

### Image Sources

#### 1. Warframe Wiki Images

- **Stance Mod Icons**: From stance mod pages
- **Damage Type Icons**: Visual indicators
- **Equipment Images**: Thumbnails for UI display

#### 2. Digital Extremes Exports

- **Mod Icons**: From `Mods.json` companion images
- **Equipment Icons**: Small icons for equipment browser

#### 3. Generated Images

- **Build Previews**: HTML-to-image exports of builds
- **Comparison Charts**: Visual stat comparisons

### Caching Implementation (`/server/scraping/imageCache.ts`)

```typescript
export class ImageCache {
  private readonly cacheDir: string;

  constructor(cacheDir = './data/images') {
    this.cacheDir = cacheDir;
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  async getImage(url: string, filename: string): Promise<string> {
    const localPath = path.join(this.cacheDir, filename);

    // Check cache
    if (await this.isCached(localPath)) {
      return localPath;
    }

    // Download and cache
    await this.downloadAndCache(url, localPath);
    return localPath;
  }
}
```

### Cache Management

#### Storage Organization

```
data/images/
├── stances/          # Stance mod images
├── damage-types/     # Damage type icons
├── equipment/        # Equipment thumbnails
├── mods/            # Mod icons
└── generated/       # User-generated images
```

#### Cache Invalidation

- **Time-based**: Images older than 30 days re-downloaded
- **Version-based**: Cache busting on schema changes
- **Manual Clear**: Admin can clear cache via API

### Performance Optimizations

#### Client-Side Delivery

- **Static File Serving**: Images served directly by Express
- **CDN Integration**: Can be offloaded to CDN in production
- **Lazy Loading**: Images load on demand in UI

#### Storage Optimization

- **Format Conversion**: Convert to WebP for smaller file sizes
- **Size Reduction**: Resize large images for thumbnails
- **Compression**: Lossless compression where possible

## External API Endpoints

### Public API

- **`GET /api/catalog/*`**: Read-only catalog data access
- **`GET /api/builds/public`**: Public builds (if enabled)
- **`GET /api/healthz`**: Health check endpoint

### Admin API (Authenticated)

- **`POST /api/admin/import/trigger`**: Manual import trigger
- **`GET /api/admin/import/status`**: Import status check
- **`POST /api/admin/cache/clear`**: Clear image cache

### Webhook Endpoints

- **`POST /api/webhooks/clerk`**: Clerk user lifecycle events
- **`POST /api/webhooks/github`**: GitHub integration (if needed)

## Source References

### Authentication

- **Clerk Middleware**: `/server/auth/middleware.js`
- **Webhook Handler**: `/server/routes/webhooks.ts`
- **Client Provider**: `/client/features/auth/`

### Wiki Scraping

- **Base Scraper**: `/server/scraping/wikiScraper.ts`
- **Helminth Scraper**: `/server/scraping/helminthWikiPage.ts`
- **Image Cache**: `/server/scraping/imageCache.ts`

### DE Export Integration

- **Manifest System**: `/server/import/manifest.ts`
- **Export Processing**: `/server/import/pipeline.ts`

### Codex Integration

- **Database Path**: `/server/config.js` (ARMORY_DB_PATH)
- **Schema Definition**: `/server/db/catalogSchema.ts`
