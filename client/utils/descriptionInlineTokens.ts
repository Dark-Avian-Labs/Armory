export type DescriptionInlineToken =
  | { type: 'text'; value: string }
  | { type: 'mod'; name: string }
  | { type: 'mdLink'; label: string; url: string }
  | { type: 'url'; url: string; trailing: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string };

const INLINE_TOKEN_RE =
  /\[\[([^\]]+)\]\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>"'{}|\\^`[\]]+)|\*([^*\n]+)\*|_([^_\n]+)_/gi;

function trimUrlTrailingPunctuation(raw: string): { core: string; trailing: string } {
  let urlCore = raw;
  while (urlCore.length > 0 && /[.,:;?!]$/.test(urlCore)) {
    urlCore = urlCore.slice(0, -1);
  }
  return { core: urlCore, trailing: raw.slice(urlCore.length) };
}

export function tokenizeDescriptionInline(text: string): DescriptionInlineToken[] {
  if (!text) return [];
  const tokens: DescriptionInlineToken[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_TOKEN_RE.lastIndex = 0;
  while ((match = INLINE_TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', value: text.slice(last, match.index) });
    }
    const modName = match[1];
    const mdLabel = match[2];
    const mdUrl = match[3];
    const bareUrl = match[4];
    const boldText = match[5];
    const italicText = match[6];

    if (modName != null) {
      tokens.push({ type: 'mod', name: modName.trim() });
    } else if (mdLabel != null && mdUrl != null) {
      tokens.push({ type: 'mdLink', label: mdLabel, url: mdUrl });
    } else if (bareUrl != null) {
      const { core, trailing } = trimUrlTrailingPunctuation(bareUrl);
      if (core.length > 0) {
        tokens.push({ type: 'url', url: core, trailing });
      } else {
        tokens.push({ type: 'text', value: bareUrl });
      }
    } else if (boldText != null) {
      tokens.push({ type: 'bold', text: boldText });
    } else if (italicText != null) {
      tokens.push({ type: 'italic', text: italicText });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) });
  }
  return tokens.length > 0 ? tokens : [{ type: 'text', value: text }];
}

export function splitDescriptionLines(text: string): Array<{ headline: boolean; content: string }> {
  return text.split('\n').map((line) => {
    const headlineMatch = /^#\s+(.+)$/.exec(line);
    if (headlineMatch) {
      return { headline: true, content: headlineMatch[1] ?? '' };
    }
    return { headline: false, content: line };
  });
}
