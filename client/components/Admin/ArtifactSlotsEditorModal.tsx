import { useCallback, useEffect, useState } from 'react';

import {
  EQUIPMENT_SLOT_CONFIGS,
  POLARITIES,
  type EquipmentType,
  type Warframe,
  type Weapon,
  type Companion,
} from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import {
  artifactSlotsFromEditorRows,
  buildArtifactSlotEditorRows,
  cycleArtifactPolarity,
  parseArtifactSlotsJson,
  type ArtifactSlotEditorRow,
} from '../../utils/artifactSlotLayout';
import { CATEGORY_API, type EquipmentPickerTab } from '../BuildsCatalog/buildsCatalogUtils';
import { Modal } from '../ui/Modal';

const POLARITY_ICONS: Record<string, string> = {
  AP_ATTACK: 'madurai',
  AP_DEFENSE: 'vazarin',
  AP_TACTIC: 'naramon',
  AP_WARD: 'unairu',
  AP_POWER: 'zenurik',
  AP_PRECEPT: 'penjaga',
  AP_UMBRA: 'umbra',
  AP_ANY: 'universal',
};

function SlotPolarityIcon({ polarity, size = 24 }: { polarity: string; size?: number }) {
  const iconName = POLARITY_ICONS[polarity];
  if (!iconName) return null;
  return (
    <img
      src={`/icons/polarity/${iconName}.svg`}
      alt={POLARITIES[polarity as keyof typeof POLARITIES] ?? polarity}
      style={{ width: size, height: size, objectFit: 'contain' }}
      draggable={false}
    />
  );
}

function equipmentFetchUrl(equipmentType: EquipmentType): string | null {
  if (equipmentType === 'beast_claws') {
    return '/api/weapons?type=SentinelWeapons';
  }
  const tab = equipmentType as EquipmentPickerTab;
  if (tab === 'companion_weapon') {
    return CATEGORY_API.companion_weapon;
  }
  return CATEGORY_API[tab] || null;
}

type CatalogItem = Warframe | Weapon | Companion;

interface ArtifactSlotsEditorModalProps {
  equipmentType: EquipmentType;
  uniqueName: string;
  displayName: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function ArtifactSlotsEditorModal({
  equipmentType,
  uniqueName,
  displayName,
  onClose,
  onSaved,
}: ArtifactSlotsEditorModalProps) {
  const [rows, setRows] = useState<ArtifactSlotEditorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = EQUIPMENT_SLOT_CONFIGS[equipmentType] ?? EQUIPMENT_SLOT_CONFIGS.warframe;

  useEffect(() => {
    const url = equipmentFetchUrl(equipmentType);
    if (!url) {
      setError('Unsupported equipment type for slot editing.');
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(url);
        const body = (await res.json()) as { items?: CatalogItem[] };
        if (!res.ok) throw new Error('Failed to load equipment catalog.');
        const item = body.items?.find((row) => row.unique_name === uniqueName);
        if (!item) throw new Error('Equipment not found in catalog.');
        const parsed = parseArtifactSlotsJson(item.artifact_slots);
        setRows(buildArtifactSlotEditorRows(equipmentType, parsed, item.name));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load artifact slots.');
      } finally {
        setLoading(false);
      }
    })();
  }, [equipmentType, uniqueName]);

  const polarityLabel = useCallback((polarity: string) => {
    if (polarity === 'AP_UNIVERSAL') return 'Universal';
    return POLARITIES[polarity as keyof typeof POLARITIES] ?? polarity;
  }, []);

  const handleToggle = (id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              enabled: !row.enabled,
              polarity: row.enabled
                ? 'AP_UNIVERSAL'
                : row.polarity === 'AP_UNIVERSAL'
                  ? 'AP_POWER'
                  : row.polarity,
            }
          : row,
      ),
    );
  };

  const handleCyclePolarity = (id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id && row.enabled
          ? { ...row, polarity: cycleArtifactPolarity(row.polarity) }
          : row,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const artifact_slots = artifactSlotsFromEditorRows(equipmentType, rows, displayName);
      const res = await apiFetch('/api/admin/catalog/artifact-slots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unique_name: uniqueName, artifact_slots }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? 'Failed to save artifact slots.');
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="glass-modal-surface artifact-slots-editor-modal max-w-3xl p-6"
      ariaLabelledBy="artifact-slots-editor-title"
    >
      <div className="space-y-4">
        <div>
          <h2 id="artifact-slots-editor-title" className="text-foreground text-lg font-semibold">
            Edit slots / polarity
          </h2>
          <p className="text-muted mt-1 text-sm">
            {displayName} · {equipmentType} · {rows.length} slot(s)
          </p>
        </div>

        {loading ? <p className="text-muted text-sm">Loading slot data…</p> : null}
        {error ? <p className="text-danger text-sm">{error}</p> : null}

        {!loading && rows.length > 0 ? (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))' }}
          >
            {rows.map((row) => (
              <div
                key={row.id}
                className="glass-surface flex flex-col items-center gap-2 rounded-lg p-3"
              >
                <span className="text-muted text-[10px] font-medium tracking-wide uppercase">
                  {row.label}
                </span>
                <button
                  type="button"
                  className={`btn btn-secondary w-full text-xs ${row.enabled ? '' : 'opacity-60'}`}
                  onClick={() => handleToggle(row.id)}
                  aria-pressed={row.enabled}
                >
                  {row.enabled ? 'Slot on' : 'Slot off'}
                </button>
                <button
                  type="button"
                  className={`border-warning/50 flex h-24 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    row.enabled
                      ? 'hover:bg-warning/10 cursor-pointer'
                      : 'cursor-not-allowed opacity-40'
                  }`}
                  onClick={() => handleCyclePolarity(row.id)}
                  disabled={!row.enabled}
                  aria-label={`Cycle polarity for ${row.label}`}
                >
                  {row.enabled && row.polarity !== 'AP_UNIVERSAL' ? (
                    <SlotPolarityIcon polarity={row.polarity} size={28} />
                  ) : (
                    <span className="text-muted/40 text-lg">—</span>
                  )}
                  <span className="text-warning/80 mt-1 text-[9px] font-medium">
                    {polarityLabel(row.polarity)}
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-cancel text-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent text-sm"
            onClick={() => void handleSave()}
            disabled={saving || loading}
          >
            {saving ? 'Saving…' : 'Save slots'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
