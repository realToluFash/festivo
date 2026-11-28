import type { StaffEntry } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import { removalLine } from './notices.ts';

const t = i18next.getFixedT('en');

function person(more: Partial<StaffEntry> = {}): StaffEntry {
  return {
    id: 'st_1',
    fullName: 'Tope Bello',
    briefing: 'sent',
    inApp: true,
    notice: null,
    ...more,
  } as StaffEntry;
}

describe('the removal question’s added line (sc-4333)', () => {
  const line =
    'Tope Bello gets one last message within 15 minutes to say so, and nothing after that.';

  it('is there only once their briefing went and a push reaches them, before the event is Finished', () => {
    expect(removalLine(person(), false, t)).toBe(line);
    expect(removalLine(person({ briefing: 'read' }), false, t)).toBe(line);
    expect(removalLine(person({ briefing: 'changed' }), false, t)).toBe(line);
    expect(removalLine(person({ briefing: 'none' }), false, t)).toBeNull();
    expect(removalLine(person({ inApp: false }), false, t)).toBeNull();
    expect(removalLine(person(), true, t)).toBeNull();
  });
});
