import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  answerable,
  answeredWords,
  endsAt,
  JULIEN,
  KOFI,
  oldestFirst,
  OWN_LINE,
  PRIYA,
  RECOVERY_WORDS,
  recoveryFacts,
  recoveryHeard,
  recoveryOf,
  waitingKinds,
} from './MembersRecoverySample.ts';
import { membersSayIn } from './MembersSample.ts';

const us = membersSayIn('en-US');
const gb = membersSayIn('en-GB');
const kofi = { name: 'Kofi Mensah', email: KOFI };
const priya = { name: 'Priya Shah', email: PRIYA };
const julien = { name: 'Julien Moreau', email: JULIEN };

const web = (
  JSON.parse(readFileSync(join('..', 'web', 'src', 'i18n', 'locales', 'en.json'), 'utf8')) as {
    recoveryRequests: Record<string, string>;
  }
).recoveryRequests;
const fill = (key: string, values: Record<string, string>) =>
  (web[key] ?? '').replace(/\{\{(\w+)\}\}/gu, (_all, name: string) => values[name] ?? '');

describe('Requests to get back in, on the app’s Members', () => {
  it('says what the product says, in the web’s recoveryRequests words', () => {
    const plain = {
      title: 'cardTitle',
      note: 'cardNote',
      mark: 'mark',
      asked: 'title',
      intro: 'intro',
      provedBoth: 'provedBoth',
      provedEmail: 'provedEmail',
      provedBothOwn: 'provedBothOwn',
      provedEmailOwn: 'provedEmailOwn',
      approve: 'approve',
      turnDown: 'turnDown',
      approveBody: 'approveBody',
      approveConfirm: 'approveConfirm',
      cancel: 'cancel',
      turnDownBody: 'turnDownBody',
      turnDownConfirm: 'turnDownConfirm',
      keep: 'keep',
      approvedNext: 'approvedNext',
      turnedDownNext: 'turnedDownNext',
      closed: 'closed',
    } as const;
    for (const [ours, theirs] of Object.entries(plain))
      expect(RECOVERY_WORDS[ours as keyof typeof plain], theirs).toBe(web[theirs]);

    const name = { name: 'Kofi Mensah' };
    expect(RECOVERY_WORDS.you('Kofi Mensah')).toBe(fill('you', name));
    expect(RECOVERY_WORDS.approveTitle('Kofi Mensah')).toBe(fill('approveTitle', name));
    expect(RECOVERY_WORDS.turnDownTitle('Kofi Mensah')).toBe(fill('turnDownTitle', name));
    expect(RECOVERY_WORDS.approved('Kofi Mensah')).toBe(fill('approved', name));
    expect(RECOVERY_WORDS.turnedDown('Kofi Mensah')).toBe(fill('turnedDown', name));
    expect(RECOVERY_WORDS.when('A', 'B')).toBe(fill('when', { asked: 'A', expires: 'B' }));
    expect(OWN_LINE).toBe(fill('own', { organisations: 'Ire Events' }));
  });

  it('lists Kofi’s request before Priya’s, the oldest first', () => {
    expect(oldestFirst([PRIYA, KOFI])).toEqual([KOFI, PRIYA]);
  });

  it('ends a request exactly 7 × 24 hours after it was asked, across a month', () => {
    expect(endsAt('2026-11-03T18:05')).toBe('2026-11-10T18:05');
    expect(endsAt('2026-11-28T23:59')).toBe('2026-12-05T23:59');
  });

  it('writes each request’s facts as the board does, dated the reader’s way', () => {
    expect(recoveryFacts(recoveryOf(KOFI), kofi, false, us)).toEqual([
      'kofi@ire.events',
      'Asked to turn off two-factor · Proved with codes to their email and phone',
      'Asked Tuesday, Nov 3 at 6:05 PM WAT · ends Tuesday, Nov 10 at 6:05 PM WAT if nobody answers',
    ]);
    expect(recoveryFacts(recoveryOf(PRIYA), priya, false, us)).toEqual([
      'priya@ire.events',
      'Asked to turn off two-factor · Proved with a code to their email (no verified phone)',
      'Asked Wednesday, Nov 4 at 8:40 AM WAT · ends Wednesday, Nov 11 at 8:40 AM WAT if nobody answers',
    ]);
    expect(recoveryFacts(recoveryOf(KOFI), kofi, false, gb)[2]).toBe(
      'Asked Tuesday 3 Nov at 18:05 WAT · ends Tuesday 10 Nov at 18:05 WAT if nobody answers',
    );
  });

  it('says your own request in your words', () => {
    expect(recoveryFacts(recoveryOf(JULIEN), julien, true, us)[1]).toBe(
      'Asked to turn off two-factor · Proved with codes to your email and phone',
    );
    expect(OWN_LINE).toBe(
      'This is your own request. Somebody else in Ire Events has to answer it.',
    );
  });

  it('reads each request as one group, in the AC’s order, the list’s paragraph with it', () => {
    expect(recoveryHeard(recoveryOf(KOFI), kofi, false, us)).toBe(
      'Waiting for an answer. Asked to turn off two-factor. They lost their authenticator and their recovery codes, and stay signed out until somebody answers. One answer from an owner or admin is enough. Approve only if you’re sure it’s them, for example by calling them on a number you already have. Kofi Mensah, kofi@ire.events. Proved with codes to their email and phone. Asked Tuesday, Nov 3 at 6:05 PM WAT · ends Tuesday, Nov 10 at 6:05 PM WAT if nobody answers.',
    );
    expect(recoveryHeard(recoveryOf(JULIEN), julien, true, us)).toMatch(
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
