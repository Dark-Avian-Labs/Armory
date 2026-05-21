import type { ReactNode } from 'react';

import { DescriptionModLink } from '../components/Description/DescriptionModLink';
import { splitDescriptionLines, tokenizeDescriptionInline } from './descriptionInlineTokens';

const LINK_CLASS =
  'text-accent decoration-accent/40 hover:decoration-accent underline underline-offset-2';

function renderInlineTokens(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let key = 0;
  for (const token of tokenizeDescriptionInline(text)) {
    switch (token.type) {
      case 'text':
        nodes.push(token.value);
        break;
      case 'mod':
        nodes.push(<DescriptionModLink key={`${keyPrefix}-mod-${key++}`} name={token.name} />);
        break;
      case 'mdLink':
        nodes.push(
          <a
            key={`${keyPrefix}-md-${key++}`}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {token.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>,
        );
        break;
      case 'url':
        nodes.push(
          <a
            key={`${keyPrefix}-url-${key++}`}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {token.url}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>,
        );
        if (token.trailing.length > 0) {
          nodes.push(token.trailing);
        }
        break;
      case 'bold':
        nodes.push(
          <strong key={`${keyPrefix}-b-${key++}`} className="font-semibold text-foreground">
            {renderInlineTokens(token.text, `${keyPrefix}-b${key}`)}
          </strong>,
        );
        break;
      case 'italic':
        nodes.push(
          <em key={`${keyPrefix}-i-${key++}`} className="italic">
            {renderInlineTokens(token.text, `${keyPrefix}-i${key}`)}
          </em>,
        );
        break;
      default:
        break;
    }
  }
  return nodes.length > 0 ? nodes : [text];
}

export function formatDescriptionText(text: string): ReactNode[] {
  if (!text) return [];
  const lines = splitDescriptionLines(text);
  const blocks: ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const { headline, content } = lines[i]!;
    if (headline) {
      blocks.push(
        <h4
          key={`h-${key++}`}
          className="text-foreground mt-2 mb-1 text-base font-semibold first:mt-0"
        >
          {renderInlineTokens(content, `h-${key}`)}
        </h4>,
      );
    } else {
      blocks.push(<span key={`l-${key++}`}>{renderInlineTokens(content, `l-${key}`)}</span>);
    }
    if (i < lines.length - 1) {
      blocks.push('\n');
    }
  }

  return blocks.length > 0 ? blocks : [text];
}
