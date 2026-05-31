const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const paths = ['/build/new/', '/build/new/warframes/', '/build/new/primary-weapons/'];

for (const path of paths) {
  for (const label of ['no-headers', 'browser-headers']) {
    const init =
      label === 'browser-headers'
        ? { headers: BROWSER_HEADERS, redirect: 'manual' }
        : { redirect: 'manual' };
    const res = await fetch(`https://overframe.gg${path}`, init);
    console.log(`${path} [${label}] -> ${res.status} ${res.headers.get('location') ?? ''}`);
  }
}
