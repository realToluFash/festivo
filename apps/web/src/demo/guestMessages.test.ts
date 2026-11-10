import { describe, expect, it } from 'vitest';

import { offersWhatsApp, startOf, wordsFor } from './guest.ts';
import { channelRows, switched, whatsAppOn } from './guestMessages.ts';

const on = (state: string) => channelRows(startOf(state)).map((row) => row.on);

describe('Your messages, opened from the guest’s page (sc-3969, sc-3950)', () => {
  it('lists Email, Text messages and WhatsApp in that order, WhatsApp never on by default', () => {
    expect(channelRows(startOf('messagesWhatsAppOff')).map((row) => row.channel)).toEqual([
      'email',
      'sms',
      'whatsApp',
    ]);
    expect(on('messagesWhatsAppOff')).toEqual([true, true, false]);
    expect(on('messagesWhatsAppTurnedOn')).toEqual([true, true, true]);
    expect(on('messagesWhatsAppOn')).toEqual([true, true, true]);
    expect(on('messagesWhatsAppTurnedOff')).toEqual([true, true, false]);
  });

  it('shows the WhatsApp line whenever WhatsApp has a switch, on or off', () => {
    for (const state of [
      'messagesWhatsAppOff',
      'messagesWhatsAppTurnedOn',
      'messagesWhatsAppOn',
      'messagesWhatsAppTurnedOff',
    ]) {
      expect(channelRows(startOf(state)).find((row) => row.whatsAppLine)?.channel).toBe('whatsApp');
    }
  });

  it('gives Text messages and WhatsApp no switch and no line without a mobile number', () => {
    const rows = channelRows(startOf('messagesNoMobile'));

    expect(rows.map((row) => row.has)).toEqual([true, false, false]);
    expect(rows.some((row) => row.whatsAppLine)).toBe(false);
    expect(switched(startOf('messagesNoMobile'), 'whatsApp')).toEqual({});
  });

  it('saves a switch at once: WhatsApp on is the agreement, off ends it', () => {
    const off = startOf('messagesWhatsAppOff');
    const turnedOn = { ...off, ...switched(off, 'whatsApp') };

    expect(turnedOn).toMatchObject({ whatsApp: 'agreed', reach: { saved: 'whatsApp' } });
    expect(offersWhatsApp(turnedOn)).toBe(false);

    const turnedOff = { ...turnedOn, ...switched(turnedOn, 'whatsApp') };
    expect(turnedOff.whatsApp).toBe('stopped');
    expect(offersWhatsApp(turnedOff)).toBe(true);
    expect(switched(off, 'sms')).toEqual({
      reach: { email: true, sms: false, saved: 'sms' },
    });
    expect(whatsAppOn('hostRecorded')).toBe(true);
  });

  it('writes sc-3969’s words for Ire Events, and the WhatsApp line', () => {
    const words = wordsFor('en');

    expect(words.whatsAppUpdates).toBe(
      'Soirely sends updates on WhatsApp on behalf of Ire Events. Reply STOP at any time to end them.',
    );
    expect(words.savedLine('whatsApp', true)).toBe(
      'WhatsApp messages from Ire Events are on again.',
    );
    expect(words.savedLine('whatsApp', false)).toBe('WhatsApp messages from Ire Events are off.');
    expect(words.noPhone).toBe('Ire Events has no phone number for you.');
    expect(words.yourMessagesFoot).toBe(
      'Only you can turn these back on. Ire Events can see which you have turned off, and when.',
    );
  });
});
