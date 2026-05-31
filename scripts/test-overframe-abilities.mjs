import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const { stdout: html } = await execFileAsync('curl.exe', [
  '-s',
  '-A',
  UA,
  'https://overframe.gg/build/new/42/ash/',
]);
console.log('abilityTooltip count:', (html.match(/abilityTooltip/g) ?? []).length);

const marker = '<script id="__NEXT_DATA__" type="application/json">';
const start = html.indexOf(marker);
const end = html.indexOf('</script>', start);
const nextData = JSON.parse(html.slice(start + marker.length, end));
const data = nextData?.props?.pageProps?.item?.data ?? {};
console.log(
  'NEXT_DATA ability-related keys:',
  Object.keys(data).filter((k) => k.toLowerCase().includes('abilit')),
);
