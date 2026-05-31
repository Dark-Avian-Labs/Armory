import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { get } from 'cuimp';

const execFileAsync = promisify(execFile);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const urls = [
  'https://overframe.gg/build/new/warframes/',
  'https://overframe.gg/build/new/42/ash/',
  'https://overframe.gg/_next/data/next-d4bb8a07efee4e8386ba8ec43b9ef70452c06e63/build/new/warframes.json',
];

async function tryLabel(label, fn) {
  try {
    const { status, body, headers } = await fn();
    const text = typeof body === 'string' ? body : (body?.toString?.() ?? '');
    const linkCount = (text.match(/\/build\/new\/\d+/g) ?? []).length;
    const hasNextData = text.includes('__NEXT_DATA__') || text.includes('"pageProps"');
    console.log(
      `[${label}] status=${status} len=${text.length} links=${linkCount} nextData=${hasNextData}`,
    );
    return status;
  } catch (err) {
    console.log(`[${label}] ERROR:`, err instanceof Error ? err.message : err);
    return null;
  }
}

console.log('=== Node fetch (baseline) ===');
for (const url of urls) {
  await tryLabel('node-fetch', async () => {
    const res = await fetch(url);
    return { status: res.status, body: await res.text() };
  });
}

console.log('\n=== System curl ===');
for (const url of urls) {
  await tryLabel('curl', async () => {
    const { stdout } = await execFileAsync('curl.exe', ['-s', '-A', UA, url]);
    return { status: stdout.includes('Attention Required') ? 403 : 200, body: stdout };
  });
}

console.log('\n=== cuimp (curl-impersonate) ===');
for (const url of urls) {
  await tryLabel('cuimp', async () => {
    const res = await get(url, { timeout: 15000 });
    return { status: res.status, body: res.data };
  });
}
