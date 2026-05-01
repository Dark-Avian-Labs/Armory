import fs from 'fs';
import path from 'path';

import { IMAGE_BASE_URL, IMAGES_DIR, EXPORTS_DIR } from '../config.js';
import { getDb } from '../db/connection.js';
import { FETCH_TIMEOUT_MS, fetchWithTimeout, isAbortError } from '../http/fetchWithTimeout.js';

export interface ImageDownloadResult {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface ManifestImageEntry {
  uniqueName: string;
  textureLocation: string;
}

const CONCURRENCY = 15;

export function collectDbUniqueNames(): Set<string> {
  const db = getDb();
  const names = new Set<string>();

  const tables = ['warframes', 'weapons', 'companions', 'mods', 'arcanes', 'abilities'];
  for (const table of tables) {
    const rows = db.prepare(`SELECT unique_name FROM ${table}`).all() as {
      unique_name: string;
    }[];
    for (const row of rows) {
      names.add(row.unique_name);
    }
  }

  return names;
}

function loadManifest(): Map<string, ManifestImageEntry> {
  let manifestPath = path.join(EXPORTS_DIR, 'ExportManifest.json');
  if (!fs.existsSync(manifestPath)) {
    manifestPath = path.join(EXPORTS_DIR, 'ExportManifest_en.json');
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error('ExportManifest not found. Run the import pipeline first.');
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const entries: ManifestImageEntry[] = raw.Manifest || [];

  const map = new Map<string, ManifestImageEntry>();
  for (const entry of entries) {
    map.set(entry.uniqueName, entry);
  }
  return map;
}

function getImagePaths(entry: ManifestImageEntry): {
  localPath: string;
  localDir: string;
  hash: string;
  hashPath: string;
  dbImagePath: string;
  ext: string;
} {
  const { textureLocation, uniqueName } = entry;

  const bangIndex = textureLocation.indexOf('!');
  const hash = bangIndex !== -1 ? textureLocation.substring(bangIndex + 1) : '';

  const safeName = uniqueName.replace(/^\//, '').replace(/[<>:"|?*]/g, '_');
  const ext = path.extname(textureLocation.split('!')[0]) || '.png';
  const localPath = path.join(IMAGES_DIR, safeName + ext);
  const localDir = path.dirname(localPath);
  const hashPath = `${localPath}.hash`;

  const dbImagePath = `/${safeName.replace(/\\/g, '/')}${ext}`;

  return { localPath, localDir, hash, hashPath, dbImagePath, ext };
}

async function downloadSingleImage(
  entry: ManifestImageEntry,
  forceDownload = false,
): Promise<{ dbImagePath: string; status: 'downloaded' | 'skipped' } | { error: string }> {
  const { textureLocation } = entry;
  const { localPath, localDir, hash, hashPath, dbImagePath } = getImagePaths(entry);

  if (!forceDownload && hash && fs.existsSync(localPath) && fs.existsSync(hashPath)) {
    const existingHash = fs.readFileSync(hashPath, 'utf-8').trim();
    if (existingHash === hash) {
      return { dbImagePath, status: 'skipped' };
    }
  }

  const url = `${IMAGE_BASE_URL}${textureLocation}`;
  try {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, {}, FETCH_TIMEOUT_MS.binaryImage);
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw new Error(`Image fetch timed out after ${FETCH_TIMEOUT_MS.binaryImage}ms`);
      }
      throw error;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    fs.writeFileSync(localPath, buffer);
    if (hash) {
      fs.writeFileSync(hashPath, hash, 'utf-8');
    }

    return { dbImagePath, status: 'downloaded' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `${entry.uniqueName}: ${msg}` };
  }
}

export async function downloadImages(
  onProgress?: (completed: number, total: number, latest: string) => void,
  forceDownload = false,
): Promise<ImageDownloadResult> {
  const dbNames = collectDbUniqueNames();

  const manifest = loadManifest();
  const toDownload: ManifestImageEntry[] = [];
  for (const name of dbNames) {
    const entry = manifest.get(name);
    if (entry && entry.textureLocation) {
      toDownload.push(entry);
    }
  }

  const result: ImageDownloadResult = {
    total: toDownload.length,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const imagePathMap = new Map<string, string>();
  let completed = 0;

  for (let i = 0; i < toDownload.length; i += CONCURRENCY) {
    const batch = toDownload.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((entry) => downloadSingleImage(entry, forceDownload)),
    );

    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      const entry = batch[j];
      completed++;

      if ('error' in res) {
        result.failed++;
        result.errors.push(res.error);
      } else {
        imagePathMap.set(entry.uniqueName, res.dbImagePath);
        if (res.status === 'downloaded') {
          result.downloaded++;
        } else {
          result.skipped++;
        }
      }
    }

    onProgress?.(completed, toDownload.length, batch[batch.length - 1]?.uniqueName || '');
  }

  updateDbImagePaths(imagePathMap);

  return result;
}

function updateDbImagePaths(pathMap: Map<string, string>): void {
  const db = getDb();
  const tables = ['warframes', 'weapons', 'companions', 'mods', 'arcanes', 'abilities'];

  const stmts = tables.map((table) =>
    db.prepare(`UPDATE ${table} SET image_path = ? WHERE unique_name = ?`),
  );

  const tx = db.transaction(() => {
    for (const [uniqueName, imagePath] of pathMap) {
      for (const stmt of stmts) {
        stmt.run(imagePath, uniqueName);
      }
    }
  });

  tx();
  console.log(`[Images] Updated image_path for ${pathMap.size} items in DB`);
}
