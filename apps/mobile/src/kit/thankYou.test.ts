import { describe, expect, it } from 'vitest';

import { thankYouCardOf, thankYouSaid } from './thankYou.ts';

describe('thankYouCardOf', () => {
  it('offers Add with no line and Edit with one to a member who can end the event', () => {
    expect(thankYouCardOf(null, true)).toBe('add');
    expect(thankYouCardOf('Thank you.', true)).toBe('edit');
  });

  it('shows the line read-only, and nothing without one, to a member who cannot', () => {
    expect(thankYouCardOf('Thank you.', false)).toBe('readOnly');
    expect(thankYouCardOf(null, false)).toBeNull();
  });
});

describe('thankYouSaid', () => {
  it('says saved for a line and removed for an emptied one', () => {
    expect(thankYouSaid(null, ' Thank you. ')).toBe('thankYou.saved');
    expect(thankYouSaid('Thank you.', 'Thanks again.')).toBe('thankYou.saved');
    expect(thankYouSaid('Thank you.', ' \n ')).toBe('thankYou.removed');
  });

  it('says nothing when nothing was saved over nothing', () => {
    expect(thankYouSaid(null, '   ')).toBeNull();
  });
});
