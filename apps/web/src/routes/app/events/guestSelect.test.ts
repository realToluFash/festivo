import type { Guest } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { lineWords, nothingRemoved, removeQuestion } from './guestSelect.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

const ARRIVAL = { at: '2026-11-21T19:42:00+01:00', by: 'Folake Adeyemi' };

function guest(id: string, fullName: string, more: Partial<Guest> = {}): Guest {
  return {
    id,
    fullName,
    email: null,
    mobile: null,
    reply: 'noReply',
    repliedAt: null,
    invitation: null,
    companions: [],
    ...more,
  } as Guest;
}

const KWAME = guest('g_k', 'Kwame Mensah', { arrival: ARRIVAL });
const ADA = guest('g_a', 'Ada Obi', {
  reply: 'coming',
  companions: [
    {
      id: 'c_1',
      fullName: 'Rui Duarte',
      state: 'coming',
      coming: true,
      namedByGuest: false,
      arrival: ARRIVAL,
    },
  ],
});
const BEN = guest('g_b', 'Ben Cole', {
  reply: 'coming',
  companions: [{ id: 'c_2', fullName: null, state: 'coming', coming: true, namedByGuest: false }],
});

describe('removing many leaves the arrived (sc-1454)', () => {
  it('counts only the guests it will remove, and names each who stays and why', () => {
    const asked = removeQuestion([KWAME, ADA, BEN], new Set(['g_k', 'g_a', 'g_b']));

    expect(asked).toMatchObject({ goes: 1, companions: 1, replied: 1 });
    expect(asked.stays).toEqual([
      { id: 'g_k', fullName: 'Kwame Mensah', why: 'arrived' },
      { id: 'g_a', fullName: 'Ada Obi', why: 'companionArrived' },
    ]);
  });

  it('counts who stayed in the result line, with why', () => {
    const words = lineWords(t, {
      kind: 'removed',
      removed: {
        removal: 'r_1',
        guests: 1,
        companions: 0,
        gone: 0,
        stayed: [{ id: 'g_k', fullName: 'Kwame Mensah', why: 'arrived' }],
      },
    });

    expect(words[1]).toBe(
      'guestSelect.notChanged {"count":1,"reasons":"guestSelect.hasArrived {\\"name\\":\\"Kwame Mensah\\"}"}',
    );
  });

  it('says Nothing removed and names them when every guest stays', () => {
    const asked = removeQuestion([KWAME, ADA], new Set(['g_k', 'g_a']));

    expect(lineWords(t, { kind: 'removed', removed: nothingRemoved(asked.stays) })).toEqual([
      'guestSelect.nothingRemoved',
      'guestSelect.staysArrived {"name":"Kwame Mensah"}',
      'guestSelect.staysCompanion {"name":"Ada Obi"}',
    ]);
  });
});
