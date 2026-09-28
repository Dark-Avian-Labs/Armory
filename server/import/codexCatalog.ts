import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import {
  CODEX_WARFRAME_CATALOG_DB_PATH,
  CODEX_WARFRAME_IMAGES_DIR,
  IMAGES_DIR,
} from '../config.js';
import { getCatalogDb } from '../db/connection.js';

export const CODEX_CATALOG_TABLES = [
  'mod_sets',
  'warframes',
  'weapons',
  'companions',
  'mods',
  'mod_level_stats',
  'mod_set_members',
  'abilities',
  'arcanes',
  'archon_shard_types',
  'archon_shard_buffs',
  'warframe_market_links',
  'codex_modular_weapons',
] as const;

const SKIP_TABLES = new Set(['import_runs', 'import_lease', 'armory_users']);

export type CatalogSyncSummary = {
  tables: Record<string, number>;
  imagesCopied: number;
  imagesSkipped: number;
  sourceDb: string;
  imagesSource: string;
};

export type CatalogSyncLogFn = (message: string, level?: 'info' | 'error') => void;

function escapeSqlIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing unsafe SQL identifier: ${name}`);
  }
  return name;
}

function tableExists(db: Database.Database, table: string, schema = 'main'): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM ${escapeSqlIdent(schema)}.sqlite_master WHERE type = 'table' AND name = ?`,
    )
    .get(table) as { ok: number } | undefined;
  return row != null;
}

function tableColumns(db: Database.Database, table: string, schema = 'main'): string[] {
  return (
    db.prepare(`PRAGMA ${escapeSqlIdent(schema)}.table_info(${escapeSqlIdent(table)})`).all() as {
      name: string;
    }[]
  ).map((column) => column.name);
}

function commonColumns(dest: Database.Database, table: string): string[] {
  if (!tableExists(dest, table, 'codex') || !tableExists(dest, table, 'main')) {
    return [];
  }
  const sourceCols = new Set(tableColumns(dest, table, 'codex'));
  return tableColumns(dest, table, 'main').filter((column) => sourceCols.has(column));
}

function copyImageTree(
  fromRoot: string,
  toRoot: string,
  onLog?: CatalogSyncLogFn,
): { copied: number; skipped: number } {
  if (!fs.existsSync(fromRoot)) {
    onLog?.(`Codex images dir missing at ${fromRoot}; skipping image copy.`, 'info');
    return { copied: 0, skipped: 0 };
  }

  let copied = 0;
  let skipped = 0;

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fromPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fromPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(fromRoot, fromPath);
      const toPath = path.join(toRoot, relative);
      fs.mkdirSync(path.dirname(toPath), { recursive: true });
      try {
        const fromStat = fs.statSync(fromPath);
        if (fs.existsSync(toPath)) {
          const toStat = fs.statSync(toPath);
          if (toStat.size === fromStat.size && toStat.mtimeMs >= fromStat.mtimeMs) {
            skipped += 1;
            continue;
          }
        }
        fs.copyFileSync(fromPath, toPath);
        copied += 1;
      } catch (error) {
        onLog?.(
          `Failed to copy image ${relative}: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        );
      }
    }
  };

  onLog?.(`Copying images from ${fromRoot} → ${toRoot}…`);
  walk(fromRoot);
  onLog?.(`Images: copied ${copied}, skipped ${skipped} (already up to date).`);
  return { copied, skipped };
}

export function syncCodexWarframeCatalog(options?: {
  onLog?: CatalogSyncLogFn;
}): CatalogSyncSummary {
  const onLog = options?.onLog;
  const sourcePath = CODEX_WARFRAME_CATALOG_DB_PATH;

  if (!fs.existsSync(sourcePath)) {
    throw Object.assign(new Error(`Codex Warframe catalog not found at ${sourcePath}`), {
      status: 503,
    });
  }

  onLog?.(`Opening Codex catalog (readonly): ${sourcePath}`);
  const dest = getCatalogDb();
  const attachAlias = 'codex';

  const escapedPath = sourcePath.replace(/'/g, "''");
  dest.exec(`ATTACH DATABASE '${escapedPath}' AS ${attachAlias}`);

  const tables: Record<string, number> = {};

  try {
    const syncTx = dest.transaction(() => {
      dest.exec('PRAGMA foreign_keys = OFF');
      try {
        for (const table of [...CODEX_CATALOG_TABLES].reverse()) {
          if (SKIP_TABLES.has(table)) continue;
          if (!tableExists(dest, table, 'main')) {
            onLog?.(`Skip ${table}: missing on Armory side.`);
            continue;
          }
          const deleted = (
            dest.prepare(`SELECT COUNT(*) AS c FROM main.${escapeSqlIdent(table)}`).get() as {
              c: number;
            }
          ).c;
          dest.prepare(`DELETE FROM main.${escapeSqlIdent(table)}`).run();
          if (deleted > 0) {
            onLog?.(`Cleared ${table} (${deleted} row(s)).`);
          }
        }

        for (const table of CODEX_CATALOG_TABLES) {
          if (SKIP_TABLES.has(table)) continue;
          if (!tableExists(dest, table, 'main')) {
            tables[table] = 0;
            continue;
          }
          if (!tableExists(dest, table, attachAlias)) {
            onLog?.(`Skip ${table}: missing in Codex catalog.`);
            tables[table] = 0;
            continue;
          }

          const columns = commonColumns(dest, table);
          if (columns.length === 0) {
            onLog?.(`Skip ${table}: no overlapping columns.`);
            tables[table] = 0;
            continue;
          }

          const colList = columns.map(escapeSqlIdent).join(', ');
          dest
            .prepare(
              `INSERT INTO main.${escapeSqlIdent(table)} (${colList})
               SELECT ${colList} FROM ${attachAlias}.${escapeSqlIdent(table)}`,
            )
            .run();
          const count = (
            dest.prepare(`SELECT COUNT(*) AS c FROM main.${escapeSqlIdent(table)}`).get() as {
              c: number;
            }
          ).c;
          tables[table] = count;
          onLog?.(`Synced ${table}: ${count} row(s).`);
        }
      } finally {
        dest.exec('PRAGMA foreign_keys = ON');
      }
    });
    syncTx();
  } finally {
    dest.exec(`DETACH DATABASE ${attachAlias}`);
  }

  const imageResult = copyImageTree(CODEX_WARFRAME_IMAGES_DIR, IMAGES_DIR, onLog);

  return {
    tables,
    imagesCopied: imageResult.copied,
    imagesSkipped: imageResult.skipped,
    sourceDb: sourcePath,
    imagesSource: CODEX_WARFRAME_IMAGES_DIR,
  };
}

export function catalogWarframeCount(db: Database.Database = getCatalogDb()): number {
  if (!tableExists(db, 'warframes')) return 0;
  return (db.prepare('SELECT COUNT(*) AS c FROM warframes').get() as { c: number }).c;
}

export function codexCatalogDbExists(): boolean {
  return fs.existsSync(CODEX_WARFRAME_CATALOG_DB_PATH);
}
