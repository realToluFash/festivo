import { describe, expect, it } from 'vitest';

import {
  LINK_STATES,
  NOW,
  PERSON,
  SAMPLE_LINK,
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

  it('records a copy the clipboard refused and holds the link in a field, as the AC says', () => {
    const s = copyRefused(pressed(seed('none'), 'copy'), SAMPLE_LINK);
    expect(s.status).toBe('copied');
    expect(s.busy).toBeNull();
    expect(s.failed).toBe(false);
    expect(s.held).toBe(SAMPLE_LINK);
    expect(s.say).toBe('The link could not be copied. Copy it from the link field.');
    expect(W.linkFor(PERSON.name)).toBe('Link for Ada Obi');
    expect(offersMarkSent(s)).toBe(true);
  });

  it('lets the held link go once it is marked as sent, replaced or pressed again', () => {
    const s = seed('refused');
    expect(s.held).toBe(SAMPLE_LINK);
    expect(markSent(s).held).toBeNull();
    expect(replace(s).held).toBeNull();
    expect(pressed(s, 'copy').held).toBeNull();
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
