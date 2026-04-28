import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectDropdownOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  value: string;
  options: SelectDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  buttonAriaLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

export function SelectDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  id,
  buttonAriaLabel,
  open,
  onOpenChange,
  disabled,
}: SelectDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const el = optionRefs.current[focusedIndex];
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, focusedIndex]);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  const listboxId = id ? `${id}-listbox` : undefined;
  const buttonId = id ? `${id}-button` : undefined;

  const handleListboxKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = options[focusedIndex];
      if (opt) {
        onChange(opt.value);
        onOpenChange(false);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        id={buttonId}
        className="form-input flex w-full cursor-pointer items-center justify-between gap-2 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={buttonAriaLabel ?? placeholder}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onOpenChange(!open);
        }}
        onKeyDown={(e) => {
          if (open && e.key === 'Escape') {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate" title={label}>
          <span className={value ? 'text-foreground' : 'text-muted'}>{label}</span>
        </span>
        <span aria-hidden className="text-muted shrink-0 text-[10px]">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div
          id={listboxId}
          role="listbox"
          onKeyDown={handleListboxKeyDown}
          className="glass-tooltip-surface absolute top-full left-0 z-[110] mt-1 max-h-48 w-full min-w-[12rem] overflow-hidden rounded-xl"
        >
          <div className="custom-scroll max-h-48 overflow-y-auto py-1">
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isFocused = focusedIndex === i;
              return (
                <button
                  key={opt.value === '' ? '__empty__' : opt.value}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  tabIndex={isFocused ? 0 : -1}
                  aria-selected={isSelected}
                  className={`flex w-full px-3 py-2 text-left text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] ${
                    isSelected
                      ? 'bg-accent-weak text-accent'
                      : 'text-foreground hover:bg-glass-hover'
                  } ${isFocused ? 'ring-1 ring-[color-mix(in_oklab,var(--color-accent)_40%,transparent)]' : ''}`}
                  onFocus={() => setFocusedIndex(i)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                    }
                  }}
                  onClick={() => {
                    onChange(opt.value);
                    onOpenChange(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
