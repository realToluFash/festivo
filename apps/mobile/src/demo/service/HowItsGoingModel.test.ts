import { describe, expect, it } from 'vitest';

import {
  LEAD,
  OFFLINE_LINE,
  type Section,
  buttonOf,
  candidates,
  carryOn,
  fresh,
  giveLine,
  giveTo,
  lineKind,
  nextSeed,
  openGive,
  pause,
  sample,
  sectionOrder,
  seed,
  waiterOf,
  waitersOn,
} from './HowItsGoingModel.ts';

function section(name: string, people: number, leftEach: number, toServe = 1): Section {
  return {
    id: 'A',
    name,
    people,
    served: 0,
    due: 10,
    behind: false,
    leftEach,
    toServe,
  };
}

describe('the current course', () => {
  it('counts every guest due once across the four', () => {
    const c = sample().course;
    expect(c.onTray + c.kitchen + c.toServe + c.served).toBe(c.due);
  });

  it('adds the sections up to the course', () => {
    const s = sample();
    expect(s.sections.reduce((n, x) => n + x.due, 0)).toBe(s.course.due);
    expect(s.sections.reduce((n, x) => n + x.served, 0)).toBe(s.course.served);
  });
});

describe('the sections', () => {
  it('puts a section with nobody on it and guests To serve first, then left each, most first, ties by name', () => {
    const order = [
      section('Section 10', 2, 6),
      section('Section 2', 2, 6),
      section('Section A', 1, 14),
      section('Section C', 0, 0, 18),
      section('Section E', 0, 0, 0),
    ]
      .sort(sectionOrder)
      .map((s) => s.name);
    expect(order).toEqual(['Section C', 'Section A', 'Section 2', 'Section 10', 'Section E']);
  });

  it('keeps the sample in that order', () => {
    const s = sample().sections;
    expect([...s].sort(sectionOrder).map((x) => x.id)).toEqual(s.map((x) => x.id));
  });

  it('gives a waiter on two sections a line under both', () => {
    const s = sample();
    expect(waitersOn(s, 'B').map((w) => w.name)).toContain('Grace Udo');
    expect(waitersOn(s, 'D').map((w) => w.name)).toContain('Grace Udo');
  });
});

describe('the lead pauses a tray', () => {
  it('marks it Paused and raises the paused tray alert first', () => {
    const s = pause(fresh(), 'Kunle Ajayi');
    const kunle = waiterOf(s.summary, 'Kunle Ajayi');
    expect(kunle != null && lineKind(kunle)).toBe('paused');
    expect(kunle?.tray?.pausedBy).toBe(LEAD);
    expect(s.summary.alerts[0]).toMatchObject({
      kind: 'paused',
      button: 'Give to…',
      table: 'Table 4',
    });
  });

  it('is refused offline, with the line and nothing kept', () => {
    const s = pause({ ...fresh(), online: false }, 'Kunle Ajayi');
    expect(s.refused).toBe(OFFLINE_LINE);
    expect(waiterOf(s.summary, 'Kunle Ajayi')?.tray?.pausedBy).toBeNull();
  });
});

describe('Give to…', () => {
  it('lists the other waiters on the section, As well included, each with or without a tray', () => {
    const s = openGive(fresh(), 'paused:Table 9');
    expect(s.give == null ? [] : candidates(s.summary, s.give)).toEqual([
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
    expect(s.give == null ? [] : candidates(s.summary, s.give).map((c) => c.name)).toEqual([
      'Bisi Lawal',
      'Funmi Bakare',
    ]);
  });

  it('names who paused the tray, whoever that was', () => {
    const lead = seed('giveNobody');
    expect(lead.give == null ? '' : giveLine(lead.summary, lead.give)).toBe(
      `Kunle Ajayi · Section A · paused by ${LEAD}`,
    );
    const own = openGive(fresh(), 'paused:Table 9');
    expect(own.give == null ? '' : giveLine(own.summary, own.give)).toBe(
      'Funmi Bakare · Section B · paused by Funmi Bakare',
    );
  });

  it('lists nobody on a section with one waiter', () => {
    const s = seed('giveNobody');
    expect(s.give == null ? null : candidates(s.summary, s.give)).toEqual([]);
  });

  it('says No tray in hand for a waiter without one', () => {
    const s = seed('given');
    const back = openGive(pause(s, 'Bisi Lawal'), 'paused:Table 6');
    expect(back.give == null ? [] : candidates(back.summary, back.give)).toContainEqual({
      name: 'Funmi Bakare',
      asWell: false,
      inHand: 'No tray in hand',
    });
  });

  it('ends the pause and the alert once given', () => {
    const s = giveTo(openGive(fresh(), 'paused:Table 9'), 'Grace Udo');
    expect(waiterOf(s.summary, 'Funmi Bakare')?.tray).toBeNull();
    expect(waiterOf(s.summary, 'Grace Udo')?.tray).toMatchObject({
      table: 'Table 9',
      pausedBy: null,
    });
    expect(s.summary.alerts.some((a) => a.kind === 'paused')).toBe(false);
    expect(s.give).toBeNull();
  });

  it('refuses a second give, naming who has the tray', () => {
    const s = seed('giveTaken');
    expect(s.refused).toContain('Bisi Lawal has this tray now.');
    expect(waiterOf(s.summary, 'Funmi Bakare')?.tray?.pausedBy).toBe('Funmi Bakare');
  });
});

describe('the alerts', () => {
  it('draws Team’s button only once sc-36034 lands', () => {
    const team = sample().alerts.filter((a) => a.button === 'Team');
    expect(team).toHaveLength(3);
    for (const a of team) {
      expect(buttonOf(seed('noTeam'), a)).toBeNull();
      expect(buttonOf(fresh(), a)).toBe('Team');
    }
  });
});

describe('the waiter’s Next', () => {
  it('refuses Carry on on a given tray, naming who has it, then offers the next tray', () => {
    const s = carryOn(nextSeed('nextRefused'));
    expect(s.refused).toBe('Bisi Lawal has this tray now.');
    expect(s.rows).toEqual([expect.objectContaining({ kind: 'offered', table: 'Table 11' })]);
  });

  it('carries on a tray the lead paused', () => {
    const s = carryOn(nextSeed('nextPaused'));
    expect(s.paused).toBe(false);
    expect(s.refused).toBe('');
  });

  it('puts a given tray after the tray in hand and ahead of owed plates', () => {
    expect(nextSeed('nextGiven').rows.map((r) => r.kind)).toEqual(['inHand', 'given', 'owed']);
  });
});
