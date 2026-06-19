import {
  getSiriusOrionFormByUniqueName,
  SIRIUS_ORION_FORMS,
  SIRIUS_ORION_PICKER_LABEL,
} from '../../../shared/siriusOrionRegistry.js';

interface SiriusOrionFormToggleProps {
  activeUniqueName: string;
  disabled?: boolean;
  onSelectForm: (uniqueName: string) => void;
}

export function SiriusOrionFormToggle({
  activeUniqueName,
  disabled = false,
  onSelectForm,
}: SiriusOrionFormToggleProps) {
  const activeForm = getSiriusOrionFormByUniqueName(activeUniqueName);
  if (!activeForm) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-muted text-[10px] font-semibold tracking-wider uppercase">
        {SIRIUS_ORION_PICKER_LABEL}
      </div>
      <div
        className="border-glass-border bg-glass/30 flex rounded-lg border p-0.5"
        role="group"
        aria-label="Sirius or Orion form"
      >
        {SIRIUS_ORION_FORMS.map((form) => {
          const isActive = form.uniqueName === activeUniqueName;
          return (
            <button
              key={form.id}
              type="button"
              disabled={disabled || isActive}
              aria-pressed={isActive}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:text-foreground hover:bg-glass-hover disabled:hover:text-muted disabled:hover:bg-transparent'
              }`}
              onClick={() => onSelectForm(form.uniqueName)}
            >
              {form.formLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
