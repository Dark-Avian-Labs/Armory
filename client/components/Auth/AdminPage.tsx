import { useState } from 'react';

import { useApi } from '../../hooks/useApi';
import { apiFetch } from '../../utils/api';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ShardBuff {
  id: number;
  shard_type_id: string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
}

interface ShardType {
  id: string;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  buffs: ShardBuff[];
}

export function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="glass-shell page-hero">
        <div className="page-hero__eyebrow">Admin</div>
        <h1 className="page-hero__title text-[2.2rem]">Control panel</h1>
        <p className="page-hero__body">
          Manage shard configuration and keep tuning data aligned with the
          builder experience.
        </p>
      </div>
      <ArchonShardAdmin />
    </div>
  );
}

function ArchonShardAdmin() {
  const { data, loading, error, refetch } = useApi<{ shards: ShardType[] }>(
    '/api/archon-shards',
  );
  const shards = data?.shards || [];
  const [editingBuff, setEditingBuff] = useState<ShardBuff | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const handleApiCall = async (
    apiCall: () => Promise<Response>,
    successMessage: string,
    failureMessage: string,
  ) => {
    try {
      const response = await apiCall();
      if (!response.ok) {
        throw new Error(failureMessage);
      }
      setStatusMessage(successMessage);
      setErrorMessage(null);
      refetch();
      return true;
    } catch {
      setStatusMessage(null);
      setErrorMessage(failureMessage);
      return false;
    }
  };

  const handleSaveBuff = async () => {
    if (!editingBuff) return;
    const didSave = await handleApiCall(
      () =>
        apiFetch(`/api/archon-shards/buffs/${editingBuff.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingBuff),
        }),
      'Shard buff saved.',
      'Failed to save shard buff.',
    );
    if (didSave) {
      setEditingBuff(null);
    }
  };

  const closeDeleteConfirm = () => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const handleDeleteBuff = (id: number) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDeleteBuff = async () => {
    if (pendingDeleteId == null) return;
    const didDelete = await handleApiCall(
      () =>
        apiFetch(`/api/archon-shards/buffs/${pendingDeleteId}`, {
          method: 'DELETE',
        }),
      'Shard buff deleted.',
      'Failed to delete shard buff.',
    );
    if (didDelete) {
      closeDeleteConfirm();
    }
  };

  const handleAddBuff = async (shardTypeId: string) => {
    await handleApiCall(
      () =>
        apiFetch('/api/archon-shards/buffs', {
          method: 'POST',
          body: JSON.stringify({
            shard_type_id: shardTypeId,
            description: 'New Buff',
            base_value: 0,
            tauforged_value: 0,
            value_format: '%',
            sort_order: 99,
          }),
        }),
      'Shard buff added.',
      'Failed to add shard buff.',
    );
  };

  return (
    <>
      <div className="glass-surface p-6">
        <div className="panel-header panel-header--soft px-0 pt-0">
          <div className="panel-header__copy">
            <p className="panel-header__meta">Configuration</p>
            <h2 className="panel-header__title">Archon Shards</h2>
          </div>
        </div>
        <p className="surface-note mb-4">
          Edit shard types and their buff values.
        </p>
        {statusMessage ? (
          <p className="success-msg mb-3" role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage || error ? (
          <p className="error-msg mb-3" role="alert" aria-live="assertive">
            {errorMessage || error}
          </p>
        ) : null}
        {loading ? (
          <p
            className="mb-3 text-sm text-muted"
            role="status"
            aria-live="polite"
          >
            Loading archon shard configuration...
          </p>
        ) : null}

        <div className="space-y-4">
          {shards.map((shard) => (
            <div key={shard.id} className="glass-shell p-4">
              <div className="mb-3 flex items-center gap-3">
                <img
                  src={shard.icon_path}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
                <span className="text-base font-semibold text-foreground">
                  {shard.name}
                </span>
              </div>
              <div className="space-y-1">
                {shard.buffs.map((buff) => (
                  <div
                    key={buff.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    {editingBuff?.id === buff.id ? (
                      <>
                        <input
                          type="text"
                          aria-label={`Description for ${shard.name} buff`}
                          value={editingBuff.description}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              description: e.target.value,
                            })
                          }
                          className="form-input flex-1 text-xs"
                        />
                        <input
                          type="number"
                          aria-label={`Base value for ${shard.name} buff`}
                          value={editingBuff.base_value}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              base_value: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="form-input w-16 text-xs"
                          step="0.1"
                        />
                        <input
                          type="number"
                          aria-label={`Tauforged value for ${shard.name} buff`}
                          value={editingBuff.tauforged_value}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              tauforged_value: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="form-input w-16 text-xs"
                          step="0.1"
                        />
                        <select
                          aria-label={`Value format for ${shard.name} buff`}
                          value={editingBuff.value_format}
                          onChange={(e) =>
                            setEditingBuff({
                              ...editingBuff,
                              value_format: e.target.value,
                            })
                          }
                          className="form-input w-16 text-xs"
                        >
                          <option value="%">%</option>
                          <option value="+flat">+flat</option>
                          <option value="/s">/s</option>
                          <option value="proc">proc</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleSaveBuff}
                          className="text-success hover:text-success/80"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBuff(null)}
                          className="text-muted hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-muted">
                          {buff.description}
                        </span>
                        <span className="w-16 text-center text-foreground">
                          {buff.base_value}
                        </span>
                        <span className="w-16 text-center text-warning">
                          {buff.tauforged_value}
                        </span>
                        <span className="w-10 text-center text-muted/50">
                          {buff.value_format}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingBuff({ ...buff })}
                          className="text-accent hover:text-accent/80"
                          aria-label={`Edit buff ${buff.description}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBuff(buff.id)}
                          className="text-danger hover:text-danger/80"
                          aria-label={`Delete buff ${buff.description}`}
                        >
                          &times;
                        </button>
                      </>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddBuff(shard.id)}
                  className="mt-1 text-xs text-accent hover:text-accent/80"
                  aria-label={`Add buff for ${shard.name}`}
                >
                  + Add buff
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Delete shard buff?"
        message="This will permanently remove the selected buff."
        confirmLabel="Delete"
        onConfirm={() => {
          void handleConfirmDeleteBuff();
        }}
        onCancel={closeDeleteConfirm}
      />
    </>
  );
}
