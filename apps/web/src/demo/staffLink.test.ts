import { describe, expect, it } from 'vitest';

import { NOW_AT, YOU, afterCopy, afterMark, afterReplace, trailLine } from './staffLink.ts';

describe('a staff link’s row (sc-3912)', () => {
  it('says who did what, and when', () => {
    const trail = { by: YOU, at: '18:44' };
    expect(trailLine('copied', trail)).toBe('Copied by Amara Nwosu · 18:44 · not marked as sent');
    expect(trailLine('sent', trail)).toBe('Marked as sent by Amara Nwosu · 18:44');
    expect(trailLine('opened', { by: YOU, at: '19:05' })).toBe('Opened 19:05');
    expect(trailLine('shared', trail)).toBe('Shared by Amara Nwosu · 18:44 · not marked as sent');
    expect(trailLine('none', trail)).toBeNull();
  });

  it('copies No link yet and Copied to Copied by you, now', () => {
    expect(afterCopy('none', null)).toEqual({ link: 'copied', trail: { by: YOU, at: NOW_AT } });
    expect(afterCopy('copied', { by: 'Tobi', at: '17:00' }).trail).toEqual({ by: YOU, at: NOW_AT });
  });

  it('never moves Link sent or Link opened back to Copied', () => {
    const sent = { by: YOU, at: '18:44' };
    expect(afterCopy('sent', sent)).toEqual({ link: 'sent', trail: sent });
    expect(afterCopy('opened', sent)).toEqual({ link: 'opened', trail: sent });
  });

  it('marks as sent, and replaces back to No link yet', () => {
    expect(afterMark()).toEqual({ link: 'sent', trail: { by: YOU, at: NOW_AT } });
    expect(afterReplace()).toEqual({ link: 'none', trail: null });
  });
});
