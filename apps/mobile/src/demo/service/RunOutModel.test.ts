import { describe, expect, it } from 'vitest';

import { seed, shownSummary } from './HowItsGoingModel.ts';
import {
  alertsOf,
  isBehind,
  roomSeed,
  sectionBehind,
  stateWord,
  tableOf,
  WORD_ORDER,
  wordOf,
} from './ServiceRoomModel.ts';

import {
  type Bulk,
  type Can,
  type RunOut,
  NO_MANAGE_LINE,
  RUN_OUT_STATES,
  alertOf,
  answer,
  askOne,
  askedNow,
  bulkRows,
  cancel,
  changed,
  confirmBulk,
  confirmNote,
  confirmTitle,
  countLine,
  countsWith,
  covered,
  fresh,
  lateArrival,
  leftEachWithout,
  leftOut,
  markAvailable,
  nowLine,
  openChoose,
  openPanel,
  options,
  pick,
  pressBulk,
  runOutSeed,
  startDishing,
  sum,
  waiting,
} from './RunOutModel.ts';

const LEAD: Can = { online: true, manage: true };
const BEEF: Bulk = { kind: 'serve', item: 'Beef' };
const FISH: Bulk = { kind: 'serve', item: 'Grilled fish' };
const WITHOUT: Bulk = { kind: 'without' };
const BASE = { due: 194, served: 108, onTray: 15, kitchen: 21, toServe: 50, notHere: 6 };

const names = (r: RunOut, c: Bulk) => covered(r, c).map((g) => g.name.split(' ')[0]);
const firstNames = (gs: { name: string }[]) => gs.map((g) => g.name.split(' ')[0]);
const guest = (r: RunOut, id: string) => {
  const g = r.guests.find((x) => x.id === id);
  if (g == null) throw new Error(`no guest ${id}`);
  return g;
};
const confirmed = (r: RunOut, c: Bulk) => confirmBulk(pressBulk(r, LEAD, c), LEAD);

describe('who waits, and who a bulk choice covers', () => {
  it('lists the waiting guests flagged first, then by table and seat', () => {
    expect(firstNames(waiting(fresh()))).toEqual([
      'Funke',
      'Hauwa',
      'Kemi',
      'Adaora',
      'Bayo',
      'Tunde',
      'Yemi',
      'Musa',
      'Emeka',
    ]);
  });

  it('covers four with Serve Beef: never a flagged guest, never Musa who already has Beef', () => {
    expect(names(fresh(), BEEF)).toEqual(['Bayo', 'Tunde', 'Yemi', 'Emeka']);
  });

  it('covers five with Serve Grilled fish, and four with Serve without Chicken, leaving Bayo whose plate it would empty', () => {
    expect(names(fresh(), FISH)).toEqual(['Bayo', 'Tunde', 'Yemi', 'Musa', 'Emeka']);
    expect(names(fresh(), WITHOUT)).toEqual(['Tunde', 'Yemi', 'Musa', 'Emeka']);
  });

  it('confirms with the number covered, or for guests still to come, never 0', () => {
    expect(confirmTitle(fresh(), BEEF)).toBe('Serve Beef to 4 guests instead of Chicken?');
    const later = runOutSeed('runOutConfirmLater');
    expect(later.confirm).toEqual(FISH);
    expect(confirmTitle(later, FISH)).toBe(
      'Serve Grilled fish instead of Chicken for guests still to come?',
    );
  });
});

describe('a bulk choice', () => {
  it('changes the guests it covers and stands as a line for guests still to come', () => {
    const r = confirmed({ ...fresh(), panel: true }, BEEF);
    expect(firstNames(waiting(r))).toEqual(['Funke', 'Hauwa', 'Kemi', 'Adaora', 'Musa']);
    expect(nowLine(guest(r, 'tb'))).toBe('Now Beef');
    expect(bulkRows(r).map((b) => [b.label, b.stands])).toEqual([
      ['Serve Jollof rice', false],
      ['Serve Beef', true],
      ['Serve Grilled fish', false],
      ['Serve without Chicken', false],
      ['Ask each guest', false],
    ]);
  });

  it('keeps at most one standing choice, a second replacing the first', () => {
    const r = confirmed(confirmed(fresh(), BEEF), FISH);
    expect(
      bulkRows(r)
        .filter((b) => b.stands)
        .map((b) => b.label),
    ).toEqual(['Serve Grilled fish']);
  });

  it('covers a late arrival at once under a standing choice, with no alert', () => {
    const r = lateArrival(confirmed(fresh(), BEEF));
    expect(nowLine(guest(r, 'bi'))).toBe('Now Beef');
    expect(r.raised).toBe(1);
  });

  it('raises the alert again for a late arrival nothing covers', () => {
    const r = lateArrival(fresh());
    expect(waiting(r).map((g) => g.id)).toContain('bi');
    expect(r.raised).toBe(2);
    expect(r.say).toBe('Chicken has run out. Grill · 10 waiting for a choice.');
  });
});

describe('choosing for one guest', () => {
  it('refuses what a flag conflicts with and leaves out what is already on the plate', () => {
    const r = runOutSeed('runOutChooseFor');
    const funke = options(guest(r, 'fa'));
    expect(funke.map((o) => [o.label, o.no?.line ?? '', o.no?.note ?? ''])).toEqual([
      ['Serve Beef', 'Not for Funke Adeyemi · Fish allergy', 'Beef’s allergens aren’t stated'],
      ['Serve Grilled fish', 'Not for Funke Adeyemi · Fish allergy', ''],
      ['Serve without Chicken', '', ''],
    ]);
  });

  it('refuses nothing for a diet or an Other allergy', () => {
    expect(options(guest(fresh(), 'hs')).every((o) => o.no == null)).toBe(true);
    expect(options(guest(fresh(), 'ae')).every((o) => o.no == null)).toBe(true);
  });

  it('will not choose a refused item', () => {
    const r = openChoose(fresh(), LEAD, 'fa');
    expect(pick(r, LEAD, 'Grilled fish').guests).toEqual(r.guests);
  });

  it('chooses again while the plate is at To serve, and refuses from Dishing (409)', () => {
    const r = pick(openChoose(fresh(), LEAD, 'sm'), LEAD, 'Grilled fish');
    expect(nowLine(guest(r, 'sm'))).toBe('Now Grilled fish');
    const dishing = openChoose(fresh(), LEAD, 'ne');
    expect(dishing.choosing).toBeNull();
    expect(dishing.refused).toBe(
      'Ngozi Eze’s plate is already being dished, so their choice stays as it is.',
    );
    const late = pick(startDishing(openChoose(fresh(), LEAD, 'sm'), 'sm'), LEAD, 'Grilled fish');
    expect(nowLine(guest(late, 'sm'))).toBe('Now Beef');
    expect(late.refused).toContain('Sola Martins’s plate is already being dished');
  });
});

describe('the counts', () => {
  it('moves the waiting guests out of To serve so the counts still add up', () => {
    const c = countsWith(BASE, fresh());
    expect(c).toEqual({ ...BASE, choice: 9, toServe: 41 });
    expect(sum(c)).toBe(194);
  });

  it('counts a guest moved to a Ready substitute as To serve', () => {
    const c = countsWith(BASE, confirmed(fresh(), FISH));
    expect([c.choice, c.kitchen, c.toServe]).toEqual([4, 21, 46]);
    expect(sum(c)).toBe(194);
  });

  it('adds a late arrival to the guests due and takes him from Not here yet', () => {
    const c = countsWith(BASE, lateArrival(fresh()));
    expect([c.due, c.notHere, c.choice]).toEqual([195, 5, 10]);
    expect(sum(c)).toBe(c.due);
  });

  it('leaves the guests waiting out of a section’s left each', () => {
    const r = fresh();
    expect(leftEachWithout(14, 1, leftOut(r, [3]))).toBe(13);
    expect(leftEachWithout(6, 3, leftOut(r, [9]))).toBe(5);
    expect(leftEachWithout(0, 0, leftOut(r, [12, 14]))).toBe(0);
  });
});

describe('marking it available again, and the refusals', () => {
  it('ends the run out: the alert and the count go, guests already changed keep theirs', () => {
    const r = runOutSeed('runOutAvailable');
    expect(alertOf(r)).toBeNull();
    expect(countsWith(BASE, r)).toMatchObject({ choice: 0, toServe: 50 });
    expect(changed(r).map((g) => nowLine(g))).toEqual(Array(6).fill('Now Beef'));
    expect(markAvailable(confirmed(fresh(), BEEF), LEAD).say).toBe('Chicken is available again.');
  });

  it('refuses offline before the panel opens, and without service.manage (403)', () => {
    expect(openPanel(fresh(), { online: false, manage: true })).toMatchObject({
      panel: false,
      refused: 'Needs a connection to choose. Nothing is kept to send later.',
    });
    expect(markAvailable(fresh(), { online: false, manage: true }).refused).toBe(
      'Needs a connection to mark Chicken available again. Nothing is kept to send later.',
    );
    expect(openPanel(fresh(), { online: true, manage: false })).toMatchObject({
      panel: false,
      refused: NO_MANAGE_LINE,
    });
  });

  it('seeds every state', () => {
    for (const name of RUN_OUT_STATES) expect(runOutSeed(name).guests.length).toBe(11);
    expect(alertOf(runOutSeed('runOutAlert'))).toEqual({
      title: 'Chicken has run out',
      sub: 'Grill · 9 waiting for a choice',
      count: '',
    });
  });
});

describe('asking each guest at their table (sc-59426)', () => {
  const ASK: Bulk = { kind: 'ask' };
  const panel = () => ({ ...fresh(), panel: true });

  it('asks every waiting guest, flagged guests included, and stands as a line', () => {
    const r0 = pressBulk(panel(), LEAD, ASK);
    expect(confirmTitle(r0, ASK)).toBe('Ask 9 guests at their tables?');
    const r = confirmBulk(r0, LEAD);
    expect(waiting(r).every((g) => g.asked)).toBe(true);
    expect(guest(r, 'fa').asked).toBe(true);
    expect(bulkRows(r).find((b) => b.bulk.kind === 'ask')?.stands).toBe(true);
    expect(bulkRows(r).filter((b) => !b.stands)).toHaveLength(4);
    expect(pressBulk(r, LEAD, ASK)).toBe(r);
  });

  it('cancel changes nothing', () => {
    const r = cancel(pressBulk(panel(), LEAD, ASK));
    expect(r.confirm).toBeNull();
    expect(askedNow(r)).toHaveLength(0);
    expect(r.stands).toBeNull();
  });

  it('asks one guest with Ask {name}, with no confirmation and nothing standing', () => {
    const r = askOne(panel(), LEAD, 'tb');
    expect(guest(r, 'tb').asked).toBe(true);
    expect(r.confirm).toBeNull();
    expect(r.stands).toBeNull();
    expect(countLine(r)).toBe('0 of 1 guest has chosen at the table');
  });

  it('confirms for guests still to come when everyone waiting is already asked', () => {
    const all = waiting(panel()).reduce((x, g) => askOne(x, LEAD, g.id), panel());
    expect(confirmTitle(all, ASK)).toBe('Ask guests still to come at their tables?');
  });

  it('leaves asked guests out of a Serve choice and says they stay asked', () => {
    const r = askOne(askOne(panel(), LEAD, 'tb'), LEAD, 'ya');
    expect(names(r, BEEF)).toEqual(['Bayo', 'Emeka']);
    expect(confirmTitle(r, BEEF)).toBe('Serve Beef to 2 guests instead of Chicken?');
    expect(confirmNote(r, BEEF)).toBe('Guests already asked at their tables stay asked');
    expect(confirmNote(panel(), BEEF)).toBe('');
    const after = confirmed(r, BEEF);
    expect(guest(after, 'tb').asked).toBe(true);
    expect(guest(after, 'tb').state).toBe('waiting');
  });

  it('a later Serve choice replaces a standing ask for guests still to come; those asked stay asked', () => {
    const r = confirmed(confirmed(panel(), ASK), BEEF);
    expect(r.stands).toEqual(BEEF);
    expect(askedNow(r)).toHaveLength(9);
  });

  it('counts the answers, leaving out a guest the lead chose for', () => {
    const asking = confirmed(panel(), ASK);
    expect(countLine(asking)).toBe('0 of 9 guests have chosen at the table');
    const r = answer(answer(asking, 'tb', 'Beef'), 'eo', 'Grilled fish');
    expect(countLine(r)).toBe('2 of 9 guests have chosen at the table');
    expect(nowLine(guest(r, 'tb'))).toBe('Now Beef');
    expect(firstNames(changed(r))).toContain('Tunde');
    const led = pick(openChoose(r, LEAD, 'fa'), LEAD, '');
    expect(guest(led, 'fa').asked).toBe(false);
    expect(countLine(led)).toBe('2 of 8 guests have chosen at the table');
    expect(alertOf(r)?.count).toBe('2 of 9 guests have chosen at the table');
  });

  it('refuses a conflicting answer and changes nothing', () => {
    const asking = confirmed(panel(), ASK);
    expect(answer(asking, 'fa', 'Grilled fish')).toBe(asking);
    expect(answer(asking, 'fa', 'Beef')).toBe(asking);
  });

  it('the alert leaves once the last asked guest has answered', () => {
    let r = confirmed(panel(), ASK);
    for (const g of waiting(r)) {
      const o = options(g).find((x) => x.no == null);
      if (o != null) r = answer(r, g.id, o.item);
    }
    expect(waiting(r)).toHaveLength(0);
    expect(alertOf(r)).toBeNull();
    expect(countLine(r)).toBe('');
  });

  it('asks a late arrival at once under a standing ask, with no alert raised', () => {
    const r0 = confirmed(panel(), ASK);
    const r = lateArrival(r0);
    expect(guest(r, 'bi').asked).toBe(true);
    expect(r.raised).toBe(r0.raised);
  });

  it('Mark available again ends every ask; answers stand', () => {
    const r = markAvailable(answer(confirmed(panel(), ASK), 'tb', 'Beef'), LEAD);
    expect(askedNow(r)).toHaveLength(0);
    expect(r.guests.some((g) => g.asked)).toBe(false);
    expect(nowLine(guest(r, 'tb'))).toBe('Now Beef');
    expect(answer(r, 'ya', 'Beef')).toBe(r);
  });

  it('refuses asking offline and without service.manage, keeping nothing', () => {
    const off = askOne(panel(), { online: false, manage: true }, 'tb');
    expect(off.refused).toBe('Needs a connection to ask. Nothing is kept to send later.');
    expect(guest(off, 'tb').asked).toBe(false);
    expect(askOne(panel(), { online: true, manage: false }, 'tb').refused).toBe(NO_MANAGE_LINE);
  });
});

describe('How it’s going and the room with Chicken run out', () => {
  it('counts Waiting for a choice first and leaves it out of To serve and left each', () => {
    const sum = shownSummary(seed('runOutAlert'));
    expect(sum.course).toMatchObject({
      choice: 9,
      onTray: 15,
      kitchen: 7,
      toServe: 55,
      served: 108,
    });
    const each = Object.fromEntries(sum.sections.map((x) => [x.id, x.leftEach]));
    expect(each).toMatchObject({ A: 13, B: 5, D: 7, E: 4 });
    const grill = sum.kitchen
      .filter((k) => k.item === 'Chicken' || k.item === 'Beef')
      .map((k) => [k.item, k.state, k.waiting]);
    expect(grill).toEqual([
      ['Chicken', 'Run out', 9],
      ['Beef', 'Ready', 0],
    ]);
  });

  it('has Grilled fish Ready with nobody waiting on it, its 14 guests To serve, only in the run-out states', () => {
    const sum = shownSummary(seed('runOutAlert'));
    expect(sum.kitchen.find((k) => k.item === 'Grilled fish')).toMatchObject({
      state: 'Ready',
      heldUpMin: null,
      waiting: 0,
    });
    expect(sum.alerts.some((a) => a.kind === 'heldUp')).toBe(false);
    const toServe = Object.fromEntries(sum.sections.map((x) => [x.id, x.toServe]));
    expect(toServe).toMatchObject({ A: 16, B: 16, D: 14, C: 18, E: 0 });
    const c = sum.course;
    expect(c.choice + c.onTray + c.kitchen + c.toServe + c.served).toBe(c.due);
    const own = shownSummary(seed('populated'));
    expect(own.kitchen.find((k) => k.item === 'Grilled fish')?.state).toBe('Preparing');
    expect(own.alerts.some((a) => a.kind === 'heldUp')).toBe(true);
  });

  it('puts Chicken back to Ready once it is available again', () => {
    const sum = shownSummary(seed('runOutAvailable'));
    expect(sum.course).toMatchObject({ choice: 0, kitchen: 7, toServe: 64 });
    expect(sum.kitchen.find((k) => k.item === 'Chicken')?.state).toBe('Ready');
  });

  it('lists an earlier course’s run-out item at its station, after its current-course items (pm, 17 Nov)', () => {
    const sum = shownSummary(seed('runOutEarlier'));
    const items = sum.kitchen.map((k) => k.item);
    expect(items.indexOf('Small chops')).toBe(items.indexOf('Plantain') + 1);
    expect(sum.kitchen.find((k) => k.item === 'Small chops')).toMatchObject({
      course: 'Starter',
      station: 'Fryer',
      state: 'Run out',
      waiting: 1,
    });
    expect(sum.course).toEqual(shownSummary(seed('runOutAlert')).course);
  });

  it('lets a held guest add no wait toward Behind on How it’s going (sc-4026)', () => {
    const behind = (name: Parameters<typeof seed>[0]) => {
      const sum = shownSummary(seed(name));
      return [
        sum.sections.filter((x) => x.behind).map((x) => x.id),
        sum.alerts.filter((a) => a.kind === 'behind').map((a) => a.table),
      ];
    };
    expect(behind('runOutAlert')).toEqual([['B'], ['Table 8']]);
    expect(behind('runOutStands')).toEqual([['B'], ['Table 8']]);
    expect(behind('runOutAvailable')).toEqual([
      ['C', 'B'],
      ['Table 8', 'Table 12'],
    ]);
  });

  it('lets a held guest add no wait toward Behind on the Plan: table 9 is not Behind, Section B is on table 8', () => {
    const r = roomSeed('runOutPlan');
    const nine = tableOf(r, 9);
    expect(nine == null ? true : isBehind(nine)).toBe(false);
    expect(sectionBehind(r.tables, 'B')).toBe(true);
    const b = alertsOf(r.tables).find((a) => a.id === 'behind-B');
    expect(b?.table).toBe(8);
  });

  it('reads Waiting for a choice on the Plan, second after Behind (pm, 17 Nov)', () => {
    const r = roomSeed('runOutPlan');
    const word = (n: number) => {
      const t = tableOf(r, n);
      return t == null ? '' : stateWord(t);
    };
    expect([3, 9, 12, 14].map(word)).toEqual(Array(4).fill('Waiting for a choice'));
    expect(word(2)).toBe('On a tray');
    expect(WORD_ORDER.slice(0, 3)).toEqual(['behind', 'choice', 'serve']);
  });

  it('keeps Behind on a table Behind by its other guests, a guest waiting for a choice or not', () => {
    const nine = tableOf(roomSeed('runOutPlan'), 9);
    if (nine == null) throw new Error('table 9');
    const late = { ...nine, waitUnheld: 25 };
    expect(isBehind(late)).toBe(true);
    expect(wordOf(late)).toBe('behind');
    expect(wordOf(nine)).toBe('choice');
  });
});
