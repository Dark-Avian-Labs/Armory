function readTrimmedEnv(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export const APP_DISPLAY_NAME = readTrimmedEnv(
  import.meta.env.VITE_APP_NAME as string | undefined,
  'Parametric',
);

export const LEGAL_ENTITY_NAME = readTrimmedEnv(
  import.meta.env.VITE_LEGAL_ENTITY_NAME as string | undefined,
  'Dark Avian Labs',
);

export const LEGAL_PAGE_URL = readTrimmedEnv(
  import.meta.env.VITE_LEGAL_PAGE_URL as string | undefined,
  '/auth/legal',
);

export const AUTH_PROFILE_URL = readTrimmedEnv(
  import.meta.env.VITE_AUTH_PROFILE_URL as string | undefined,
  '/auth/profile',
);
