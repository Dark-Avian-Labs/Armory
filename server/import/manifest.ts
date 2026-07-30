import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { MANIFEST_URL, EXPORTS_DIR } from '../config.js';
import {
  FETCH_BYTE_LIMITS,
  FETCH_TIMEOUT_MS,
  fetchBounded,
  isAbortError,
} from '../http/fetchWithTimeout.js';

const require = createRequire(import.meta.url);
const { LZMA } = require('lzma');
const lzmaWorker = LZMA();

export interface ManifestEntry {
  category: string;
  fullFilename: string;
  hash: string;
}

export async function downloadAndParseManifest(): Promise<ManifestEntry[]> {
  console.log(`[Import] Downloading manifest from ${MANIFEST_URL}`);

  let response: Response;
  let compressedBuffer: Buffer;
  try {
    const result = await fetchBounded(
      MANIFEST_URL,
      {},
      FETCH_TIMEOUT_MS.manifest,
      FETCH_BYTE_LIMITS.manifest,
    );
    response = result.response;
    compressedBuffer = result.body;
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new Error(`Manifest fetch timed out after ${FETCH_TIMEOUT_MS.manifest}ms`);
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Failed to download manifest: ${response.status} ${response.statusText}`);
  }

  console.log(`[Import] Downloaded ${compressedBuffer.length} bytes, decompressing...`);

  const text = await decompressLzma(compressedBuffer);

  const manifestPath = path.join(EXPORTS_DIR, 'manifest.txt');
  fs.writeFileSync(manifestPath, text, 'utf-8');
  console.log(`[Import] Manifest saved to ${manifestPath}`);

  return parseManifestText(text);
}

function decompressLzma(compressed: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const byteArray = Array.from(compressed);
    lzmaWorker.decompress(byteArray, (result: string | null, error?: Error | string) => {
      if (error) {
        reject(typeof error === 'string' ? new Error(error) : error);
      } else if (result !== null) {
        resolve(result);
      } else {
        reject(new Error('LZMA decompression returned null'));
      }
    });
  });
}

export function parseManifestText(text: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bangIndex = trimmed.indexOf('!');
    if (bangIndex === -1) continue;

    const filename = trimmed.substring(0, bangIndex);
    const hash = trimmed.substring(bangIndex + 1);

    const dotIndex = filename.indexOf('.');
    const category = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;

    entries.push({
      category,
      fullFilename: trimmed,
      hash,
    });
  }

  console.log(`[Import] Parsed ${entries.length} manifest entries`);
  return entries;
}
