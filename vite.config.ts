import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    const v = pkg.version?.trim();
    return v && v.length > 0 ? v : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appId =
    process.env.VITE_APP_ID?.trim() ||
    process.env.APP_ID?.trim() ||
    env.VITE_APP_ID?.trim() ||
    env.APP_ID?.trim() ||
    'armory';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(readPackageVersion()),
      'import.meta.env.VITE_APP_ID': JSON.stringify(appId),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client'),
      },
    },
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
    },
  };
});
