import type { ReactNode } from 'react';

export function linkifyPlainText(text: string): ReactNode[] {
  if (!text) return [];
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const raw = m[0];
    let urlCore = raw;
    while (urlCore.length > 0 && /[.,:;?!]$/.test(urlCore)) {
      urlCore = urlCore.slice(0, -1);
    }
    const trailingPunct = raw.slice(urlCore.length);
    if (urlCore.length > 0) {
      nodes.push(
        <a
          key={`u-${key++}`}
          href={urlCore}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent decoration-accent/40 hover:decoration-accent underline underline-offset-2"
        >
          {urlCore}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>,
      );
    } else {
      nodes.push(raw);
    }
    if (trailingPunct.length > 0) {
      nodes.push(trailingPunct);
    }
    last = m.index + raw.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes.length > 0 ? nodes : [text];
}
