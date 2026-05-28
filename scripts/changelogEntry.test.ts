import { describe, expect, it } from 'vitest';

import {
  formatChangelogLine,
  normalizeDescription,
  parseBranchName,
  parseMergeCommitMessage,
} from './changelogEntry.mjs';

const REPO = 'Dark-Avian-Labs/Armory';

describe('parseBranchName', () => {
  it('parses type--description branches', () => {
    expect(parseBranchName('feat--integrate-Clerk-for-authentication-and-user-management')).toEqual({
      typeLabel: 'feat',
      description: 'integrate Clerk for authentication and user management',
    });
  });

  it('parses type(scope)--description branches', () => {
    expect(parseBranchName('fix(security)--adding-override-for-js-cookie')).toEqual({
      typeLabel: 'fix(security)',
      description: 'adding override for js cookie',
    });
  });
});

describe('parseMergeCommitMessage', () => {
  it('parses GitHub merge commits with colon branch refs', () => {
    expect(
      parseMergeCommitMessage(
        'Merge pull request #292 from Dark-Avian-Labs:fix(security)--adding-override-for-js-cookie',
      ),
    ).toEqual({
      typeLabel: 'fix(security)',
      description: 'adding override for js cookie',
      prNumber: '292',
    });
  });

  it('parses GitHub merge commits with slash branch refs', () => {
    expect(parseMergeCommitMessage('Merge pull request #286 from Dark-Avian-Labs/fix--routing')).toEqual({
      typeLabel: 'fix',
      description: 'routing',
      prNumber: '286',
    });
  });

  it('parses conventional squash commits with trailing PR numbers', () => {
    expect(parseMergeCommitMessage('feat(ModBuilder): enhance navigation handling (#257)')).toEqual({
      typeLabel: 'feat(ModBuilder)',
      description: 'enhance navigation handling',
      prNumber: '257',
    });
  });

  it('strips no-review markers from descriptions', () => {
    expect(parseMergeCommitMessage('chore: update deps no-review (#10)')).toEqual({
      typeLabel: 'chore',
      description: 'update deps',
      prNumber: '10',
    });
  });
});

describe('normalizeDescription', () => {
  it('strips no-reivew marker (misspelled)', () => {
    expect(normalizeDescription('update deps no-reivew')).toBe('update deps');
  });

  it('strips NCRR marker', () => {
    expect(normalizeDescription('update deps NCRR')).toBe('update deps');
  });
});

describe('formatChangelogLine', () => {
  it('matches the backfilled changelog entry format', () => {
    expect(
      formatChangelogLine({
        version: '1.55.5',
        typeLabel: 'fix(security)',
        description: 'adding override for js cookie',
        prNumber: '292',
        repository: REPO,
      }),
    ).toBe(
      '- **v1.55.5** `fix(security)` [#292](https://github.com/Dark-Avian-Labs/Armory/pull/292): adding override for js cookie',
    );
  });
});
