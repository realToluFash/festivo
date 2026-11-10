import { describe, expect, it } from 'vitest';

import {
  type HoldStage,
  blankDraft,
  checkOf,
  holdAfter,
  reduce,
  sampleDraft,
  sectionsOf,
  startOf,
  whatsAppLine,
  whatsAppOf,
} from './MessagesModel.ts';
import { heldPeople } from './MessagesSample.ts';
import { say } from './MessagesWords.ts';
import { reachViewOf } from './Reach.ts';

const waLines = (stage: HoldStage) =>
  heldPeople(stage).map((person) => [person.name, person.lines[1]?.word, person.lines[1]?.reason]);

describe('WhatsApp’s reach line', () => {
  it('counts each To: no mobile number, stopped, then not agreed', () => {
    expect(whatsAppLine('all')).toBe(
      'WhatsApp reaches 4 of 142 · 102 have no mobile number · 2 stopped WhatsApp · 34 haven’t agreed to WhatsApp',
    );
    expect(whatsAppLine('coming')).toBe(
      'WhatsApp reaches 3 of 96 · 65 have no mobile number · 1 stopped WhatsApp · 27 haven’t agreed to WhatsApp',
    );
  });

  it('leaves out a part that is 0', () => {
    expect(whatsAppLine('notReplied')).toBe(
      'WhatsApp reaches 1 of 25 · 16 have no mobile number · 8 haven’t agreed to WhatsApp',
    );
  });

  it('says one in the singular', () => {
    expect(say.noMobile(1)).toBe('1 has no mobile number');
    expect(say.stoppedWhatsApp(1)).toBe('1 stopped WhatsApp');
    expect(say.notAgreedWhatsApp(1)).toBe('1 hasn’t agreed to WhatsApp');
    expect(say.waitingForCredits(1)).toBe(
      '1 WhatsApp message is waiting for credits. The emails were sent.',
    );
    expect(say.waitingForCredits(4)).toBe(
      '4 WhatsApp messages are waiting for credits. The emails were sent.',
    );
  });

  it('shows only while WhatsApp is ticked', () => {
    expect(checkOf(sampleDraft('check')).reach).toBeUndefined();
    expect(checkOf(startOf('checkWhatsApp', false).draft ?? blankDraft()).reach).toBe(
      whatsAppLine('all'),
    );
    expect(startOf('whatsAppLine', false).draft).toMatchObject({
      step: 'write',
      to: 'all',
      channels: { email: true, sms: true, wa: true },
    });
  });
});

describe('WhatsApp’s credits', () => {
  it('add each reachable number’s country rate', () => {
    expect(whatsAppOf('all').credits).toBe(13);
    expect(whatsAppOf('coming').credits).toBe(11);
    expect(whatsAppOf('notReplied').credits).toBe(2);
  });

  it('join SMS’s in the check: All guests with all three ticked', () => {
    const check = checkOf(startOf('checkWhatsApp', false).draft ?? blankDraft());
    expect(check.told).toEqual([
      { key: 'email', count: 124 },
      { key: 'sms', count: 39 },
      { key: 'wa', count: 4 },
    ]);
    expect(check).toMatchObject({ count: 142, cantTell: 9, credits: 52, after: '1,448' });
    expect(say.credits(check.credits, check.after, check.whatsApp)).toBe(
      'Texts and WhatsApp messages use 52 credits. Credits after sending: 1,448.',
    );
  });

  it('come to 42 for Coming with WhatsApp ticked', () => {
    const coming = reduce(startOf('check', false), { type: 'channel', key: 'wa' }).draft;
    expect(checkOf(coming ?? blankDraft())).toMatchObject({ credits: 42, after: '1,458' });
  });
});

describe('a held message', () => {
  it('moves only from held: credits back send it, its moment passing ends it', () => {
    expect(holdAfter('held', 'topUp')).toBe('released');
    expect(holdAfter('held', 'tooLate')).toBe('tooLate');
    expect(holdAfter('released', 'tooLate')).toBe('released');
    expect(holdAfter('tooLate', 'topUp')).toBe('tooLate');
  });

  it('reads each held person’s WhatsApp as the hold left it, their email delivered', () => {
    expect(heldPeople('held').map((person) => person.lines[0]?.word)).toEqual(
      Array(4).fill('Email · Delivered'),
    );
    expect(waLines('held')).toEqual([
      ['Lucía Ortega', 'WhatsApp · Held: waiting for credits', undefined],
      ['Kwame Mensah', 'WhatsApp · Held: waiting for credits', undefined],
      ['Duboise Akande', 'WhatsApp · Held: waiting for credits', undefined],
      ['Rafael Costa', 'WhatsApp · Held: waiting for credits', undefined],
    ]);
    expect(waLines('released')).toEqual([
      ['Lucía Ortega', 'WhatsApp · Read', '10:14'],
      ['Kwame Mensah', 'WhatsApp · Read', '10:14'],
      ['Duboise Akande', 'WhatsApp · Delivered', '10:02'],
      ['Rafael Costa', 'WhatsApp · Failed', undefined],
    ]);
    expect(waLines('tooLate').map(([, word]) => word)).toEqual(
      Array(4).fill('WhatsApp · Not sent: too late'),
    );
  });

  it('seeds each state, and stands in Parking’s place in Needs you', () => {
    const held = startOf('held', false);
    expect(held).toMatchObject({ hold: 'held', balance: 0, open: { kind: 'many', key: 'held' } });
    expect(sectionsOf(held).needs).toContainEqual({ kind: 'many', key: 'held' });
    expect(sectionsOf(held).needs).not.toContainEqual({ kind: 'many', key: 'parking' });
    expect(sectionsOf(startOf('inUse', false)).needs).toContainEqual({
      kind: 'many',
      key: 'parking',
    });
    expect(startOf('whatsAppRead', true)).toMatchObject({
      hold: 'released',
      open: { kind: 'reached', of: 'held' },
    });
    expect(startOf('whatsAppTooLate', true)).toMatchObject({
      hold: 'tooLate',
      balance: 0,
      open: { kind: 'reached', of: 'held' },
    });
  });

  it('draws Who it reached: WhatsApp · 4, Can’t be told · 18, then Reached, and no resend', () => {
    const view = reachViewOf(startOf('held', false), 'held');
    expect(view.title).toBe('Reached 124 of 142');
    expect(view.line).toBe('Seen by 87 on their page · 18 can’t be told');
    expect(view.groups.map((group) => [group.word, group.count, group.more])).toEqual([
      ['WhatsApp', 4, undefined],
      ['Can’t be told', 18, 'and 16 more'],
      ['Reached', 124, 'and 123 more'],
    ]);
    expect(view.options.map((option) => option.key)).not.toContain('whatsApp');
    expect(view.options.find((option) => option.key === 'notReached')?.count).toBe(18);
    expect(view.resend).toBe(0);
    expect(view.groups[1]?.people.map((person) => person.lines.map((line) => line.reason))).toEqual(
      [
        ['Unsubscribed', 'Stopped WhatsApp'],
        [undefined, 'Hasn’t agreed to WhatsApp'],
      ],
    );
  });
});
