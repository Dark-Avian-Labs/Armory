import type { AppAccountProfile } from '../auth/types';

const PROFILE_STORAGE_KEY = 'armory.profile.v1';

interface StoredProfile {
  displayName: string;
}

function readProfileStorage(): Record<string, StoredProfile> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const normalized: Record<string, StoredProfile> = {};
    let shouldRewrite = false;
    for (const [userId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') {
        shouldRewrite = true;
        continue;
      }
      const maybeProfile = value as { displayName?: unknown; email?: unknown };
      if (typeof maybeProfile.displayName !== 'string') {
        shouldRewrite = true;
        continue;
      }
      normalized[userId] = { displayName: maybeProfile.displayName };
      if ('email' in maybeProfile) {
        shouldRewrite = true;
      }
    }
    if (shouldRewrite) {
      writeProfileStorage(normalized);
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeProfileStorage(profiles: Record<string, StoredProfile>): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // ignore
  }
}

export function getStoredProfile(userId: number): StoredProfile | undefined {
  return readProfileStorage()[String(userId)];
}

export function mergeStoredProfile(
  profile: AppAccountProfile,
  updates: Partial<Pick<AppAccountProfile, 'displayName' | 'email'>>,
): AppAccountProfile {
  const nextProfile: AppAccountProfile = {
    ...profile,
    ...updates,
  };
  if (nextProfile.userId === null || nextProfile.userId === undefined) {
    return nextProfile;
  }
  const storage = readProfileStorage();
  storage[String(nextProfile.userId)] = {
    displayName: nextProfile.displayName,
  };
  writeProfileStorage(storage);
  return nextProfile;
}
