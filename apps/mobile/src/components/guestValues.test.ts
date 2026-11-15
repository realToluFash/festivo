import type { GuestDetails } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { NO_NEEDS } from '@soirely/domain';

import { addOf, editOf, valuesOf } from './guestValues.ts';

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
    const values = {
      ...opened,
      companions: [...opened.companions, { id: null, name: ' Cy ', needs: NO_NEEDS }],
    };

    expect(editOf(values, false).companions.map(({ id, fullName }) => ({ id, fullName }))).toEqual([
      { id: 'c1', fullName: 'Bo' },
      { id: 'c2', fullName: null },
      { id: null, fullName: 'Cy' },
    ]);
  });
});

describe('Group and Needs as the app saves them (sc-5519)', () => {
  const work = { id: 'gr1', name: 'Work' };

  it('leaves the group out of an edit that kept it, and sends a change', () => {
    const opened = valuesOf(details({ group: work }), 'GB');

    expect(editOf(opened, false, work)).not.toHaveProperty('group');
    expect(editOf({ ...opened, group: null }, false, work).group).toBeNull();
  });

  it('sends a name made on save with create, so a colleague’s group of that name is refused', () => {
    const values = { ...valuesOf(null, 'GB'), fullName: 'Bisi', group: { name: 'Bride’s side' } };

    expect(addOf(values, false).group).toEqual({ name: 'Bride’s side', create: true });
    expect(addOf({ ...values, group: null }, false)).not.toHaveProperty('group');
  });

  it('sends each person’s needs trimmed, an unticked Other’s words dropped', () => {
    const opened = valuesOf(
      details({
        needs: {
          allergies: ['peanuts'],
          diet: [],
          access: [],
          otherAllergy: null,
          otherDiet: null,
          otherAccess: null,
          note: null,
        },
        companions: [{ id: 'c1', fullName: 'Bo', state: 'held', namedByGuest: false }],
      }),
      'GB',
    );
    const values = {
      ...opened,
      needs: {
        ...opened.needs,
        diet: ['other' as const],
        otherDiet: ' Low salt ',
        otherAccess: 'kept',
      },
    };
    const sent = editOf(values, false);

    expect(sent.needs).toEqual({
      allergies: ['peanuts'],
      diet: ['other'],
      access: [],
      otherAllergy: null,
      otherDiet: 'Low salt',
      otherAccess: null,
      note: null,
    });
    expect(sent.companions[0]?.needs?.allergies).toEqual([]);
  });
});
