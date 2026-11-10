import { describe, expect, it } from 'vitest';

import {
  blankDraft,
  checkOf,
  reduce,
  sampleDraft,
  sectionsOf,
  startOf,
  whatsAppLine,
  whatsAppOf,
} from './MessagesModel.ts';
import { TELL, receiptPeople, whatsAppCredits, whatsAppCreditsFor } from './MessagesSample.ts';
import { say } from './MessagesWords.ts';
import { reachViewOf } from './Reach.ts';

const waLines = () =>
  receiptPeople().map((person) => [person.name, person.lines[1]?.word, person.lines[1]?.reason]);

describe('WhatsApp’s reach line', () => {
  it('counts each To: no mobile number, stopped, then not agreed', () => {
    expect(whatsAppLine('all')).toBe(
      'WhatsApp reaches 4 of 142 · 102 have no mobile number, 2 stopped WhatsApp and 34 haven’t agreed to WhatsApp',
    );
    expect(whatsAppLine('coming')).toBe(
      'WhatsApp reaches 3 of 96 · 65 have no mobile number, 1 stopped WhatsApp and 27 haven’t agreed to WhatsApp',
    );
  });

  it('leaves out a part that is 0', () => {
    expect(whatsAppLine('notReplied')).toBe(
      'WhatsApp reaches 1 of 25 · 16 have no mobile number and 8 haven’t agreed to WhatsApp',
    );
  });

  it('says one in the singular', () => {
    expect(say.noMobile(1)).toBe('1 has no mobile number');
    expect(say.stoppedWhatsApp(1)).toBe('1 stopped WhatsApp');
    expect(say.notAgreedWhatsApp(1)).toBe('1 hasn’t agreed to WhatsApp');
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
  it('count each number at its country’s utility rate (sc-3928)', () => {
    expect(
      ['+234 802', '+55 21', '+52 55', '+44 7700', '+33 6', '+34 612', '+49 151', '+1 212'].map(
        whatsAppCredits,
      ),
    ).toEqual([2, 2, 2, 5, 5, 4, 9, 0]);
    expect(whatsAppCreditsFor(['lucia', 'kwame', 'duboise', 'rafael'])).toBe(13);
    expect(whatsAppCreditsFor(['ines'])).toBe(0);
    expect(TELL.credits).toBe(43);
  });

  it('add each reachable number’s country rate', () => {
    expect(whatsAppOf('all').credits).toBe(13);
    expect(whatsAppOf('coming').credits).toBe(11);
    expect(whatsAppOf('notReplied').credits).toBe(2);
  });

  it('join SMS’s in the check: All guests with all three ticked', () => {
    const check = checkOf(startOf('checkWhatsApp', false).draft ?? blankDraft());
    expect(check.told).toEqual([
      { key: 'email', count: 124 },
      { key: 'sms', count: 35 },
      { key: 'wa', count: 4 },
    ]);
    expect(check).toMatchObject({ count: 142, cantTell: 9, credits: 48, after: '1,452' });
    expect(say.credits(check.credits, check.after, check.whatsApp)).toBe(
      'Texts and WhatsApp messages use 48 credits. Credits after sending: 1,452.',
    );
  });

  it('come to 39 for Coming with WhatsApp ticked', () => {
    const coming = reduce(startOf('check', false), { type: 'channel', key: 'wa' }).draft;
    expect(checkOf(coming ?? blankDraft())).toMatchObject({ credits: 39, after: '1,461' });
  });
});

describe('WhatsApp’s receipts', () => {
  it('reads Sent, Delivered, Read with its time, then Failed, their email delivered', () => {
    expect(receiptPeople().map((person) => person.lines[0]?.word)).toEqual(
      Array(4).fill('Email · Delivered'),
    );
    expect(waLines()).toEqual([
      ['Lucía Ortega', 'WhatsApp · Sent', '18:20'],
      ['Duboise Akande', 'WhatsApp · Delivered', '18:21'],
      ['Kwame Mensah', 'WhatsApp · Read', '18:24'],
      ['Rafael Costa', 'WhatsApp · Failed', undefined],
    ]);
  });

  it('seeds the state, and stands in Parking’s place in Needs you', () => {
    const read = startOf('whatsAppRead', false);
    expect(read).toMatchObject({ receipts: true, open: { kind: 'reached', of: 'receipts' } });
    expect(sectionsOf(read).needs).toContainEqual({ kind: 'many', key: 'receipts' });
    expect(sectionsOf(read).needs).not.toContainEqual({ kind: 'many', key: 'parking' });
    expect(sectionsOf(startOf('inUse', false)).needs).toContainEqual({
      kind: 'many',
      key: 'parking',
    });
  });

  it('draws Who it reached: WhatsApp · 4, Can’t be told · 18, then Reached, and no resend', () => {
    const view = reachViewOf(startOf('whatsAppRead', false), 'receipts');
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
        [undefined, 'Has not agreed to WhatsApp'],
        ['Unsubscribed', 'Stopped WhatsApp'],
      ],
    );
  });
});
