# Armory OpenWiki Quickstart

## Overview

Armory is a Warframe mod builder and planner application that provides comprehensive mod configuration, damage calculation, and build management for Warframe players. The application imports game data directly from Digital Extremes' public exports and supplements it with data scraped from the Warframe wiki.

**Key Features:**

- Full mod builder with slot management and polarity matching
- Damage calculation engine using wiki-scraped formulas
- Helminth ability system integration
- User build saving and loadout management
- Authentication via Clerk with role-based access
- Direct database integration with external Codex project

## Repository Structure

```
/
├── client/                 # React frontend (Vite + Tailwind CSS)
│   ├── app/               # Application routes and pages
│   ├── components/        # UI components by domain
│   ├── features/          # Feature-based modules
│   ├── hooks/            # Custom React hooks
│   └── utils/            # Client-side utilities
├── server/                # Express.js backend
│   ├── routes/           # API endpoints
│   ├── db/              # Database layer (SQLite)
│   ├── import/          # Data import pipeline
│   ├── scraping/        # Wiki scraping functionality
│   └── auth/            # Clerk authentication
├── shared/               # Shared TypeScript definitions
├── scripts/             # Build and data generation scripts
├── data/               # SQLite database files
└── tests/              # Test suite (Vitest)
```

## Getting Started

### Prerequisites

- Node.js 26+
- pnpm 11+
- Clerk account (for authentication)

### Installation

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Copy environment file: `cp .env.example .env`
4. Configure required environment variables (see [Environment Configuration](operations/environment.md))
5. Build the application: `pnpm run build`
6. Start the server: `pnpm start`

### Development

- Run type checking: `pnpm run typecheck`
- Run tests: `pnpm run test`
- Run validation suite: `pnpm run validate`
- Start development server: Use Vite dev server for client development

## Documentation Sections

### [Architecture](architecture/)

- **System Overview**: Full-stack React/Express architecture with SQLite databases
- **Database Design**: Three SQLite databases (catalog, user data, sessions)
- **Authentication**: Clerk integration with CSRF protection
- **Data Flow**: Import pipeline and wiki scraping workflows

### [Workflows](workflows/)

- **Mod Building**: Create and configure Warframe mod builds
- **Data Import**: Automated data import from DE exports and wiki
- **User Builds**: Save, load, and share builds with other users
- **Damage Calculation**: Real-time damage computation with wiki formulas

### [Domain Concepts](domain/)

- **Warframe Modding**: Game-specific modding concepts and mechanics
- **Helminth System**: Ability subsumption and compatibility
- **Equipment Types**: Warframes, weapons, companions, and archwings
- **Damage System**: Damage types, modifiers, and calculation formulas

### [Operations](operations/)

- **Deployment**: Production deployment and health monitoring
- **Database Management**: Schema creation, migrations, and backups
- **Environment Configuration**: Required environment variables
- **Troubleshooting**: Common issues and solutions

### [Testing](testing/)

- **Test Structure**: Vitest setup and test organization
- **API Testing**: Express route testing with supertest
- **Unit Testing**: Business logic testing patterns
- **Quality Checks**: Linting, formatting, and type checking

### [Integrations](integrations/)

- **Clerk Authentication**: User authentication and webhook handling
- **Wiki Scraping**: Warframe wiki data integration
- **Codex Integration**: Database sharing with external Codex project
- **Digital Extremes API**: DE export manifest and data download

## Key Source Files

### Server Entry Points

- `/server/index.ts` - Main Express server configuration
- `/server/routes/api.ts` - Primary API router
- `/server/routes/buildsRouter.ts` - Build management API

### Client Entry Points

- `/client/main.tsx` - React application entry point
- `/client/App.tsx` - Root application component

### Database Schema

- `/server/db/catalogSchema.ts` - Catalog database table definitions
- `/server/db/userSchema.ts` - User data table definitions
- `/server/db/schema.js` - Schema creation utilities

### Data Import

- `/server/import/startupPipeline.ts` - Complete data import pipeline
- `/server/scraping/wikiScraper.ts` - Wiki scraping foundation
- `/scripts/generate-helminth-registry.mjs` - Data generation scripts

## Development Workflow

1. **Database Setup**: The application automatically creates SQLite databases on first run
2. **Data Import**: Initial data import runs automatically on server startup
3. **Client Development**: Use Vite dev server for hot reload during development
4. **Testing**: Run `pnpm run validate` before committing changes
5. **Building**: Production build compiles both server and client code

## Environment Notes

- **Development Mode**: API-only mode; client served via Vite dev server
- **Production Mode**: Full-stack mode; client built and served by Express
- **Encrypted Environment**: Supports dotenvx for encrypted environment variables
- **Required Variables**: Clerk keys, session secret, wiki user-agent

## Related Projects

- **Codex**: External project that reads Armory's SQLite catalog directly for Warframe data synchronization
- **Digital Extremes Export API**: Source of official game data
- **Warframe Wiki**: Supplementary data source for damage formulas and images

---

**Next Steps:** Review the [Architecture Overview](architecture/) for detailed technical documentation, or check [Workflows](workflows/) for business process documentation.
