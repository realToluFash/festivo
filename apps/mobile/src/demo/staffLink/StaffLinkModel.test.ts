import { describe, expect, it } from 'vitest';

import {
  LINK_STATES,
  NOW,
  YOU,
  W,
  askReplace,
  backFromShare,
  copiedNow,
  copyRefused,
  linkStateOf,
  markSent,
  notIssued,
  notYet,
  offersMarkSent,
  offersReplace,
  pressed,
  replace,
  seed,
  trailLine,
} from './StaffLinkModel.ts';

describe('one person’s link in the app (sc-3912)', () => {
  it('asks whether it went on the way back from the share sheet, and reads Shared', () => {
    const s = backFromShare(pressed(seed('none'), 'share'));
    expect(s.status).toBe('shared');
    expect(s.asking).toBe(true);
    expect(s.say).toBe('Did you send it to Ada?');
    expect(trailLine(s.status, s.trail)).toBe(`Shared by ${YOU} · ${NOW} · not marked as sent`);
    expect(offersMarkSent(s)).toBe(false);
    expect(offersMarkSent(notYet(s))).toBe(true);
  });

  it('marks as sent from the question', () => {
    const s = markSent(seed('asking'));
    expect(s.status).toBe('sent');
    expect(s.asking).toBe(false);
    expect(trailLine(s.status, s.trail)).toBe(`Marked as sent by ${YOU} · ${NOW}`);
  });

  it('says Link copied. after a copy, and offers Mark as sent', () => {
    const s = copiedNow(pressed(seed('none'), 'copy'));
    expect(s.status).toBe('copied');
    expect(s.say).toBe(W.copied);
    expect(offersMarkSent(s)).toBe(true);
  });

  it('still records a copy the clipboard refused, without saying Link copied.', () => {
    const s = copyRefused(pressed(seed('none'), 'copy'));
    expect(s.status).toBe('copied');
    expect(s.busy).toBeNull();
    expect(s.say).not.toBe(W.copied);
    expect(offersMarkSent(s)).toBe(true);
  });

  it('opens Replace link with an ellipsis, since it asks first', () => {
    expect(W.replaceOpen).toBe('Replace link…');
    expect(W.replaceTitle('Ada')).toBe('Replace Ada’s link?');
  });

  it('records nothing when no link is issued, and keeps the status', () => {
    const before = seed('sent');
    const s = notIssued(pressed(before, 'share'));
    expect(s.status).toBe('sent');
    expect(s.trail).toEqual(before.trail);
    expect(s.say).toBe('That did not work. Try again in a moment.');
  });

  it('never moves Link sent or Link opened back on a new delivery', () => {
    expect(copiedNow(seed('opened')).status).toBe('opened');
    expect(backFromShare(seed('sent'))).toMatchObject({ status: 'sent', asking: false });
  });

  it('takes one press at a time', () => {
    const busy = pressed(seed('none'), 'share');
    expect(pressed(busy, 'copy')).toBe(busy);
  });

  it('asks before Replace link, then puts the row back to No link yet', () => {
    const asked = askReplace(seed('opened'), true);
    expect(asked.replacing).toBe(true);
    const s = replace(asked);
    expect(s).toMatchObject({ status: 'none', trail: null, replacing: false });
    expect(offersReplace(s)).toBe(false);
    expect(offersReplace(seed('copied'))).toBe(true);
  });

  it('opens every state by name, and an unknown one as No link yet', () => {
    for (const name of LINK_STATES) expect(linkStateOf(name)).toBe(name);
    expect(linkStateOf('nope')).toBe('none');
    expect(seed('replaceAsk').replacing).toBe(true);
    expect(seed('notIssued').issueFails).toBe(true);
  });
});
