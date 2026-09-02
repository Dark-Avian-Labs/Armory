import { UI_STYLES, UI_STYLE_LABELS, useTheme } from '../../context/ThemeContext';
import { SelectDropdown } from './SelectDropdown';

export function UiStyleSelector() {
  const { uiStyle, setUiStyle } = useTheme();

  const options = UI_STYLES.map((style) => ({
    value: style,
    label: UI_STYLE_LABELS[style],
  }));

  return (
    <div
      className="user-menu-appearance"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="user-menu-appearance-label" id="ui-style-select-label">
        UI style
      </span>
      <SelectDropdown
        id="ui-style-select"
        value={uiStyle}
        options={options}
        onChange={(value) => {
          const style = UI_STYLES.find((candidate) => candidate === value);
          if (style) setUiStyle(style);
        }}
        buttonAriaLabel="UI style"
        triggerClassName="user-menu-select-trigger flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
