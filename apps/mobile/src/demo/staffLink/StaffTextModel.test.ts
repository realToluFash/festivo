import { describe, expect, it } from 'vitest';

import { seed, trailLine } from './StaffLinkModel.ts';
import { sampleRoster } from './StaffRosterModel.ts';
import {
  BALANCE,
  afterText,
  checkOf,
  creditsFor,
  offersText,
  resultLine,
  sendAll,
  textRoster,
  textSeed,
} from './StaffTextModel.ts';

describe('texting a staff link (sc-77904)', () => {
  it('offers Text the link only once SMS is in', () => {
    expect(offersText(seed('none'))).toBe(false);
    expect(offersText(textSeed('smsOn'))).toBe(true);
  });

  it('records Link sent by you and says the text went', () => {
    const s = afterText(textSeed('smsOn'));
    expect(s.status).toBe('sent');
    expect(trailLine(s.status, s.trail)).toBe('Sent by Amara Nwosu · 19:12');
    expect(s.say).toBe('Text sent to Ada Obi.');
    expect(s.texting?.credits).toBe(BALANCE - creditsFor());
  });

  it('keeps Link opened when an opened link is texted again', () => {
    expect(textSeed('textOpened').status).toBe('opened');
  });

  it('keeps the status when the text is not sent or is held', () => {
    const failed = afterText(textSeed('textNotSent'));
    expect(failed.status).toBe('none');
    expect(failed.failed).toBe(true);
    const held = textSeed('textHeld');
    expect(held.status).toBe('none');
    expect(held.texting?.note).toBe('held');
    expect(offersText(held)).toBe(false);
  });

  it('sends at quiet hours, as proposed in #77921, unless the switch holds it', () => {
    expect(textSeed('quiet').status).toBe('sent');
    expect(textSeed('quietWaits').texting?.note).toBe('waits');
  });

  it('offers nothing to text with stopped texts, or without staff.manage', () => {
    expect(offersText(textSeed('stopped'))).toBe(false);
    expect(offersText(textSeed('smsReadOnly'))).toBe(false);
  });
});

describe('Text links to {n} (sc-77904)', () => {
  it('counts the five owed a link and the one with no number', () => {
    const check = checkOf(sampleRoster(), BALANCE);
    expect(check.n).toBe(5);
    expect(check.m).toBe(1);
    expect(check.uses).toBe(310);
    expect(check.after).toBe(1190);
    expect(check.wait).toBe(0);
  });

  it('says what waits when the credits fall short', () => {
    const check = checkOf(sampleRoster(), 150);
    expect(check.afford).toBe(2);
    expect(check.after).toBe(26);
    expect(check.wait).toBe(3);
  });

  it('leaves the second sentence out at 0', () => {
    expect(resultLine(5, 1, 0, 0)).toBe('Sent to 5. 1 has no mobile number.');
    expect(resultLine(5, 0, 0, 0)).toBe('Sent to 5.');
    expect(resultLine(2, 1, 0, 3)).toBe(
      'Sent to 2. 3 are held: no credits. 1 has no mobile number.',
    );
    expect(resultLine(4, 1, 1, 0)).toBe('Sent to 4. 1 has no mobile number and 1 stopped texts.');
  });

  it('moves the sent forward and holds the rest', () => {
    const sent = sendAll(sampleRoster(), 150);
    expect(sent.people.filter((p) => p.trail?.via === 'text')).toHaveLength(2);
    expect(sent.people.filter((p) => p.held === true)).toHaveLength(3);
    expect(checkOf(sent.people, sent.credits).n).toBe(0);
  });

  it('hides the button once everyone with a number has been sent one', () => {
    const none = textRoster('bulkNone');
    expect(none == null ? -1 : checkOf(none.people, none.credits).n).toBe(0);
    expect(textRoster('populated')).toBeNull();
  });
});
