import { describe, expect, it } from 'vitest';

import { offersWhatsApp, startOf, wordsFor } from './guest.ts';
import {
  channelRows,
  focusAfter,
  landed,
  notSaved,
  openedFromPage,
  saved,
  saving,
  switchPressed,
  switched,
  wayInState,
  whatsAppOn,
} from './guestMessages.ts';

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
    expect(words.savedLine('whatsApp', true)).toBe('WhatsApp messages from Ire Events are on.');
    expect(words.savedLine('whatsApp', false)).toBe('WhatsApp messages from Ire Events are off.');
    expect(words.noPhone).toBe('Ire Events has no phone number for you.');
    expect(words.yourMessagesFoot).toBe(
      'Only you can turn these back on. Ire Events can see which you have turned off, and when.',
    );
  });
});

const yours = (state: string) => startOf(state).yours;

describe('Your messages, as each state opens (sc-3969)', () => {
  it('opens from an email’s link with no Back, leading with the button while emails are on', () => {
    expect(yours('messagesFromEmail')).toMatchObject({ from: 'email', lead: 'button' });
    expect(yours('messagesStopSaving')).toMatchObject({ lead: 'button', busy: 'stop' });
    expect(yours('messagesStopFailed')).toMatchObject({ lead: 'button', failed: 'stop' });
    expect(yours('messagesStopped')).toMatchObject({ lead: 'stopped', busy: null });
    expect(yours('messagesUndoSaving')).toMatchObject({ lead: 'stopped', busy: 'undo' });
    expect(yours('messagesUndoFailed')).toMatchObject({ lead: 'stopped', failed: 'undo' });
    expect(yours('messagesUndone')).toMatchObject({ lead: 'undone' });
    expect(yours('messagesEmailOff')).toMatchObject({ from: 'email', lead: null });
    expect(on('messagesStopFailed')).toEqual([true, true, false]);
    expect(on('messagesStopped')).toEqual([false, true, false]);
    expect(on('messagesUndoFailed')).toEqual([false, true, false]);
    expect(on('messagesUndone')).toEqual([true, true, false]);
    expect(on('messagesEmailOff')).toEqual([false, true, false]);
  });

  it('opens from the guest’s page with no button, and only the latest change has a line', () => {
    for (const state of [
      'messagesWhatsAppOff',
      'messagesTextsOff',
      'messagesSwitchSaving',
      'messagesSwitchFailed',
      'messagesTwoOff',
      'messagesNoEmail',
      'messagesNothing',
    ]) {
      expect(yours(state)).toMatchObject({ from: 'page', lead: null });
    }
    expect(channelRows(startOf('messagesTextsOff')).filter((row) => row.saved)).toMatchObject([
      { channel: 'sms', on: false },
    ]);
    expect(on('messagesTwoOff')).toEqual([false, false, true]);
    expect(channelRows(startOf('messagesTwoOff')).some((row) => row.saved)).toBe(false);
  });

  it('draws a switch saving on the side it was pressed to, and one that failed where it was', () => {
    const sms = (state: string) => channelRows(startOf(state)).find((row) => row.channel === 'sms');

    expect(sms('messagesSwitchSaving')).toMatchObject({ on: true, shown: false, saving: true });
    expect(sms('messagesSwitchFailed')).toMatchObject({ on: true, shown: true, failed: true });
  });

  it('gives a channel with nothing on record no switch, Email by its email address', () => {
    expect(channelRows(startOf('messagesNoEmail')).map((row) => row.has)).toEqual([
      false,
      true,
      true,
    ]);
    expect(channelRows(startOf('messagesNothing')).map((row) => row.has)).toEqual([
      false,
      false,
      false,
    ]);
    expect(switched(startOf('messagesNoEmail'), 'email')).toEqual({});
    expect(saved(startOf('messagesNothing'), 'sms')).toEqual({});
  });

  it('waits on loading and shows the bad link alone, both as an email’s link opens them', () => {
    expect(yours('messagesLoading')).toMatchObject({ from: 'email', opening: 'loading' });
    expect(yours('messagesLinkBroken')).toMatchObject({ from: 'email', opening: 'broken' });
    expect(landed(startOf('messagesLoading')).yours).toMatchObject({
      opening: 'open',
      lead: 'button',
    });
  });
});

describe('Your messages, what a press turns it into (sc-3969)', () => {
  it('records the button’s Email off: the words in its place, Email off, no row’s line', () => {
    const from = startOf('messagesTextsOff');
    const after = saved({ ...from, yours: { ...from.yours, lead: 'button' } }, 'stop');

    expect(after.reach).toEqual({ email: false, sms: false, saved: null });
    expect(after.yours).toMatchObject({ lead: 'stopped', busy: null, failed: null });
  });

  it('records Undo’s Email on, with no Undo after it', () => {
    expect(saved(startOf('messagesStopped'), 'undo')).toMatchObject({
      reach: { email: true },
      yours: { lead: 'undone' },
    });
  });

  it('removes the button or the words when Email is turned by hand, and keeps them for the other two', () => {
    expect(saved(startOf('messagesFromEmail'), 'email')).toMatchObject({
      reach: { email: false, saved: 'email' },
      yours: { lead: null },
    });
    expect(saved(startOf('messagesStopped'), 'email').yours?.lead).toBeNull();
    expect(saved(startOf('messagesStopped'), 'sms').yours?.lead).toBe('stopped');
  });

  it('ignores every press while a save is recorded, and a switch waits too', () => {
    const busy = startOf('messagesStopSaving');

    expect(saving(busy, 'stop')).toEqual({});
    expect(saving(busy, 'undo')).toEqual({});
    expect(switchPressed(busy, 'sms')).toEqual({});
    expect(switchPressed(startOf('messagesSwitchSaving'), 'sms')).toEqual({});
    expect(switchPressed(startOf('messagesFromEmail'), 'sms')).toMatchObject({
      reach: { sms: false, saved: 'sms' },
    });
  });

  it('never shows a failed save as made: the change is not applied and the failed line names the press', () => {
    const from = startOf('messagesFromEmail');
    const failed = { ...from, ...saving(from, 'stop'), ...notSaved(from, 'stop') };

    expect(failed.reach).toEqual(from.reach);
    expect(failed.yours).toMatchObject({ lead: 'button', busy: null, failed: 'stop' });
  });

  it('keeps the failed line through Try again, and any other change removes it', () => {
    const failed = startOf('messagesStopFailed');

    expect(saving(failed, 'stop', true).yours).toMatchObject({
      busy: 'stop',
      retrying: true,
      failed: 'stop',
    });
    expect(saving(failed, 'undo').yours?.failed).toBeNull();
    expect(switchPressed(failed, 'sms').yours?.failed).toBeNull();
    expect(saved(failed, 'stop').yours).toMatchObject({ failed: null, retrying: false });
  });

  it('lands a held save on what it was recording, focus where the press left it', () => {
    expect(landed(startOf('messagesStopSaving')).yours?.lead).toBe('stopped');
    expect(landed(startOf('messagesUndoSaving')).yours?.lead).toBe('undone');
    expect(landed(startOf('messagesSwitchSaving')).reach).toMatchObject({
      sms: false,
      saved: 'sms',
    });
    expect([focusAfter('stop'), focusAfter('undo'), focusAfter('sms')]).toEqual([
      'yoursLead',
      'yoursLead',
      'switch-sms',
    ]);
  });

  it('opens from the guest’s way in with the switches alone and no line from before', () => {
    const was = { ...startOf('coming'), ...saved(startOf('messagesStopped'), 'sms') };

    expect(openedFromPage(was)).toMatchObject({
      page: 'messages',
      reach: { saved: null },
      yours: { from: 'page', lead: null, busy: null, failed: null },
    });
    expect(wayInState(startOf('coming'))).toBe('messagesNoMobile');
    expect(wayInState(startOf('comingWhatsApp'))).toBe('messagesWhatsAppOn');
    expect(wayInState(startOf('checkWhatsApp'))).toBe('messagesWhatsAppOff');
  });

  it('writes the story’s settled words', () => {
    const words = wordsFor('en');

    expect(words.stopEmails).toBe('Stop emails from Ire Events');
    expect(words.lead('stopped')).toBe('You won’t get emails from Ire Events any more.');
    expect(words.lead('undone')).toBe('Emails from Ire Events are on again.');
    expect(words.undo).toBe('Undo');
    expect(words.saving).toBe('Saving…');
    expect(words.saveFailed).toBe('Saving did not work. Nothing has changed.');
    expect(words.retry).toBe('Try again');
    expect(words.noEmail).toBe('Ire Events has no email address for you.');
    expect(words.savedLine('sms', false)).toBe('Texts from Ire Events are off.');
    expect(words.savedLine('sms', true)).toBe('Texts from Ire Events are on again.');
    expect(words.savedLine('email', false)).toBe('Emails from Ire Events are off.');
    expect(words.linkBroken).toBe('This link does not work');
    expect(words.linkBrokenBody).toBe(
      'Nothing has changed. Open the link again from the most recent email you were sent.',
    );
    expect(words.wayIn).toBe('Choose how Ire Events can reach you');
  });
});
