# Architecture Overview

Armory follows a modern full-stack architecture with clear separation between client and server components, using TypeScript throughout the stack.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React + Vite)                    │
├─────────────────────────────────────────────────────────────┤
│  Components     │  State      │  Routing    │  Styling      │
│  • ModBuilder   │  • Context  │  • React    │  • Tailwind   │
│  • BuildCatalog │  • Hooks    │    Router   │    CSS        │
│  • Loadout      │             │             │               │
└─────────────────────────────────────────────────────────────┘
                             │
                    HTTPS / JSON API
                             │
┌─────────────────────────────────────────────────────────────┐
│                    Server (Express.js)                      │
├─────────────────────────────────────────────────────────────┤
│  API Routes     │  Business    │  Data       │  External    │
│  • /api/builds  │   Logic      │   Access    │   Services   │
│  • /api/catalog │  • Import    │  • SQLite   │  • Clerk     │
│  • /auth/*      │   Pipeline   │  • Queries  │  • Wiki API  │
└─────────────────────────────────────────────────────────────┘
                             │
                    SQLite Databases
                    ┌────────┴────────┐
              ┌─────▼─────┐    ┌─────▼─────┐
              │  Catalog  │    │   User    │
              │  Database │    │  Database │
              └───────────┘    └───────────┘
```

## Technology Stack

### Frontend

- **React 19**: UI component library
- **Vite 8**: Build tool and dev server
- **TypeScript 6**: Type-safe JavaScript
- **Tailwind CSS 4**: Utility-first CSS framework
- **React Router DOM 7**: Client-side routing

### Backend

- **Express.js 5**: Web application framework
- **better-sqlite3**: SQLite database driver
- **TypeScript 6**: Type-safe server code
- **dotenvx**: Environment variable management

### Database

- **SQLite 3**: Embedded relational database
- **Three Databases**:
  1. `armory.db`: Read-only catalog data (mods, equipment)
  2. `builds.db`: User-generated content (builds, loadouts)
  3. `session.db`: CSRF session storage

### Authentication & Security

- **Clerk**: Authentication provider
- **csrf-sync**: CSRF protection
- **express-rate-limit**: Rate limiting
- **helmet**: Security headers
- **express-session**: Session management

## Directory Structure

### Client (`/client/`)

- **`/app/`**: React Router routes and page components
- **`/components/`**: Reusable UI components organized by domain
- **`/features/`**: Feature-based modules (auth, legal, etc.)
- **`/hooks/`**: Custom React hooks
- **`/utils/`**: Client-side utilities and helpers
- **`/styles/`**: Tailwind CSS configuration and custom styles

### Server (`/server/`)

- **`/routes/`**: Express route handlers organized by domain
- **`/db/`**: Database layer with schema definitions and queries
- **`/import/`**: Data import pipeline from DE exports and wiki
- **`/scraping/`**: Wiki scraping modules
- **`/auth/`**: Clerk authentication middleware and utilities
- **`/http/`**: HTTP middleware (CSP, request ID, etc.)
- **`/cache/`**: Caching layer for mod lists and images

### Shared (`/shared/`)

- **Type Definitions**: Shared interfaces between client and server
- **Business Models**: Domain objects for mods, equipment, damage
- **Generated Code**: Auto-generated registries (Helminth, etc.)

## Data Flow

### 1. Application Startup

1. Server starts and creates/validates SQLite databases
2. Data import pipeline runs if catalog is empty or stale
3. Clerk middleware initializes authentication
4. CSRF protection sets up session store
5. Health check endpoints become available

### 2. Client Interaction

1. User accesses React SPA (served by Express in production)
2. Clerk handles authentication via embedded components
3. Client fetches catalog data from `/api/catalog` endpoints
4. Mod builder UI loads equipment and mod data
5. User creates builds which are saved via `/api/builds`

### 3. Data Import Pipeline

1. Checks Digital Extremes manifest for latest exports
2. Downloads required export files via HTTPS
3. Parses JSON exports into normalized database format
4. Scrapes Warframe wiki for supplementary data
5. Caches images and updates database tables
6. Generates derived data (Helminth registry, etc.)

## Key Architectural Decisions

### 1. Dual Database Approach

- **Separation of Concerns**: Catalog data (read-only) vs user data (read-write)
- **External Integration**: Codex project can read catalog DB directly
- **Performance**: User operations don't interfere with catalog queries
- **Backup Strategy**: Different backup frequencies for each DB

### 2. TypeScript Monorepo

- **Shared Types**: `/shared/` directory ensures type consistency
- **Separate Configs**: Different tsconfig for client and server
- **Build Process**: Server compiled separately from client bundle

### 3. Stateless Authentication

- **Clerk Integration**: External auth provider reduces complexity
- **JWT Tokens**: Stateless authentication for scalability
- **Webhook Support**: User lifecycle events handled via webhooks

### 4. Offline-First Data

- **SQLite**: Embedded database requires no external DB server
- **Cached Images**: Wiki images cached locally for performance
- **Export-Based**: Primary data source is DE's public exports

## Performance Considerations

### Database Optimization

- **Prepared Statements**: Reusable query templates in `queries.ts`
- **Indexed Columns**: Appropriate indexes on frequently queried fields
- **Connection Pooling**: Single connection per database with better-sqlite3

### Client-Side Performance

- **Code Splitting**: Vite automatically splits code by route
- **Image Optimization**: Cached and optimized wiki images
- **State Management**: React Context for shared state without heavy libraries

### Server-Side Performance

- **Rate Limiting**: Protects against abusive requests
- **Response Compression**: Gzip compression for API responses
- **Caching Layer**: Mod list and image caching reduces database load

## Deployment Architecture

### Development Mode

- **Client**: Vite dev server with hot reload
- **Server**: Express in API-only mode (no static file serving)
- **Database**: Local SQLite files in `data/` directory

### Production Mode

- **Client**: Built and served by Express static middleware
- **Server**: Same Express instance serves API and static files
- **Database**: SQLite files at configurable paths (can be absolute)

### Health Monitoring

- **`/healthz`**: Basic application health check
- **`/readyz`**: Database connectivity check
- **Logging**: Structured logging with request IDs

## Extension Points

### 1. New Equipment Types

- Add to `/shared/equipmentTypes.ts`
- Update catalog schema in `/server/db/catalogSchema.ts`
- Add import logic in `/server/import/pipeline.ts`

### 2. New Damage Calculations

- Extend `/shared/damageFromWiki.ts`
- Add scraping logic in `/server/scraping/`
- Update client utilities in `/client/utils/damage.ts`

### 3. Additional API Endpoints

- Create new route file in `/server/routes/`
- Register route in `/server/routes/api.ts`
- Add TypeScript definitions in `/shared/`

## Source References

- **Server Entry**: `/server/index.ts`
- **Database Layer**: `/server/db/`
- **API Routes**: `/server/routes/`
- **Client Entry**: `/client/main.tsx`
- **Build Configuration**: `/vite.config.ts`, `/tsconfig.*.json`
- **Environment**: `/.env.example`, `/server/config.js`
