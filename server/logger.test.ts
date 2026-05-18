import { afterEach, describe, expect, it, vi } from 'vitest';

import { log } from './logger.js';

describe('log', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not let caller fields override ts, level, or msg', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    log('info', 'real message', {
      ts: 'spoofed-ts',
      level: 'error',
      msg: 'spoofed-msg',
      requestId: 'abc',
    });

    const parsed = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      ts: string;
      level: string;
      msg: string;
      requestId: string;
    };
    expect(parsed.msg).toBe('real message');
    expect(parsed.level).toBe('info');
    expect(parsed.ts).not.toBe('spoofed-ts');
    expect(parsed.requestId).toBe('abc');
  });
});
