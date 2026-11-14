import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { ownLine, recoveryFacts, recoveryHeard } from '../../kit/membersRecovery.ts';

import {
  ANSWER_MS,
  answerable,
  answerTakes,
  answeredWords,
  endsAt,
  HELD_MS,
  JULIEN,
  KOFI,
  oldestFirst,
  PRIYA,
  RECOVERY_WORDS,
  recoveryRequestOf,
  waitingKinds,
} from './MembersRecoverySample.ts';
import { membersSayIn } from './MembersSample.ts';

const us = membersSayIn('en-US');
const gb = membersSayIn('en-GB');
const kofi = { id: KOFI, name: 'Kofi Mensah', email: KOFI };
const priya = { id: PRIYA, name: 'Priya Shah', email: PRIYA };
const julien = { id: JULIEN, name: 'Julien Moreau', email: JULIEN };

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const WEB_EN = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'web',
  'src',
  'i18n',
  'locales',
  'en.json',
);
const web = (
  JSON.parse(readFileSync(WEB_EN, 'utf8')) as { recoveryRequests: Record<string, string> }
).recoveryRequests;
const fill = (key: string, values: Record<string, string>) =>
  (web[key] ?? '').replace(/\{\{(\w+)\}\}/gu, (_all, name: string) => values[name] ?? '');

describe('Requests to get back in, on the app’s Members', () => {
  it('says the card’s words as the web’s recoveryRequests do', () => {
    expect(RECOVERY_WORDS.approvedNext).toBe(web['approvedNext']);
    expect(RECOVERY_WORDS.turnedDownNext).toBe(web['turnedDownNext']);
    const name = { name: 'Kofi Mensah' };
    expect(RECOVERY_WORDS.approved('Kofi Mensah')).toBe(fill('approved', name));
    expect(RECOVERY_WORDS.turnedDown('Kofi Mensah')).toBe(fill('turnedDown', name));
  });

  it('answers in a moment, and holds a linked answer on its way before it lands', () => {
    expect(answerTakes('answers', 1)).toBe(ANSWER_MS);
    expect(answerTakes('answers', 2)).toBe(ANSWER_MS);
    expect(answerTakes('holds', 1)).toBe(HELD_MS);
    expect(answerTakes('holds', 2)).toBe(ANSWER_MS);
  });

  it('lists Kofi’s request before Priya’s, the oldest first', () => {
    expect(oldestFirst([PRIYA, KOFI])).toEqual([KOFI, PRIYA]);
  });

  it('ends a request exactly 7 × 24 hours after it was asked, across a month', () => {
    expect(endsAt('2026-11-03T18:05')).toBe('2026-11-10T18:05');
    expect(endsAt('2026-11-28T23:59')).toBe('2026-12-05T23:59');
  });

  it('writes each request’s facts as the board does, dated the reader’s way', () => {
    expect(recoveryFacts(t, recoveryRequestOf(kofi, false, us))).toEqual([
      'kofi@ire.events',
      'Asked to turn off two-factor · Proved with codes to their email and phone',
      'Asked Tuesday, Nov 3 at 18:05 WAT · ends Tuesday, Nov 10 at 18:05 WAT if nobody answers',
    ]);
    expect(recoveryFacts(t, recoveryRequestOf(priya, false, us))).toEqual([
      'priya@ire.events',
      'Asked to turn off two-factor · Proved with a code to their email (no verified phone)',
      'Asked Wednesday, Nov 4 at 08:40 WAT · ends Wednesday, Nov 11 at 08:40 WAT if nobody answers',
    ]);
    expect(recoveryFacts(t, recoveryRequestOf(kofi, false, gb))[2]).toBe(
      'Asked Tuesday 3 Nov at 18:05 WAT · ends Tuesday 10 Nov at 18:05 WAT if nobody answers',
    );
  });

  it('says your own request in your words', () => {
    expect(recoveryFacts(t, recoveryRequestOf(julien, true, us))[1]).toBe(
      'Asked to turn off two-factor · Proved with codes to your email and phone',
    );
    expect(ownLine(t, recoveryRequestOf(julien, true, us), 'en-US')).toBe(
      'This is your own request. Somebody else in Ire Events has to answer it.',
    );
  });

  it('reads each request as one group, in the AC’s order, the list’s paragraph with it', () => {
    expect(recoveryHeard(t, recoveryRequestOf(kofi, false, us))).toBe(
      'Waiting for an answer. Asked to turn off two-factor. They lost their authenticator and their recovery codes, and stay signed out until somebody answers. One answer from an owner or admin is enough. Approve only if you’re sure it’s them, for example by calling them on a number you already have. Kofi Mensah, kofi@ire.events. Proved with codes to their email and phone. Asked Tuesday, Nov 3 at 18:05 WAT · ends Tuesday, Nov 10 at 18:05 WAT if nobody answers.',
    );
    expect(recoveryHeard(t, recoveryRequestOf(julien, true, us))).toMatch(
      /have\. Julien Moreau \(you\), julien@ire\.events\. Proved with codes to your email and phone\./u,
    );
  });

  it('never offers the viewer their own request', () => {
    expect(answerable([KOFI, PRIYA], JULIEN)).toEqual([KOFI, PRIYA]);
    expect(answerable([JULIEN], JULIEN)).toEqual([]);
  });

  it('counts both kinds on the card’s line, and drops it when only one kind waits', () => {
    expect(waitingKinds(2, 1)).toBe('2 to get back in · 1 to join');
    expect(waitingKinds(1, 1)).toBe('1 to get back in · 1 to join');
    expect(waitingKinds(2, 0)).toBeNull();
    expect(waitingKinds(0, 1)).toBeNull();
  });

  it('says an answer in the product’s two lines', () => {
    expect(answeredWords({ id: KOFI, kind: 'approved' }, 'Kofi Mensah')).toEqual({
      says: 'Kofi Mensah’s two-factor is off.',
      line: 'They’re emailed now, and every session they had has ended.',
    });
    expect(answeredWords({ id: KOFI, kind: 'turnedDown' }, 'Kofi Mensah')).toEqual({
      says: 'Kofi Mensah’s request is turned down.',
      line: 'Two-factor stays on for them, and they’re emailed.',
    });
  });
});
