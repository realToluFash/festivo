import { describe, expect, it } from 'vitest';

import { markSent, seed, trailLine } from './StaffLinkModel.ts';
import { sampleRoster } from './StaffRosterModel.ts';
import {
  BALANCE,
  TW,
  askText,
  bulkCheck,
  checkOf,
  costOfText,
  staffSmsParts,
  textCostOf,
  offersText,
  pressText,
  reportedSent,
  reportedUndelivered,
  resultLines,
  sentOn,
  textAll,
  textRoster,
  textSeed,
  withdrawn,
} from './StaffTextModel.ts';

describe('texting a staff link (sc-77904)', () => {
  it('offers Text the link only once SMS is in', () => {
    expect(offersText(seed('none'))).toBe(false);
    expect(offersText(textSeed('smsOn'))).toBe(true);
    expect(offersText(textSeed('smsReadOnly'))).toBe(false);
  });

  it('checks one text first, with sc-3963’s lines', () => {
    const check = checkOf([costOfText(textSeed('smsOn'))], BALANCE);
    expect(TW.thisTextUses(check.uses)).toBe('This text uses 62 credits.');
    expect(TW.after(check.after)).toBe('Credits after sending: 1,438.');
    expect(checkOf([62], 0).wait).toBe(1);
    expect(TW.smsWaits(1)).toBe('1 SMS message will wait for credits.');
    expect(askText(textSeed('smsOn'), true).texting?.checking).toBe(true);
  });

  it('reads Sending text… until Twilio reports sent, then Link sent by you', () => {
    const sending = pressText(textSeed('smsOn'));
    expect(sending.texting?.pending).toBe('sending');
    expect(sending.say).toBe('Sending the link to Ada Obi.');
    expect(offersText(sending)).toBe(false);
    const sent = reportedSent(sending);
    expect(sent.status).toBe('sent');
    expect(trailLine(sent.status, sent.trail)).toBe('Sent by Amara Nwosu · 19:12');
    expect(sent.texting?.credits).toBe(BALANCE - 62);
  });

  it('keeps Link opened when an opened link is texted', () => {
    expect(textSeed('textOpened').status).toBe('opened');
  });

  it('says a refused press in the check and leaves the status', () => {
    const refused = textSeed('textNotSent');
    expect(pressText(refused).texting?.checkFailed).toBe(true);
    expect(pressText(refused).status).toBe('none');
  });

  it('holds with no credits and waits at night, each said with a full stop', () => {
    const held = pressText(textSeed('textCheckShort'));
    expect(held.texting?.pending).toBe('held');
    expect(held.say).toBe('Text held: no credits.');
    expect(held.status).toBe('none');
    const waits = pressText(textSeed('textCheckQuiet'));
    expect(waits.say).toBe('Text waits until 09:00, their time.');
    expect(withdrawn(markSent(waits)).texting?.pending).toBeNull();
  });

  it('goes back after an undelivered text, with the time, and offers it again', () => {
    const start = textSeed('smsOn');
    const sending = pressText({
      ...start,
      texting: start.texting == null ? null : { ...start.texting, undelivered: true },
    });
    const back = reportedUndelivered(reportedSent(sending));
    expect(back.status).toBe('none');
    expect(back.texting?.notDelivered).toBe('19:12');
    expect(offersText(back)).toBe(true);
  });

  it('has no Text the link once a number stopped texts', () => {
    expect(offersText(textSeed('stopped'))).toBe(false);
  });
});

describe('Text links to {n} (sc-77904)', () => {
  it('counts No link yet, Copied and Shared with a number, and the check’s credits', () => {
    const check = bulkCheck(sampleRoster(), BALANCE);
    expect(check.n).toBe(5);
    expect(check.m).toBe(1);
    expect(TW.textsUse(check.uses)).toBe('Texts use 310 credits.');
    expect(TW.after(check.after)).toBe('Credits after sending: 1,190.');
    expect(bulkCheck(sampleRoster(), 150).wait).toBe(3);
  });

  it('says Sending first, each other sentence only above 0', () => {
    expect(textAll(sampleRoster(), BALANCE, false).lines).toEqual([
      'Sending to 5 people.',
      '1 has no mobile number.',
    ]);
    expect(textAll(sampleRoster(), 150, false).lines).toEqual([
      'Sending to 2 people.',
      '1 has no mobile number.',
      '3 held: no credits.',
    ]);
    expect(textAll(sampleRoster(), BALANCE, true).lines).toEqual([
      '1 has no mobile number.',
      '5 wait until 09:00, their time.',
    ]);
    expect(resultLines({ sending: 1, m: 1, k: 1, held: 0, waits: 1, time: '09:00' })).toEqual([
      'Sending to 1 person.',
      '1 has no mobile number.',
      '1 has stopped texts.',
      '1 waits until 09:00, their time.',
    ]);
  });

  it('counts nobody once everyone is sending or sent, and the stopped are left out', () => {
    const pressed = textAll(sampleRoster(), BALANCE, false);
    expect(bulkCheck(pressed.people, pressed.credits).n).toBe(0);
    expect(bulkCheck(pressed.people.map(sentOn), pressed.credits).n).toBe(0);
    expect(bulkCheck(textRoster('stopped')?.people ?? [], BALANCE).n).toBe(4);
    expect(bulkCheck(textRoster('stopped')?.people ?? [], BALANCE).k).toBe(1);
    expect(
      textRoster('bulkNone')?.people.filter((p) => p.status === 'sent').length,
    ).toBeGreaterThan(4);
  });

  it('prices each text by its own number’s country, never the event’s', () => {
    expect(textCostOf('+2348031110007', null)).toBe(62);
    expect(textCostOf('+447400123456', null)).toBe(9);
    expect(checkOf([62, 9], 70)).toMatchObject({ uses: 62, wait: 1 });
    expect(() => textCostOf(null, null)).toThrow();
  });

  it('keeps the first text, STOP line and all, to one part with the sample names', () => {
    expect(staffSmsParts(true)).toBe(1);
  });

  it('counts in en’s CLDR plural forms', () => {
    expect(TW.noMobile(1)).toBe('1 has no mobile number.');
    expect(TW.noMobile(0)).toBe('0 have no mobile number.');
    expect(TW.textsUse(1_500)).toBe('Texts use 1,500 credits.');
  });
});
