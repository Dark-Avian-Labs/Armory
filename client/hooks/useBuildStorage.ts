import { useState, useEffect, useCallback } from 'react';

import type { StoredBuild, BuildConfig, BuildVisibility } from '../types/warframe';
import { apiFetch, UnauthorizedError } from '../utils/api';
import { normalizeRivenConfigMembership } from '../utils/riven';

const LEGACY_STORAGE_KEY = 'parametric_builds';
const MIGRATED_KEY = 'parametric_builds_migrated_v1';
const MIGRATION_MAP_KEY = 'parametric_build_id_map_v1';

function readLegacyBuilds(): StoredBuild[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useBuildStorage() {
  const [builds, setBuilds] = useState<StoredBuild[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<StoredBuild[]> => {
    try {
      const response = await apiFetch('/api/builds');
      if (!response.ok) {
        setBuilds([]);
        return [];
      }
      const body = (await response.json()) as {
        builds?: Array<Record<string, unknown>>;
      };
      const rows = Array.isArray(body.builds) ? body.builds : [];
      const mapped = rows
        .map((row) => {
          const modConfig =
            row.mod_config && typeof row.mod_config === 'object'
              ? (row.mod_config as Partial<StoredBuild>)
              : {};
          return {
            ...(modConfig as BuildConfig),
            id: String(row.id ?? modConfig.id ?? ''),
            name: typeof row.name === 'string' ? row.name : (modConfig.name ?? 'Untitled Build'),
            equipment_type:
              (typeof row.equipment_type === 'string'
                ? row.equipment_type
                : modConfig.equipment_type) ?? 'warframe',
            equipment_unique_name:
              (typeof row.equipment_unique_name === 'string'
                ? row.equipment_unique_name
                : modConfig.equipment_unique_name) ?? '',
            equipment_name: modConfig.equipment_name ?? modConfig.equipment_unique_name ?? '',
            equipment_image:
              typeof modConfig.equipment_image === 'string' ? modConfig.equipment_image : undefined,
            created_at: String(row.created_at ?? new Date().toISOString()),
            updated_at: String(row.updated_at ?? new Date().toISOString()),
            visibility: ((): BuildVisibility | undefined => {
              const v = row.visibility;
              if (v === 'public' || v === 'private' || v === 'unlisted') return v;
              return 'private';
            })(),
          } as StoredBuild;
        })
        .filter((build) => build.id.length > 0);
      setBuilds(mapped);
      return mapped;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        console.error('Failed to refresh builds (unauthorized)', {
          url: error.url,
          status: error.response.status,
        });
      } else {
        console.error('Failed to refresh builds', error);
      }
      setBuilds([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function migrateLegacyBuilds(): Promise<void> {
      if (localStorage.getItem(MIGRATED_KEY) === '1') {
        return;
      }
      const legacyBuilds = readLegacyBuilds();
      if (legacyBuilds.length === 0) {
        localStorage.setItem(MIGRATED_KEY, '1');
        return;
      }
      const idMap: Record<string, string> = {};
      for (const legacyBuild of legacyBuilds) {
        try {
          const payload = {
            name: legacyBuild.name,
            equipment_type: legacyBuild.equipment_type,
            equipment_unique_name: legacyBuild.equipment_unique_name,
            mod_config: legacyBuild,
          };
          const response = await apiFetch('/api/builds', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            continue;
          }
          const body = (await response.json()) as { id?: number | string };
          if (body.id !== undefined && legacyBuild.id) {
            idMap[legacyBuild.id] = String(body.id);
          }
        } catch {
          // ignore
        }
      }
      localStorage.setItem(MIGRATION_MAP_KEY, JSON.stringify(idMap));
      localStorage.setItem(MIGRATED_KEY, '1');
    }

    void (async () => {
      await migrateLegacyBuilds();
      await refresh();
    })();
  }, [refresh]);

  const saveBuild = useCallback(
    async (
      config: BuildConfig,
      equipmentName: string,
      equipmentImage?: string,
      visibility?: BuildVisibility,
    ): Promise<StoredBuild> => {
      const normalizedSlots = config.slots.map((slot) =>
        slot.riven_config
          ? {
              ...slot,
              riven_config: normalizeRivenConfigMembership(slot.riven_config),
            }
          : slot,
      );
      const configWithMeta = {
        ...config,
        slots: normalizedSlots,
        equipment_name: equipmentName,
        equipment_image: equipmentImage,
      };
      const isUpdate = Boolean(config.id);
      const endpoint = isUpdate ? `/api/builds/${config.id}` : '/api/builds';
      const method = isUpdate ? 'PUT' : 'POST';
      const vis: BuildVisibility = visibility ?? (config as StoredBuild).visibility ?? 'private';
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(
          isUpdate
            ? {
                name: configWithMeta.name,
                mod_config: configWithMeta,
                visibility: vis,
              }
            : {
                name: configWithMeta.name,
                equipment_type: configWithMeta.equipment_type,
                equipment_unique_name: configWithMeta.equipment_unique_name,
                mod_config: configWithMeta,
                visibility: vis,
              },
        ),
      });
      if (!response.ok) {
        let message = 'Failed to save build';
        try {
          const body = (await response.json()) as { error?: string };
          if (typeof body.error === 'string' && body.error.trim().length > 0) {
            message = body.error;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      let savedId = config.id;
      let body: { id?: string | number } | null = null;
      try {
        body = (await response.json()) as { id?: string | number };
      } catch {
        body = null;
      }
      if (!isUpdate && body) {
        savedId = body.id !== undefined ? String(body.id) : undefined;
      }
      const refreshedBuilds = await refresh();
      const saved = refreshedBuilds.find((build) => build.id === savedId);
      if (saved) {
        return saved;
      }
      if (!savedId) {
        throw new Error(
          'Save succeeded but no build id returned from server; cannot construct StoredBuild',
        );
      }
      return {
        ...configWithMeta,
        id: savedId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as StoredBuild;
    },
    [refresh],
  );

  const deleteBuild = useCallback(
    async (id: string) => {
      const response = await apiFetch(`/api/builds/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        let message = 'Failed to delete build';
        try {
          const body = (await response.json()) as { error?: string };
          if (typeof body.error === 'string' && body.error.trim().length > 0) {
            message = body.error;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      await refresh();
    },
    [refresh],
  );

  const getBuild = useCallback(
    (id: string): StoredBuild | undefined => {
      return builds.find((build) => build.id === id);
    },
    [builds],
  );

  const copyBuildFromId = useCallback(
    async (sourceId: string, name: string): Promise<string> => {
      const response = await apiFetch(`/api/builds/${sourceId}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        let message = 'Failed to copy build';
        try {
          const body = (await response.json()) as { error?: string };
          if (typeof body.error === 'string' && body.error.trim().length > 0) {
            message = body.error;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const body = (await response.json()) as { id?: number | string };
      const newId = body.id !== undefined ? String(body.id) : '';
      if (!newId) {
        throw new Error('Copy succeeded but no id returned');
      }
      await refresh();
      return newId;
    },
    [refresh],
  );

  return { builds, loading, saveBuild, deleteBuild, getBuild, refresh, copyBuildFromId };
}
