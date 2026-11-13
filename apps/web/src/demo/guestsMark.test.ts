import { describe, expect, it } from 'vitest';

import { WEDDING, sampleGuests } from './guests.ts';
import {
  MARK_STATES,
  MW,
  companionsWith,
  lineWords,
  markMany,
  markStart,
  pressMark,
  waiting,
} from './guestsMark.ts';

const list = sampleGuests(WEDDING);
const notYet = list.filter(waiting);
const invited = list.filter((one) => !waiting(one) && one.reply !== 'walkIn');
const none = { removed: [], invited: [] };

describe('pressing Mark as invited', () => {
  it('asks how, counting only the guests it will mark', () => {
    const selected = new Set([...notYet.slice(0, 3), ...invited.slice(0, 2)].map((one) => one.id));

    expect(pressMark(list, selected)).toEqual({
      kind: 'ask',
      marks: 3,
      already: invited.slice(0, 2).map((one) => one.name),
    });
  });

  it('opens nothing when everyone selected is already invited', () => {
    const selected = new Set(invited.slice(0, 4).map((one) => one.id));

    expect(pressMark(list, selected)).toEqual({ kind: 'nothing', already: 4 });
    expect(MW.nothingToMark(4)).toBe('4 already invited. Nothing to mark.');
  });

  it('opens nothing over 2,000', () => {
    expect(pressMark(list, new Set([notYet[0]?.id ?? '']), 2001)).toEqual({ kind: 'over' });
    expect(pressMark(list, new Set([notYet[0]?.id ?? '']), 2000).kind).toBe('ask');
  });
});

describe('the dialog’s words', () => {
  it('counts in its title', () => {
    expect(MW.title(1)).toBe('Mark 1 guest as invited');
    expect(MW.title(14)).toBe('Mark 14 guests as invited');
  });

  it('names at most five already invited, then the rest as a count', () => {
    expect(MW.already(['Ada Obi'])).toBe('1 already invited, who stays as recorded: Ada Obi.');
    expect(MW.already(['Ada Obi', 'Tunde Bakare'])).toBe(
      '2 already invited, who stay as recorded: Ada Obi and Tunde Bakare.',
    );
    expect(MW.already(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toBe(
      '7 already invited, who stay as recorded: A, B, C, D, E and 2 more.',
    );
  });
});

describe('marking many', () => {
  it('marks only the Not yet invited, leaving the invited as recorded', () => {
    const keep = invited[0];
    const selected = new Set([notYet[0]?.id ?? '', notYet[1]?.id ?? '', keep?.id ?? '']);
    const done = markMany(list, selected, 'WhatsApp', '2026-11-03', none);

    expect(done.line).toEqual({ kind: 'done', marked: 2, already: 1, removed: 0, how: 'WhatsApp' });
    expect(done.list.find((one) => one.id === notYet[0]?.id)?.invited).toEqual({
      by: 'Folake Adeyemi',
      how: 'WhatsApp',
      on: '2026-11-03',
    });
    expect(done.list.find((one) => one.id === keep?.id)).toEqual(keep);
    expect(lineWords(done.line)).toEqual([
      '2 marked as invited, WhatsApp.',
      '1 already invited, kept as recorded.',
    ]);
  });

  it('leaves the second sentence out when nobody was already invited', () => {
    const done = markMany(list, new Set([notYet[0]?.id ?? '']), 'Other', '2026-11-03', none);

    expect(lineWords(done.line)).toEqual(['1 marked as invited, another way.']);
  });

  it('counts a guest removed meanwhile, and one invited meanwhile as already invited', () => {
    const [gone, late, fresh] = notYet;
    const selected = new Set([gone?.id ?? '', late?.id ?? '', fresh?.id ?? '']);
    const done = markMany(list, selected, 'Email', '2026-11-03', {
      removed: [gone?.id ?? ''],
      invited: [late?.id ?? ''],
    });

    expect(done.line).toEqual({ kind: 'done', marked: 1, already: 1, removed: 1, how: 'Email' });
    expect(done.list.some((one) => one.id === gone?.id)).toBe(false);
    expect(lineWords(done.line)).toEqual([
      '1 marked as invited, email.',
      '1 already invited, kept as recorded.',
      '1 not changed: someone else removed them.',
    ]);
  });

  it('counts companions under the bar, never as guests', () => {
    const host = list.find((one) => one.companions.length > 0);

    expect(companionsWith(list, new Set([host?.id ?? '']))).toBe(host?.companions.length);
    expect(pressMark(list, new Set([host?.id ?? ''])).kind).not.toBe('over');
  });
});

describe('the states', () => {
  it('every state opens on the wedding with what it names', () => {
    for (const { key } of MARK_STATES) expect(markStart(key).event).toBe(WEDDING);
    expect(markStart('askAlready').selected).toHaveLength(14);
    expect(markStart('over').pretend).toBe(2140);
    expect(markStart('markedRemoved').line).toMatchObject({ removed: 1 });
  });
});
