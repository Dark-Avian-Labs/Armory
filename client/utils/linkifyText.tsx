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
    const href = m[0];
    nodes.push(
      <a
        key={`u-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent decoration-accent/40 hover:decoration-accent underline underline-offset-2"
      >
        {href}
      </a>,
    );
    last = m.index + href.length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes.length > 0 ? nodes : [text];
}
