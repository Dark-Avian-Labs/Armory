import { useEffect } from 'react';

import { useBuildStorageContext } from '../context/BuildStorageContext';

export function useBuildStorage(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const ctx = useBuildStorageContext();

  useEffect(() => {
    if (!enabled) return;
    void ctx.refresh();
  }, [enabled, ctx.refresh]);

  if (!enabled) {
    return {
      ...ctx,
      builds: [],
      loading: false,
      getBuild: () => undefined,
    };
  }

  return ctx;
}
