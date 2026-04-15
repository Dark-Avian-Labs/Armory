import { useState, useEffect, useCallback } from 'react';

import { apiFetch } from '../utils/api';
import { getApiErrorDetails } from '../utils/apiErrorUtils';

export interface LoadoutBuild {
  build_id: string;
  slot_type: string;
}

export interface Loadout {
  id: string;
  name: string;
  builds: LoadoutBuild[];
  created_at: string;
  updated_at: string;
}

export const LOADOUT_SLOT_TYPES = [
  { key: 'warframe', label: 'Warframe' },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'melee', label: 'Melee' },
  { key: 'companion', label: 'Companion' },
  { key: 'companion_weapon', label: 'Companion Weapon' },
  { key: 'archwing', label: 'Archwing' },
  { key: 'archgun', label: 'Arch-Gun' },
  { key: 'archmelee', label: 'Arch-Melee' },
] as const;

export function useLoadoutStorage() {
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadoutError, setLoadoutError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<Loadout[]> => {
    try {
      setLoadoutError(null);
      const response = await apiFetch('/api/loadouts');
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        setLoadouts([]);
        setLoadoutError(details);
        return [];
      }
      const body = (await response.json()) as {
        loadouts?: Array<Record<string, unknown>>;
      };
      const rows = Array.isArray(body.loadouts) ? body.loadouts : [];
      const mapped = rows.map((row) => ({
        id: String(row.id ?? ''),
        name: typeof row.name === 'string' ? row.name : 'Loadout',
        builds: Array.isArray(row.builds)
          ? (row.builds as Array<Record<string, unknown>>).map((build) => ({
              build_id: String(build.build_id ?? ''),
              slot_type: String(build.slot_type ?? ''),
            }))
          : [],
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: String(row.updated_at ?? new Date().toISOString()),
      })) as Loadout[];
      const filtered = mapped.filter((loadout) => loadout.id.length > 0);
      setLoadouts(filtered);
      return filtered;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadouts([]);
      setLoadoutError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createLoadout = useCallback(
    async (name: string): Promise<Loadout> => {
      const response = await apiFetch('/api/loadouts', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        throw new Error(`Failed to create loadout: ${details}`);
      }
      const body = (await response.json()) as { id?: string | number };
      if (body.id === undefined || body.id === null) {
        throw new Error(
          'API did not return loadout id; creation failed and cannot sync with server',
        );
      }
      const createdId = String(body.id);
      const loadout: Loadout = {
        id: createdId,
        name,
        builds: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const refreshedLoadouts = await refresh();
      return refreshedLoadouts.find((candidate) => candidate.id === createdId) ?? loadout;
    },
    [refresh],
  );

  const deleteLoadout = useCallback(
    async (id: string) => {
      const response = await apiFetch(`/api/loadouts/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        throw new Error(`Failed to delete loadout ${id}: ${details}`);
      }
      await refresh();
    },
    [refresh],
  );

  const linkBuild = useCallback(
    async (loadoutId: string, buildId: string, slotType: string) => {
      try {
        const response = await apiFetch(`/api/loadouts/${loadoutId}/builds`, {
          method: 'POST',
          body: JSON.stringify({
            build_id: buildId,
            slot_type: slotType,
          }),
        });
        if (!response.ok) {
          const details = await getApiErrorDetails(response);
          throw new Error(
            `Failed to link build ${buildId} to loadout ${loadoutId} (${slotType}): ${details}`,
          );
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`Failed to link build ${buildId} to loadout ${loadoutId} (${slotType})`);
      }
      await refresh();
    },
    [refresh],
  );

  const unlinkBuild = useCallback(
    async (loadoutId: string, slotType: string) => {
      const response = await apiFetch(`/api/loadouts/${loadoutId}/builds/${slotType}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const details = await getApiErrorDetails(response);
        throw new Error(
          `Failed to unlink build from loadout ${loadoutId} (${slotType}): ${details}`,
        );
      }
      await refresh();
    },
    [refresh],
  );

  const getLoadout = useCallback(
    (id: string): Loadout | undefined => {
      return loadouts.find((loadout) => loadout.id === id);
    },
    [loadouts],
  );

  return {
    loadouts,
    loading,
    error: loadoutError,
    createLoadout,
    deleteLoadout,
    linkBuild,
    unlinkBuild,
    getLoadout,
    refresh,
  };
}
