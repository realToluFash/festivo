import { describe, expect, it } from 'vitest';

import {
  type Inbox,
  type Unreached,
  REASONS_UNREACHED,
  changed,
  isQuiet,
  resendOf,
  seedOf,
  textedOf,
  textedPerson,
  trySmsOf,
  trySmsOffered,
  whoOf,
} from './messages.ts';
import { GROUPS } from './messagesTo.ts';

const TICKS = { email: true, sms: true, whatsApp: false };

function who(inbox: Inbox) {
  return whoOf(inbox, 'reasons', 'parking', GROUPS);
}

function personIn(inbox: Inbox, id: string): Unreached | undefined {
  return who(inbox)
    .groups.flatMap((group) => group.people)
    .find((one) => one.id === id);
}

function offered(inbox: Inbox): string[] {
  return who(inbox)
    .groups.flatMap((group) => group.people)
    .filter((one) => one.fixes.includes('trySms'))
    .map((one) => one.id);
}

describe('Who it reached, every reason and Try SMS instead (sc-3966)', () => {
  const reasons = seedOf('reasons');

  it('counts Parking told by Email only: 133 of 142, Failed and Skipped as groups of their own', () => {
    const { reach, line } = who(reasons);

    expect(reach.reached).toBe(133);
    expect(line).toBe(
      'Seen by 87 on their page · 2 bounced · 2 failed · 1 opted out · 2 skipped · 2 no email or phone',
    );
  });

  it('words each reason as sc-3942 does', () => {
    const why = (id: string) => personIn(reasons, id)?.lines[0];

    expect(why('chidi')).toMatchObject({
      word: 'Email · Failed',
      why: 'We could not send this email',
    });
    expect(why('rafael')).toMatchObject({
      word: 'Email · Failed',
      why: 'Soirely cannot email this address',
    });
    expect(why('yuki')).toMatchObject({ word: 'Email · Not sent', why: 'Address is bouncing' });
    expect(why('diego')).toMatchObject({
      word: 'Email · Not sent',
      why: 'Reported an earlier email as spam',
    });
    expect(personIn(reasons, 'kemi')?.lines[0]?.word).toBe('Email · Reported as spam');
  });

  it('offers Try SMS instead by the person, whatever their email line reads', () => {
    expect(offered(reasons)).toEqual(['olumide', 'chidi', 'rafael', 'sophie', 'yuki']);
    expect(personIn(reasons, 'olumide')?.fixes).toEqual(['trySms', 'fixEmail', 'toldInPerson']);
  });

  it('never offers it without a mobile, to one who stopped texts, or once a text went', () => {
    const [tomas, olumide] = REASONS_UNREACHED;
    const diego = REASONS_UNREACHED.find((one) => one.id === 'diego');

    expect(tomas && trySmsOffered(tomas)).toBe(false);
    expect(diego && trySmsOffered(diego)).toBe(false);
    expect(olumide && trySmsOffered(textedPerson(olumide, 'sent'))).toBe(false);
    expect(olumide && trySmsOffered({ ...olumide, kind: 'inProgress' })).toBe(false);
    expect(olumide && trySmsOffered({ ...olumide, kind: 'held' })).toBe(false);
  });

  it('never offers it to someone marked as told', () => {
    const told = changed(reasons, { kind: 'toldInPerson', id: 'sophie', thread: 'parking' });
    const marked = who(told).groups.find((group) => group.key === 'told');

    expect(marked?.people.map((one) => one.id)).toEqual(['sophie']);
    expect(marked?.people[0]?.fixes).toEqual([]);
    expect(offered(told)).not.toContain('sophie');
  });

  it('shows the text’s count and credits before anything goes', () => {
    expect(trySmsOf({ perPart: 62, theirTime: '10:41' }, 1500)).toEqual({
      credits: 62,
      count: 'SMS · 1 part · GSM-7 · 154 characters',
      uses: 'This text uses 62 credits.',
      after: 'Credits after sending: 1,438.',
      waits: null,
      quiet: null,
    });
  });

  it('adds the quiet-hours line outside 09:00 to 20:00 their time', () => {
    expect(isQuiet('06:41')).toBe(true);
    expect(isQuiet('09:00')).toBe(false);
    expect(isQuiet('19:59')).toBe(false);
    expect(isQuiet('20:00')).toBe(true);
    expect(trySmsOf({ perPart: 10, theirTime: '06:41' }, 1500)).toMatchObject({
      after: 'Credits after sending: 1,490.',
      quiet: 'This text waits until 09:00, their time.',
    });
  });

  it('waits for credits in place of Credits after sending when they fall short', () => {
    expect(trySmsOf({ perPart: 9, theirTime: '09:41' }, 0)).toMatchObject({
      uses: 'This text uses 9 credits.',
      after: null,
      waits: '1 SMS message will wait for credits.',
    });
  });

  it('after Send by SMS counts them In progress, or Held when credits fall short, out of the resend', () => {
    const sent = changed(reasons, { kind: 'textSms', id: 'olumide' });

    expect(personIn(sent, 'olumide')).toMatchObject({ kind: 'inProgress' });
    expect(personIn(sent, 'olumide')?.lines.map((line) => line.word)).toEqual([
      'Email · Bounced',
      'SMS · Sent',
      'Their page',
    ]);
    expect(sent.balance).toBe(1438);
    expect(who(sent).line).toBe(
      'Seen by 87 on their page · 1 in progress · 1 bounced · 2 failed · 1 opted out · 2 skipped · 2 no email or phone',
    );
    expect(who(sent).waiting).toHaveLength(8);
    expect(resendOf(sent, 'parking', TICKS, GROUPS).waiting).toBe(8);

    const quiet = changed(reasons, { kind: 'textSms', id: 'rafael' });

    expect(personIn(quiet, 'rafael')?.lines[1]).toEqual({
      mark: 'held',
      word: 'SMS',
      why: 'Waiting until 09:00, their time',
    });

    const held = changed({ ...reasons, balance: 0 }, { kind: 'textSms', id: 'yuki' });

    expect(personIn(held, 'yuki')).toMatchObject({ kind: 'held' });
    expect(personIn(held, 'yuki')?.lines[1]?.word).toBe('SMS · Held');
    expect(held.balance).toBe(0);
    expect(who(held).line).toContain('1 held');
  });

  it('decides what Send by SMS does from the credits and their time', () => {
    expect(textedOf({ perPart: 62, theirTime: '10:41' }, 1500)).toBe('sent');
    expect(textedOf({ perPart: 10, theirTime: '06:41' }, 1500)).toBe('waiting');
    expect(textedOf({ perPart: 9, theirTime: '06:41' }, 0)).toBe('held');
  });

  it('opens each state as its board draws it', () => {
    expect(seedOf('trySmsShort').balance).toBe(0);
    expect(personIn(seedOf('trySmsSent'), 'olumide')?.kind).toBe('inProgress');
    expect(personIn(seedOf('closedReached'), 'tomas')).toMatchObject({ offer: true });
  });

  it('draws a text the guest’s night holds first in In progress, counted in the 56', () => {
    const progress = whoOf(seedOf('reachedQuiet'), 'new', 'new', GROUPS).groups.find(
      (group) => group.key === 'inProgress',
    );

    expect(progress?.people[0]).toMatchObject({ id: 'valentina', kind: 'inProgress' });
    expect(progress?.people[0]?.lines[0]?.why).toBe('Waiting until 09:00, their time');
    expect(progress).toMatchObject({ count: 56, more: 53 });
  });
});
