import { useState } from 'react';

import type { EquipmentType } from '../../types/warframe';
import { EquipmentGridModal } from '../Layout/EquipmentGridModal';
import { ArtifactSlotsEditorModal } from './ArtifactSlotsEditorModal';

type EditorTarget = {
  equipmentType: EquipmentType;
  uniqueName: string;
  displayName: string;
};

export function ArtifactSlotsAdminTool() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  return (
    <div className="glass-surface space-y-3 p-4">
      <div>
        <h3 className="text-foreground text-sm font-semibold">Artifact slots &amp; polarity</h3>
        <p className="text-muted mt-1 text-xs">
          Manual editor for warframes, weapons, and companions when DE/Overframe data is wrong or
          missing. Does not contact Overframe.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-secondary text-sm"
        onClick={() => setPickerOpen(true)}
      >
        Edit slots / polarity
      </button>

      {pickerOpen ? (
        <EquipmentGridModal
          onClose={() => setPickerOpen(false)}
          onSelect={(equipmentType, uniqueName, displayName) => {
            setPickerOpen(false);
            setEditor({
              equipmentType: equipmentType as EquipmentType,
              uniqueName,
              displayName: displayName ?? uniqueName,
            });
          }}
        />
      ) : null}

      {editor ? (
        <ArtifactSlotsEditorModal
          equipmentType={editor.equipmentType}
          uniqueName={editor.uniqueName}
          displayName={editor.displayName}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </div>
  );
}
