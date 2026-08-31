import { memo } from 'react';

import { Modal } from '../ui/Modal';

type BuildSaveModalProps = {
  open: boolean;
  isCopy: boolean;
  name: string;
  error: string | null;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export const BuildSaveModal = memo(function BuildSaveModal({
  open,
  isCopy,
  name,
  error,
  onNameChange,
  onClose,
  onConfirm,
}: BuildSaveModalProps) {
  if (!open) return null;

  return (
    <Modal open onClose={onClose} ariaLabelledBy="save-build-title" className="max-w-md">
      <h3 id="save-build-title" className="text-foreground mb-4 text-lg font-semibold">
        {isCopy ? 'Copy Build' : 'Save Build'}
      </h3>
      {error ? <p className="error-msg mb-3">{error}</p> : null}
      <label className="text-muted mb-2 block text-xs tracking-[0.18em] uppercase">
        Build Name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onConfirm();
          }
        }}
        className="form-input mb-4 w-full"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose} type="button">
          Cancel
        </button>
        <button className="btn btn-accent" onClick={onConfirm} type="button">
          {isCopy ? 'Copy' : 'Save'}
        </button>
      </div>
    </Modal>
  );
});
