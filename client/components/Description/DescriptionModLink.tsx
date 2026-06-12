import { useEffect, useRef, useState } from 'react';

import type { Mod } from '../../types/warframe';
import { apiFetch } from '../../utils/api';
import { ModHoverPreview } from '../ModCard/ModCard';

const LINK_CLASS =
  'text-accent decoration-accent/40 hover:decoration-accent cursor-default underline underline-offset-2';

const modLookupCache = new Map<string, Promise<Mod | null>>();

function lookupModByName(trimmed: string): Promise<Mod | null> {
  const key = trimmed.toLowerCase();
  const cached = modLookupCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const qs = new URLSearchParams({ search: trimmed, limit: '30' });
    const res = await apiFetch(`/api/mods?${qs.toString()}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: Mod[] };
    const items = Array.isArray(body.items) ? body.items : [];
    const lower = trimmed.toLowerCase();
    const exact =
      items.find((m) => m.name.trim().toLowerCase() === lower) ??
      items.find((m) => m.unique_name.toLowerCase().endsWith(lower.replace(/\s+/g, ''))) ??
      items[0];
    return exact ?? null;
  })().catch(() => {
    modLookupCache.delete(key);
    return null;
  });
  modLookupCache.set(key, promise);
  return promise;
}

type DescriptionModLinkProps = {
  name: string;
};

export function DescriptionModLink({ name }: DescriptionModLinkProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [mod, setMod] = useState<Mod | null>(null);
  const [hovered, setHovered] = useState(false);
  const requestedRef = useRef(false);
  const aliveRef = useRef(true);
  const nameRef = useRef(name);

  useEffect(() => {
    nameRef.current = name;
    requestedRef.current = false;
    setMod(null);
  }, [name]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const handleMouseEnter = (): void => {
    setHovered(true);
    if (requestedRef.current) return;
    requestedRef.current = true;
    const trimmed = name.trim();
    if (!trimmed) return;
    const requestedName = name;
    void lookupModByName(trimmed).then((result) => {
      // Ignore stale responses if the name prop changed mid-flight.
      if (aliveRef.current && nameRef.current === requestedName) {
        setMod(result);
      }
      return undefined;
    });
  };

  return (
    <span
      ref={anchorRef}
      className="relative inline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={LINK_CLASS} title={mod ? undefined : `Mod: ${name}`}>
        {name}
      </span>
      {mod ? <ModHoverPreview mod={mod} anchorRef={anchorRef} active={hovered} /> : null}
    </span>
  );
}
