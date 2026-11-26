import { describe, expect, it } from 'vitest';

import {
  BW,
  BRIEFING_STATES,
  RULES_MAX,
  afterBriefCopy,
  afterBriefMark,
  afterOpen,
  briefingStart,
  checkOf,
  codePoints,
  countLine,
  dueAll,
  dueChanged,
  fitRules,
  noMobileFor,
  noteOf,
  people,
  resultLines,
  sendTo,
  tallyOf,
} from './briefingModel.ts';

const one = (id: string) => people().find((person) => person.id === id)!;

describe('the briefing’s counts (sc-3917)', () => {
  it('counts the tally from the rows, and {n} from people with a number and a shift, not sent and not held', () => {
    expect(tallyOf(people())).toEqual({ read: 3, sent: 2, changed: 2, none: 5 });
    expect(dueAll(people()).map((p) => p.id)).toEqual(['tolu', 'amina', 'emeka']);
    expect(dueChanged(people()).map((p) => p.id)).toEqual(['sade', 'kunle']);
  });

  it('leaves held people out of both counts', () => {
    const held = people().map((p) =>
      p.id === 'amina' || p.id === 'kunle' ? { ...p, heldText: true } : p,
    );
    expect(dueAll(held).map((p) => p.id)).toEqual(['tolu', 'emeka']);
    expect(dueChanged(held).map((p) => p.id)).toEqual(['sade']);
  });

  it('says why a person gets nothing', () => {
    expect(noteOf(one('ada'))).toBe(BW.noMobile);
    expect(noteOf(one('chinedu'))).toBe(BW.noShift);
    expect(noteOf({ ...one('tolu'), heldText: true })).toBe(BW.held);
    expect(noteOf(one('tolu'))).toBeNull();
  });
});

describe('a copy from the briefing', () => {
  it('leaves the briefing state as it was, and turns No link yet into Copied', () => {
    const copied = afterBriefCopy(one('tolu'));
    expect(copied.brief).toBe('none');
    expect(copied.status).toBe('copied');
    expect(dueAll([copied])).toHaveLength(1);
  });

  it('leaves Link sent as it was', () => {
    expect(afterBriefCopy(one('tayo')).status).toBe('sent');
  });

  it('after Mark as sent reads Sent, not read and Link sent, and leaves both counts', () => {
    const marked = afterBriefMark(afterBriefCopy(one('sade')));
    expect(marked.brief).toBe('sent');
    expect(marked.status).toBe('sent');
    expect(dueChanged([marked])).toHaveLength(0);
  });

  it('withdraws a held text on Mark as sent, and keeps it on a copy alone', () => {
    const held = { ...one('amina'), heldText: true };
    expect(afterBriefCopy(held).heldText).toBe(true);
    expect(afterBriefMark(afterBriefCopy(held)).heldText).toBe(false);
  });

  it('reads Read once the link is opened after a copy, and Link opened never goes back', () => {
    const opened = afterOpen(afterBriefCopy(one('tolu')));
    expect(opened.brief).toBe('read');
    expect(afterBriefMark(afterBriefCopy(opened)).status).toBe('opened');
  });
});

describe('the check before sending and the send', () => {
  it('pays each text in roster order while the balance covers it, and the rest wait by channel', () => {
    const list = people();
    const check = checkOf(dueAll(list), noMobileFor(list, 'all'), 70);
    expect(check.paid).toEqual(['tolu']);
    expect(check.smsWaits).toBe(1);
    expect(check.whatsAppWaits).toBe(1);
    expect(check.after).toBe(8);
    expect(check.noMobile).toBe(1);
  });

  it('holds what it cannot pay, never fails it, and sets Link sent for a text that goes', () => {
    const list = people();
    const due = dueAll(list);
    const sent = sendTo(list, due, checkOf(due, noMobileFor(list, 'all'), 70));
    expect(sent.sent).toBe(1);
    expect(sent.held).toEqual(['amina', 'emeka']);
    const tolu = sent.people.find((p) => p.id === 'tolu')!;
    expect(tolu.brief).toBe('sent');
    expect(tolu.status).toBe('sent');
    expect(dueAll(sent.people)).toHaveLength(0);
  });

  it('leaves the no-number line out at 0, and words each count as a plural', () => {
    expect(resultLines(3, 0, 0)).toEqual(['Sent to 3.']);
    expect(resultLines(1, 1, 2)).toEqual([
      'Sent to 1.',
      '1 has no mobile number.',
      '2 held: no credits.',
    ]);
    expect(resultLines(2, 3, 1)[1]).toBe('3 have no mobile number.');
    expect(BW.smsWaits(1)).toBe('1 SMS message will wait for credits.');
    expect(BW.whatsAppWaits(2)).toBe('2 WhatsApp messages will wait for credits.');
  });
});

describe('house rules', () => {
  it('counts code points, as the server does', () => {
    expect(codePoints('Ọ̀')).toBe(2);
    expect(codePoints('😀')).toBe(1);
  });

  it('shows the count from 1,800, and the limit at 2,000', () => {
    expect(countLine('a'.repeat(1799))).toBeNull();
    expect(countLine('a'.repeat(1918))).toEqual({ words: BW.count(1918), limit: false });
    expect(countLine('a'.repeat(RULES_MAX))).toEqual({ words: BW.atLimit, limit: true });
    expect(BW.count(1918)).toBe('[1,918 of 2,000 characters]');
  });

  it('keeps the first 2,000 of a paste and says so, and takes no more keys at the limit', () => {
    const pasted = fitRules('', '😀'.repeat(2001));
    expect(codePoints(pasted.text)).toBe(RULES_MAX);
    expect(pasted.cut).toBe(true);
    const full = 'a'.repeat(RULES_MAX);
    expect(fitRules(full, `${full}b`)).toEqual({ text: full, cut: false });
    expect(fitRules(full, `b${full}`)).toEqual({ text: full, cut: false });
  });
});

describe('the no-number line', () => {
  it('counts only the people the send is for', () => {
    const list = people();
    expect(noMobileFor(list, 'all')).toBe(1);
    expect(noMobileFor(list, 'changed')).toBe(0);
    expect(noMobileFor(list, 'sade')).toBe(0);
  });
});

describe('the demo’s states', () => {
  it('opens every state', () => {
    for (const state of BRIEFING_STATES) expect(briefingStart(state).title).not.toBe('');
  });
});

describe('the check’s lines', () => {
  it('count what is paid per channel, and add up to the total', () => {
    const list = people();
    const check = checkOf(dueAll(list), noMobileFor(list, 'all'), 70);
    expect(check.sms).toEqual({ n: 1, credits: 62 });
    expect(check.whatsApp).toEqual({ n: 0, credits: 0 });
    expect(check.credits).toBe(62);
  });
});
