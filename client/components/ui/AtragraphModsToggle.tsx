import { useTheme } from '../../context/ThemeContext';
import { MaterialSymbol } from './MaterialSymbol';

export function AtragraphModsToggle() {
  const { atragraphModsEnabled, toggleAtragraphMods } = useTheme();

  return (
    <div
      className="user-menu-appearance"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="user-menu-toggle-row"
        role="menuitemcheckbox"
        aria-checked={atragraphModsEnabled}
        onClick={toggleAtragraphMods}
      >
        <span className="user-menu-appearance-label mb-0">Atragraph Mods</span>
        <span className="user-menu-toggle-indicator" aria-hidden="true">
          {atragraphModsEnabled ? <MaterialSymbol name="check" style={{ fontSize: 18 }} /> : null}
        </span>
      </button>
    </div>
  );
}
