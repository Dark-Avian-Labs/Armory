import { useEffect, useRef, useState } from 'react';

import type { Mod } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { ModHoverPreview } from '../ModCard/ModCard';

const LINK_CLASS =
  'text-accent decoration-accent/40 hover:decoration-accent cursor-default underline underline-offset-2';

type DescriptionModLinkProps = {
  name: string;
};

export function DescriptionModLink({ name }: DescriptionModLinkProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [mod, setMod] = useState<Mod | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    let alive = true;
    const trimmed = name.trim();
    if (!trimmed) return undefined;

    void (async () => {
      try {
        const qs = new URLSearchParams({ search: trimmed, limit: '30' });
        const res = await apiFetch(`/api/mods?${qs.toString()}`);
        if (!res.ok || !alive) return;
        const body = (await res.json()) as { items?: Mod[] };
        const items = Array.isArray(body.items) ? body.items : [];
        const lower = trimmed.toLowerCase();
        const exact =
          items.find((m) => m.name.trim().toLowerCase() === lower) ??
          items.find((m) => m.unique_name.toLowerCase().endsWith(lower.replace(/\s+/g, ''))) ??
          items[0];
        if (alive && exact) {
          setMod(exact);
        }
      } catch {
        // leave as plain link text
      }
    })();

    return () => {
      alive = false;
    };
  }, [name]);

  return (
    <span
      ref={anchorRef}
      className="relative inline"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={LINK_CLASS} title={mod ? undefined : `Mod: ${name}`}>
        {name}
      </span>
      {mod ? <ModHoverPreview mod={mod} anchorRef={anchorRef} active={hovered} /> : null}
    </span>
  );
}
