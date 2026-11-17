import { describe, expect, it } from 'vitest';

import { sample } from './howItsGoing.ts';
import {
  type Access,
  LATE,
  askBulk,
  bulkRows,
  changed,
  chooseFor,
  confirmBulk,
  confirmTitle,
  conflict,
  covered,
  lateArrival,
  markAvailable,
  markRunOutAgain,
  nowLine,
  offlineLine,
  openPanel,
  options,
  runOutSample,
  runOutTables,
  waiting,
  withRunOut,
} from './runOut.ts';
import { alertsOf, room, wordOf } from './serviceRoom.ts';

const LEAD: Access = { online: true, manage: true };
const names = (xs: readonly { name: string }[]) => xs.map((x) => x.name);
const guest = (id: string) => runOutSample().guests.find((x) => x.id === id)!;
const beef = { kind: 'serve', item: 'Beef' } as const;
const fish = { kind: 'serve', item: 'Grilled fish' } as const;
const without = { kind: 'without' } as const;
const settle = (bulk: typeof beef | typeof fish | typeof without, ro = runOutSample()) =>
  confirmBulk(askBulk(ro, bulk, LEAD), LEAD);

describe('who waits, and in what order (sc-59384)', () => {
  it('lists flagged guests first, then by table and seat', () => {
    expect(names(waiting(runOutSample()))).toEqual([
      'Funke Adeyemi',
      'Hauwa Sani',
      'Kemi Adebayo',
      'Adaora Eze',
      'Bayo Ojo',
      'Tunde Bakare',
      'Yemi Alabi',
      'Musa Bello',
      'Emeka Obi',
    ]);
  });
});

describe('a bulk choice serves everyone except flagged guests', () => {
  it('Serve Beef covers 4: never a flagged guest, never Musa Bello who has Beef', () => {
    const ro = runOutSample();
    expect(names(covered(ro, beef))).toEqual([
      'Bayo Ojo',
      'Tunde Bakare',
      'Yemi Alabi',
      'Emeka Obi',
    ]);
    expect(confirmTitle(ro, beef)).toBe('Serve Beef to 4 guests instead of Chicken?');
  });

  it('Serve Grilled fish covers 5', () => {
    expect(covered(runOutSample(), fish)).toHaveLength(5);
  });

  it('Serve without Chicken covers 4 and leaves Bayo Ojo listed, whose plate it would empty', () => {
    const ro = runOutSample();
    expect(confirmTitle(ro, without)).toBe('Serve without Chicken for 4 guests?');
    const after = settle(without, ro);
    expect(names(waiting(after))).toContain('Bayo Ojo');
    expect(names(waiting(after))).not.toContain('Musa Bello');
    expect(nowLine(after, guest('tb'))).toBe('Without Chicken');
  });

  it('confirms for guests still to come when it covers nobody waiting now, never 0', () => {
    const chosen = chooseFor(settle(beef), 'mb', 'Grilled fish', LEAD);
    expect(waiting(chosen).every((x) => x.flags.length > 0)).toBe(true);
    expect(confirmTitle(chosen, fish)).toBe(
      'Serve Grilled fish instead of Chicken for guests still to come?',
    );
    expect(confirmTitle(chosen, without)).toBe('Serve without Chicken for guests still to come?');
  });
});

describe('a bulk choice stands until the item is available again', () => {
  it('is one line, and every other bulk choice stays a button', () => {
    const rows = bulkRows(settle(beef));
    expect(rows.map((r) => [r.label, r.stands])).toEqual([
      ['Serve Jollof rice', false],
      ['Serve Beef', true],
      ['Serve Grilled fish', false],
      ['Serve without Chicken', false],
    ]);
  });

  it('covers a late arrival at once, with no alert raised', () => {
    const late = lateArrival(settle(beef));
    expect(nowLine(late, LATE)).toBe('Now Beef');
    expect(names(waiting(late))).not.toContain(LATE.name);
  });

  it('leaves a late arrival waiting, and raises the alert again, when nothing stands', () => {
    const late = lateArrival(runOutSample());
    expect(names(waiting(late))).toContain(LATE.name);
    expect(late.say).toBe('Chicken has run out. Grill · 10 waiting for a choice.');
  });

  it('is replaced by a later bulk choice for guests still to come; guests already changed keep theirs', () => {
    const later = settle(fish, settle(beef));
    expect(
      bulkRows(later)
        .filter((r) => r.stands)
        .map((r) => r.label),
    ).toEqual(['Serve Grilled fish']);
    expect(nowLine(later, guest('tb'))).toBe('Now Beef');
    expect(nowLine(later, guest('mb'))).toBe('Now Grilled fish');
    expect(nowLine(lateArrival(later), LATE)).toBe('Now Grilled fish');
  });

  it('ends with Mark available again: Chicken back for everyone waiting, changes kept', () => {
    const back = markAvailable(settle(beef), LEAD);
    expect(waiting(back)).toEqual([]);
    expect(bulkRows(back).some((r) => r.stands)).toBe(false);
    expect(names(changed(back))).toContain('Tunde Bakare');
    expect(waiting(lateArrival(back))).toEqual([]);
    expect(bulkRows(markRunOutAgain(back)).some((r) => r.stands)).toBe(false);
  });
});

describe('Choose for {name}', () => {
  it('refuses Funke Adeyemi Beef (allergens not stated) and Grilled fish (contains fish)', () => {
    const ro = runOutSample();
    const offered = options(ro, guest('fa'));
    expect(offered.map((o) => [o.label, o.no?.line ?? null])).toEqual([
      ['Serve Beef', 'Not for Funke Adeyemi · Fish allergy'],
      ['Serve Grilled fish', 'Not for Funke Adeyemi · Fish allergy'],
      ['Serve without Chicken', null],
    ]);
    expect(offered[0]?.no?.note).toBe('Beef’s allergens aren’t stated');
  });

  it('refuses nothing for a diet or an Other allergy', () => {
    expect(conflict(guest('hs'), 'Beef')).toBeNull();
    expect(conflict(guest('ae'), 'Beef')).toBeNull();
    expect(conflict(guest('ae'), 'Grilled fish')).toBeNull();
  });

  it('never offers an item already on the plate, nor Serve without on a plate it would empty', () => {
    expect(options(runOutSample(), guest('mb')).map((o) => o.label)).toEqual([
      'Serve Grilled fish',
      'Serve without Chicken',
    ]);
    expect(options(runOutSample(), guest('bo')).map((o) => o.label)).toEqual([
      'Serve Jollof rice',
      'Serve Beef',
      'Serve Grilled fish',
    ]);
  });

  it('is made again at To serve, and refused once the plate is Dishing (409)', () => {
    const ro = openPanel(runOutSample(), 'choose', LEAD);
    expect(nowLine(chooseFor(ro, 'sm', 'Grilled fish', LEAD), guest('sm'))).toBe(
      'Now Grilled fish',
    );
    const raced = chooseFor({ ...ro, race: 'sm' }, 'sm', 'Grilled fish', LEAD);
    expect(raced.refused).toBe(
      'Sola Martins’s plate is already being dished, so their choice stays as it is.',
    );
    expect(nowLine(raced, guest('sm'))).toBe('Now Beef');
  });

  it('refuses every tap offline and without service.manage, and keeps nothing', () => {
    const ro = runOutSample();
    const off = chooseFor(ro, 'tb', 'Beef', { online: false, manage: true });
    expect(off.refused).toBe(offlineLine('choose'));
    expect(waiting(off)).toHaveLength(9);
    expect(markAvailable(ro, { online: false, manage: true }).refused).toBe(
      'Needs a connection to mark Chicken available again. Nothing is kept to send later.',
    );
    expect(openPanel(ro, 'choose', { online: true, manage: false }).refused).toBe(
      'Only the floor lead chooses what guests get instead. Nothing changed.',
    );
  });
});

describe('How it’s going with Chicken run out', () => {
  it('puts Waiting for a choice first and the counts still add up to the guests due', () => {
    const s = withRunOut(sample(), runOutSample());
    const c = s.course;
    expect(c.choice).toBe(9);
    expect((c.choice ?? 0) + c.onTray + c.kitchen + c.toServe + c.served).toBe(c.due);
    expect(s.alerts[0]?.title).toBe('Chicken has run out');
    expect(s.alerts[0]?.sub).toBe('Grill · 9 waiting for a choice');
  });

  it('leaves them out of each section’s left each', () => {
    const s = withRunOut(sample(), runOutSample());
    const left = (id: string) => s.sections.find((x) => x.id === id)?.leftEach;
    expect(left('A')).toBe(13);
    expect(left('B')).toBe(5);
    expect(left('E')).toBe(4);
  });

  it('holds guests again on a replacement that is Preparing, and the alert leaves once nobody waits', () => {
    const ro = settle(fish);
    const s = withRunOut(sample(), ro);
    expect(s.course.kitchen).toBe(sample().course.kitchen + 5);
    expect(s.course.choice).toBe(4);
    const c = s.course;
    expect((c.choice ?? 0) + c.onTray + c.kitchen + c.toServe + c.served).toBe(c.due);
    const gone = withRunOut(sample(), markAvailable(ro, LEAD));
    expect(gone.course.choice).toBeUndefined();
    expect(gone.alerts.some((a) => a.kind === 'runOut')).toBe(false);
  });

  it('counts a late arrival once, from Not here yet', () => {
    const s = withRunOut(sample(), lateArrival(runOutSample()));
    expect(s.course.notHere).toBe(sample().course.notHere - 1);
    expect(s.course.due).toBe(sample().course.due + 1);
    expect(s.course.choice).toBe(10);
  });
});

describe('Plan and List with Chicken run out', () => {
  it('tables 9, 12, 14 and 3 read Waiting for a choice', () => {
    const tables = runOutTables(room(), runOutSample());
    const word = (n: number) => wordOf(tables.find((t) => t.n === n)!);
    for (const n of [9, 12, 14, 3]) expect(word(n)).toBe('choice');
    expect(word(4)).toBe('kitchen');
  });

  it('a wait for a choice adds nothing toward Behind, so table 8 is why Section B is Behind', () => {
    for (const ro of [runOutSample(), settle(beef)]) {
      const behind = alertsOf(runOutTables(room(), ro)).filter((a) => a.kind === 'behind');
      expect(behind.map((a) => a.sub)).toEqual(['Table 8 has waited longest · 20 min']);
    }
  });

  it('no table reads it once Chicken is available again', () => {
    const tables = runOutTables(room(), markAvailable(runOutSample(), LEAD));
    expect(tables.some((t) => wordOf(t) === 'choice')).toBe(false);
  });
});
