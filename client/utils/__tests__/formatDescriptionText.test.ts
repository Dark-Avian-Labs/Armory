import { describe, expect, it } from 'vitest';

import { splitDescriptionLines, tokenizeDescriptionInline } from '../descriptionInlineTokens';

describe('descriptionInlineTokens', () => {
  it('tokenizes bare URLs', () => {
    const tokens = tokenizeDescriptionInline('See https://example.com/path.');
    expect(tokens.some((t) => t.type === 'url' && t.url === 'https://example.com/path')).toBe(true);
  });

  it('tokenizes markdown links', () => {
    const tokens = tokenizeDescriptionInline('[Wiki](https://wiki.warframe.com)');
    expect(tokens).toEqual([
      { type: 'mdLink', label: 'Wiki', url: 'https://wiki.warframe.com' },
    ]);
  });

  it('tokenizes bold and italic', () => {
    const tokens = tokenizeDescriptionInline('*bold* and _italic_');
    expect(tokens.some((t) => t.type === 'bold' && t.text === 'bold')).toBe(true);
    expect(tokens.some((t) => t.type === 'italic' && t.text === 'italic')).toBe(true);
  });

  it('tokenizes mod links', () => {
    const tokens = tokenizeDescriptionInline('Use [[Vitality]]');
    expect(tokens).toEqual([
      { type: 'text', value: 'Use ' },
      { type: 'mod', name: 'Vitality' },
    ]);
  });
});

describe('splitDescriptionLines', () => {
  it('detects headline lines', () => {
    const lines = splitDescriptionLines('# Section title\nBody');
    expect(lines[0]).toEqual({ headline: true, content: 'Section title' });
    expect(lines[1]).toEqual({ headline: false, content: 'Body' });
  });
});
