import { describe, expect, it } from 'vitest';

import {
  LEAD,
  OFFLINE_LINE,
  SERVICE_STATES,
  type Section,
  buttonOf,
  candidates,
  carryOn,
  fresh,
  giveLine,
  giveTo,
  kitchenRows,
  lineKind,
  nextSeed,
  openGive,
  pause,
  sample,
  sectionOrder,
  seed,
  waiterLine,
  waiterOf,
  waitersOn,
} from './howItsGoing.ts';

const section = (name: string, people: number, leftEach: number, toServe = 1): Section => ({
  id: 'A',
  name,
  people,
  served: 0,
  due: 10,
  behind: false,
  leftEach,
  toServe,
});

describe('the summary as the API sends it', () => {
  it('counts every guest due once, the four adding up to the guests due', () => {
    const c = sample().course;
    expect(c.onTray + c.kitchen + c.toServe + c.served).toBe(c.due);
  });

  it('adds the sections up to the course', () => {
    const s = sample();
    expect(s.sections.reduce((n, x) => n + x.due, 0)).toBe(s.course.due);
    expect(s.sections.reduce((n, x) => n + x.served, 0)).toBe(s.course.served);
  });

  it('lists the kitchen with the item no station dishes last', () => {
    expect(kitchenRows(sample()).at(-1)?.station).toBeNull();
  });
});

describe('the order of the sections', () => {
  it('puts a section with nobody on it and guests To serve first, then left each, most first', () => {
    const order = [
      section('Section B', 3, 6),
      section('Section C', 0, 0),
      section('Section A', 1, 14),
    ]
      .sort(sectionOrder)
      .map((s) => s.name);
    expect(order).toEqual(['Section C', 'Section A', 'Section B']);
  });

  it('breaks a tie by name, numbers by value', () => {
    const order = [section('Section 10', 1, 5), section('Section 9', 1, 5)]
      .sort(sectionOrder)
      .map((s) => s.name);
    expect(order).toEqual(['Section 9', 'Section 10']);
  });

  it('does not put an empty section first once nobody there is To serve', () => {
    const order = [section('Section C', 0, 0, 0), section('Section A', 1, 2)]
      .sort(sectionOrder)
      .map((s) => s.name);
    expect(order).toEqual(['Section A', 'Section C']);
  });
});

describe('the waiters’ lines', () => {
  it('gives a waiter on two sections a line under both', () => {
    const s = sample();
    expect(waitersOn(s, 'B').map((w) => w.name)).toContain('Grace Udo');
    expect(waitersOn(s, 'D').map((w) => w.name)).toContain('Grace Udo');
  });

  it('reads a started tray, a paused one and no tray', () => {
    const s = sample();
    const kunle = waiterOf(s, 'Kunle Ajayi');
    const funmi = waiterOf(s, 'Funmi Bakare');
    const grace = waiterOf(s, 'Grace Udo');
    expect(kunle && waiterLine(kunle)).toBe('Kunle Ajayi · Table 4 · 3 plates · Dishing');
    expect(kunle && lineKind(kunle)).toBe('started');
    expect(funmi && lineKind(funmi)).toBe('paused');
    expect(grace && waiterLine(grace)).toBe('Grace Udo · No tray');
  });
});

describe('the lead’s pause', () => {
  it('marks the tray Paused and raises its alert first, at once', () => {
    const s = pause(fresh(), 'Kunle Ajayi');
    expect(waiterOf(s.summary, 'Kunle Ajayi')?.tray?.pausedBy).toBe(LEAD);
    expect(s.summary.alerts[0]).toMatchObject({
      kind: 'paused',
      waiter: 'Kunle Ajayi',
      sub: `Table 4 · paused by ${LEAD}`,
      button: 'Give to…',
    });
  });

  it('is refused offline with a line, and nothing changes', () => {
    const s = pause({ ...fresh(), online: false }, 'Kunle Ajayi');
    expect(s.refused).toBe(OFFLINE_LINE);
    expect(waiterOf(s.summary, 'Kunle Ajayi')?.tray?.pausedBy).toBeNull();
  });
});

describe('Give to…', () => {
  it('lists the other waiters on the section, As well included, and whether each has a tray', () => {
    const s = openGive(fresh(), 'paused:Table 9');
    expect(s.give && candidates(s.summary, s.give)).toEqual([
      { name: 'Bisi Lawal', asWell: false, inHand: 'Tray in hand · Table 6' },
      { name: 'Grace Udo', asWell: true, inHand: 'No tray in hand' },
    ]);
  });

  it('takes the section from the tray’s table, not its waiter’s home', () => {
    const s0 = fresh();
    const grace = waiterOf(s0.summary, 'Grace Udo');
    if (grace) {
      grace.tray = { table: 'Table 10', section: 'B', plates: 2, stage: 'Dishing', pausedBy: null };
    }
    const s = openGive(pause(s0, 'Grace Udo'), 'paused:Table 10');
    expect(s.give?.section).toBe('B');
    expect(s.give && candidates(s.summary, s.give).map((c) => c.name)).toEqual([
      'Bisi Lawal',
      'Funmi Bakare',
    ]);
  });

  it('names who paused the tray, whoever that was', () => {
    const lead = seed('giveNobody');
    expect(lead.give && giveLine(lead.summary, lead.give)).toBe(
      `Kunle Ajayi · Section A · paused by ${LEAD}`,
    );
    const own = openGive(fresh(), 'paused:Table 9');
    expect(own.give && giveLine(own.summary, own.give)).toBe(
      'Funmi Bakare · Section B · paused by Funmi Bakare',
    );
  });

  it('lists nobody on a section with one waiter', () => {
    const s = seed('giveNobody');
    expect(s.give && candidates(s.summary, s.give)).toEqual([]);
  });

  it('ends the pause and the alert, and the first waiter has no tray', () => {
    const s = giveTo(openGive(fresh(), 'paused:Table 9'), 'Grace Udo');
    expect(waiterOf(s.summary, 'Funmi Bakare')?.tray).toBeNull();
    expect(waiterOf(s.summary, 'Grace Udo')?.tray).toMatchObject({
      table: 'Table 9',
      stage: 'On its way',
      pausedBy: null,
    });
    expect(s.summary.alerts.some((a) => a.kind === 'paused')).toBe(false);
    expect(s.give).toBeNull();
  });

  it('refuses a second give, naming who has the tray now', () => {
    const s = seed('giveTaken');
    expect(s.refused).toContain('Bisi Lawal has this tray now.');
    expect(waiterOf(s.summary, 'Funmi Bakare')?.tray?.table).toBe('Table 9');
  });

  it('is refused offline', () => {
    const s = openGive({ ...fresh(), online: false }, 'paused:Table 9');
    expect(s.give).toBeNull();
    expect(s.refused).toBe(OFFLINE_LINE);
  });
});

describe('the alerts’ buttons', () => {
  it('draws no Team button until sc-36034 lands', () => {
    const s = seed('noTeam');
    const team = s.summary.alerts.filter((a) => a.button === 'Team');
    expect(team).toHaveLength(3);
    expect(team.map((a) => buttonOf(s, a))).toEqual([null, null, null]);
    expect(buttonOf(fresh(), team[0] ?? s.summary.alerts[0]!)).toBe('Team');
  });
});

describe('the waiter’s Next', () => {
  it('carries on a tray the lead paused', () => {
    const s = carryOn(nextSeed('nextPaused'));
    expect(s.paused).toBe(false);
  });

  it('refuses Carry on on a given tray, naming who has it, then offers the next tray', () => {
    const s = carryOn(nextSeed('nextRefused'));
    expect(s.refused).toBe('Bisi Lawal has this tray now.');
    expect(s.rows[0]).toMatchObject({ kind: 'offered', table: 'Table 11' });
  });

  it('puts a given tray after the tray in hand and ahead of owed plates', () => {
    expect(nextSeed('nextGiven').rows.map((r) => r.kind)).toEqual(['inHand', 'given', 'owed']);
  });
});

describe('the states', () => {
  it('seeds every state', () => {
    for (const name of SERVICE_STATES) expect(seed(name).summary.course.due).toBe(194);
  });
});
