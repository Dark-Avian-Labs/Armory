# Testing Overview

Armory uses Vitest as its test runner with a comprehensive test suite covering unit tests, integration tests, and end-to-end API testing. Tests are co-located with source code for better maintainability.

## Test Structure

### Test File Organization

```
tests/
├── helpers/                    # Test utilities
│   └── testExpress.ts         # Express test server setup
├── health-routes.test.ts      # Health endpoint tests
├── buildsApi.test.ts          # Build API integration tests
└── ... other integration tests

client/
├── utils/
│   ├── damage.ts
│   └── damage.test.ts        # Co-located unit test
└── ... other source files with adjacent .test.ts files

server/
├── scraping/
│   ├── helminthWikiPage.ts
│   └── helminthWikiPage.test.ts  # Co-located unit test
└── ... other source files with adjacent .test.ts files
```

### Test Categories

#### 1. Unit Tests

- **Location**: Adjacent to source files (`.test.ts`)
- **Scope**: Individual functions and modules
- **Examples**: Utility functions, data transformations, business logic

#### 2. Integration Tests

- **Location**: `/tests/` directory
- **Scope**: API endpoints with database interaction
- **Examples**: Build saving, catalog queries, authentication

#### 3. Component Tests (Client)

- **Location**: Adjacent to React components
- **Scope**: UI component rendering and interaction
- **Examples**: Mod builder components, form validation

## Test Configuration

### Vitest Configuration (`/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/test-utils/**', 'dist/**', 'coverage/**'],
    },
  },
});
```

### Test Environment Setup

#### Database Test Fixtures

```typescript
// tests/helpers/db.ts
export function createTestDatabase(): Database {
  const db = new Database(':memory:'); // In-memory SQLite
  createAppSchema(db); // Apply full schema
  return db;
}

export function seedTestData(db: Database): void {
  // Insert test mods, equipment, etc.
  db.exec(`
    INSERT INTO mods (uniqueName, name, polarity) VALUES
    ('TestMod', 'Test Mod', 'V'),
    ('AnotherMod', 'Another Mod', 'D');
  `);
}
```

#### Express Test Server

```typescript
// tests/helpers/testExpress.ts
export function createTestApp(db: Database): Express {
  const app = express();

  // Mock authentication middleware for tests
  app.use((req, res, next) => {
    req.auth = { userId: 'test-user-123' };
    next();
  });

  // Setup routes with test database
  app.use('/api', createApiRouter(db));

  return app;
}
```

## Writing Tests

### Unit Test Examples

#### Function Testing

```typescript
// client/utils/damage.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDamage } from './damage';

describe('damage calculation', () => {
  it('calculates basic damage correctly', () => {
    const build = createTestBuild();
    const result = calculateDamage(build);

    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.damageTypes).toHaveProperty('Impact');
  });

  it('handles elemental combinations', () => {
    const build = createElementalBuild();
    const result = calculateDamage(build);

    expect(result.damageTypes).toHaveProperty('Viral');
    expect(result.damageTypes.Viral).toBeGreaterThan(0);
  });
});
```

#### Component Testing

```typescript
// client/components/ModBuilder/ModBuilder.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ModBuilder from './ModBuilder';

describe('ModBuilder component', () => {
  it('renders equipment selector', () => {
    render(<ModBuilder />);
    expect(screen.getByText('Select Equipment')).toBeInTheDocument();
  });

  it('displays slots when equipment is selected', async () => {
    render(<ModBuilder initialEquipment="Excalibur" />);

    // Wait for slots to load
    await screen.findByTestId('warframe-slots');
    expect(screen.getAllByRole('slot')).toHaveLength(10); // 8 regular + aura + exilus
  });
});
```

### Integration Test Examples

#### API Endpoint Testing

```typescript
// tests/buildsApi.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, createTestDatabase } from './helpers/testExpress';

describe('Builds API', () => {
  let app: Express;
  let db: Database;

  beforeAll(() => {
    db = createTestDatabase();
    app = createTestApp(db);
  });

  afterAll(() => {
    db.close();
  });

  it('GET /api/builds returns user builds', async () => {
    // Seed test data
    seedTestBuild(db, 'test-user-123');

    const response = await request(app).get('/api/builds').expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('name');
  });

  it('POST /api/builds creates new build', async () => {
    const newBuild = {
      name: 'Test Build',
      equipmentId: 'Excalibur',
      mods: [],
    };

    const response = await request(app).post('/api/builds').send(newBuild).expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Test Build');
  });
});
```

#### Database Integration Tests

```typescript
// server/db/queries.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../tests/helpers/db';
import { getModsByType } from './queries';

describe('database queries', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
    seedTestData(db);
  });

  it('getModsByType returns correct mods', () => {
    const warframeMods = getModsByType(db, 'Warframe');

    expect(warframeMods).toBeInstanceOf(Array);
    expect(warframeMods.length).toBeGreaterThan(0);
    expect(warframeMods[0].type).toBe('Warframe');
  });

  it('getModsByType filters by polarity when specified', () => {
    const maduraiMods = getModsByType(db, 'Warframe', 'V');

    expect(maduraiMods).toBeInstanceOf(Array);
    expect(maduraiMods.every((mod) => mod.polarity === 'V')).toBe(true);
  });
});
```

## Mocking and Test Doubles

### Authentication Mocking

```typescript
// tests/mocks/auth.ts
export const mockClerkMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.auth = {
      userId: 'test-user-123',
      sessionId: 'test-session-456',
      sessionClaims: {
        metadata: { role: 'user' },
      },
    };
    next();
  };
};

export const mockAdminClerkMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.auth = {
      userId: 'admin-user-123',
      sessionId: 'admin-session-456',
      sessionClaims: {
        metadata: { role: 'admin' },
      },
    };
    next();
  };
};
```

### External Service Mocking

#### Wiki Scraper Mock

```typescript
// server/scraping/wikiScraper.test.ts
import { describe, it, expect, vi } from 'vitest';
import { WikiScraper } from './wikiScraper';

describe('WikiScraper', () => {
  it('respects rate limiting', async () => {
    const scraper = new WikiScraper();
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('<html>Test page</html>'));

    // Make multiple requests quickly
    const promises = [
      scraper.fetchPage('Test1'),
      scraper.fetchPage('Test2'),
      scraper.fetchPage('Test3'),
    ];

    await Promise.all(promises);

    // Should have been called with delays between requests
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    // Rate limiting verification would check timing between calls
  });
});
```

#### DE Export API Mock

```typescript
// server/import/manifest.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchExportManifest } from './manifest';

describe('export manifest', () => {
  it('parses manifest correctly', async () => {
    const mockManifest = `Timestamp: 2024-01-01T00:00:00Z
Mods.json|https://content.warframe.com/PublicExport/Manifest/Mods.json|abc123|1024
Equipment.json|https://content.warframe.com/PublicExport/Manifest/Equipment.json|def456|2048`;

    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(mockManifest));

    const manifest = await fetchExportManifest();

    expect(manifest.timestamp).toBe('2024-01-01T00:00:00Z');
    expect(manifest.exports).toHaveLength(2);
    expect(manifest.exports[0].name).toBe('Mods.json');
  });
});
```

## Test Coverage

### Coverage Configuration

```bash
# Run tests with coverage
pnpm run test:coverage

# Coverage output:
# - coverage/           # HTML report
# - coverage/lcov.info  # LCOV format for CI
# - coverage/coverage.json # JSON format
```

### Coverage Goals

- **Unit Tests**: 80%+ coverage for business logic
- **Integration Tests**: Critical path coverage
- **Component Tests**: Core UI component coverage
- **Overall**: 70%+ total coverage

### Coverage Exclusions

- **Generated Code**: Auto-generated registry files
- **Configuration Files**: Build/config files
- **Third-party Code**: External libraries
- **Simple Types**: Type definition files

## Running Tests

### Test Commands

```bash
# Run all tests once
pnpm run test

# Run tests with coverage
pnpm run test:coverage

# Run specific test file
pnpm test tests/buildsApi.test.ts

# Run tests in watch mode (development)
pnpm test --watch

# Run tests matching pattern
pnpm test --run "damage"
```

### CI/CD Integration

#### GitHub Actions Workflow (`/.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '26'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm run typecheck
      - run: pnpm run lint
      - run: pnpm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Test Environment Variables

#### Test-Specific Configuration

```bash
# .env.test (for test environment)
NODE_ENV=test
ARMORY_DB_PATH=:memory:  # In-memory database
USER_DB_PATH=:memory:
SESSION_DB_PATH=:memory:
WIKI_USER_AGENT=ArmoryTest/1.0
```

#### Test Setup Script

```typescript
// tests/setup.ts
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Mock external services
  setupTestMocks();
});

afterAll(() => {
  // Cleanup
  cleanupTestData();
});
```

## Best Practices

### Test Organization

1. **Arrange-Act-Assert Pattern**: Clear separation of setup, execution, verification
2. **Descriptive Test Names**: `describe` and `it` blocks should read like documentation
3. **Independent Tests**: Tests should not depend on each other
4. **Clean Setup/Teardown**: Proper resource management in `beforeEach`/`afterEach`

### Performance Considerations

1. **In-Memory Databases**: Use `:memory:` SQLite for fast tests
2. **Mock External Services**: Avoid network calls in unit tests
3. **Parallel Execution**: Vitest runs tests in parallel by default
4. **Test Data Isolation**: Each test should have its own data

### Maintainability

1. **Test Helpers**: Reusable utilities for common test patterns
2. **Factory Functions**: Generate test data consistently
3. **Snapshot Testing**: For UI components when appropriate
4. **Type Safety**: TypeScript in tests catches many errors early

## Debugging Tests

### Common Issues

#### Database Connection Issues

```bash
# Error: SQLITE_ERROR: no such table
# Solution: Ensure schema is created before tests run
```

#### Timeout Issues

```bash
# Error: Test timeout exceeded
# Solution: Increase timeout or mock slow operations
```

#### Mocking Issues

```bash
# Error: Cannot read property of undefined
# Solution: Check mock setup and restore
```

### Debug Commands

```bash
# Run specific test with debug output
pnpm test --run "builds API" --verbose

# Debug with Node inspector
node --inspect node_modules/.bin/vitest

# Run tests with specific reporter
pnpm test --reporter=verbose
```

## Source References

### Test Configuration

- **Vitest Config**: `/vitest.config.ts`
- **Test Setup**: `/tests/setup.ts` (if exists)
- **Test Helpers**: `/tests/helpers/`

### Example Tests

- **Integration Tests**: `/tests/buildsApi.test.ts`
- **Unit Tests**: `/client/utils/damage.test.ts`
- **Component Tests**: `/client/components/ModBuilder/ModBuilder.test.tsx`

### Quality Checks

- **Validation Script**: `/run-quality-checks.mjs`
- **CI Configuration**: `/.github/workflows/ci.yml`
