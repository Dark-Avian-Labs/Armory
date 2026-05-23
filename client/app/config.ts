function readTrimmedEnv(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export const APP_DISPLAY_NAME = readTrimmedEnv(
  import.meta.env.VITE_APP_NAME as string | undefined,
  'Armory',
);

export const LEGAL_ENTITY_NAME = readTrimmedEnv(
  import.meta.env.VITE_LEGAL_ENTITY_NAME as string | undefined,
  'Dark Avian Labs',
);

export const LEGAL_PAGE_URL = readTrimmedEnv(
  import.meta.env.VITE_LEGAL_PAGE_URL as string | undefined,
  'https://darkavianlabs.com/legal/',
);

export const APP_VERSION = readTrimmedEnv(
  import.meta.env.VITE_APP_VERSION as string | undefined,
  'dev',
);

export const APP_ID = readTrimmedEnv(
  import.meta.env.VITE_APP_ID as string | undefined,
  'armory',
).toLowerCase();
