import { describe, expect, it } from 'vitest';
import { inboxFlag } from '../inbox-flag';

describe('inbox flags', () => {
  it('keeps legacy false archive and delete flags out of the active filters', () => {
    expect([false, 0, '0', 'false', undefined].map(inboxFlag)).toEqual([false, false, false, false, false]);
  });

  it('keeps explicitly archived or deleted threads out of All', () => {
    expect([true, 1, '1', 'true'].map(inboxFlag)).toEqual([true, true, true, true]);
  });
});
