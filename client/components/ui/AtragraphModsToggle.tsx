import { useTheme } from '../../context/ThemeContext';
import { MaterialSymbol } from './MaterialSymbol';

export function AtragraphModsToggle() {
  const { atragraphModsEnabled, toggleAtragraphMods } = useTheme();

  return (
    <button
      type="button"
      className="user-menu-item flex items-center justify-between gap-2 text-left"
      role="menuitemcheckbox"
      aria-checked={atragraphModsEnabled}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        toggleAtragraphMods();
      }}
    >
      <span>Atragraph mods</span>
      {atragraphModsEnabled ? (
        <MaterialSymbol
          name="check"
          className="text-accent shrink-0"
          style={{ fontSize: 18 }}
          aria-hidden
        />
      ) : null}
    </button>
  );
}
