import type { GuestDetails } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { editOf, valuesOf } from './guestValues.ts';

function details(more: Partial<GuestDetails> = {}): GuestDetails {
  return {
    id: 'g1',
    fullName: 'Adaeze Okafor',
    group: null,
    email: null,
    mobile: null,
    language: null,
    chosenLanguage: null,
    messageLanguage: null,
    reply: 'noReply',
    repliedAt: null,
    invitation: null,
    companions: [],
    added: { at: '2026-11-01T10:00:00Z', by: null },
    organisationLanguage: 'en',
    ...more,
  };
}

describe('an edited guest as the app saves them', () => {
  it('keeps the Language they opened with when it is left as it was', () => {
    expect(editOf(valuesOf(details({ language: 'fr' }), 'GB'), false).language).toBe('fr');
  });

  it('clears the Language when Not set is chosen', () => {
    const values = { ...valuesOf(details({ language: 'fr' }), 'GB'), language: null };

    expect(editOf(values, false).language).toBeNull();
  });

  it('carries each companion id, and a new one goes without', () => {
    const opened = valuesOf(
      details({
        companions: [
          { id: 'c1', fullName: 'Bo', state: 'held', namedByGuest: false },
          { id: 'c2', fullName: null, state: 'held', namedByGuest: false },
        ],
      }),
      'GB',
    );
    const values = { ...opened, companions: [...opened.companions, { id: null, name: ' Cy ' }] };

    expect(editOf(values, false).companions).toEqual([
      { id: 'c1', fullName: 'Bo' },
      { id: 'c2', fullName: null },
      { id: null, fullName: 'Cy' },
    ]);
  });
});
