import type { WhosHere, WhosHereRow } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  blankDoor,
  coverCandidates,
  doorLabel,
  doorProblems,
  dueBy,
  firstProblem,
  jobLine,
  leavesEmpty,
  movedWords,
  newlyIn,
  numberProblem,
  rowLine,
} from './whosHere.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

const row = (
  id: string,
  name: string,
  station: string | null,
  inAt: string | null = null,
): WhosHereRow => ({
  id,
  name,
  job: 'Waiter',
  station: station == null ? null : { id: station, name: `Section ${station}` },
  shiftStartsAt: '2026-11-28T17:00:00+01:00',
  shiftEndsAt: '2026-11-29T01:00:00+01:00',
  clockedInAt: inAt,
  phone: null,
  canAddMobile: false,
  coveredBy: null,
  movedFrom: null,
  nobodyHere: false,
});

const read = (here: WhosHereRow[], notHere: WhosHereRow[] = []): WhosHere => ({
  now: '2026-11-28T18:05:00+01:00',
  timeZone: 'Africa/Lagos',
  countryCode: 'NG',
  ended: false,
  viewer: { station: null, canCover: true, canAddWalkOn: true },
  notHere,
  here,
  didntClockIn: [],
  stations: [],
  doorStations: [],
  jobs: [],
});

describe("Who's here", () => {
  it('is due by fifteen minutes on, on the event clock', () => {
    expect(dueBy('2026-11-28T18:05:00+01:00', 'en-GB')).toBe('18:20');
    expect(dueBy('2026-11-28T23:50:00+01:00', 'en-GB')).toBe('00:05');
  });

  it('names the walk-on’s end in one of the three forms', () => {
    const job = { id: 'j', name: 'Waiter', walkOnEndsAt: '2026-11-29T01:00:00+01:00' };
    expect(jobLine(t, { ...job, walkOnEnd: 'shift' }, 'en-GB')).toContain('whosHere.jobEndsShift');
    expect(jobLine(t, { ...job, walkOnEnd: 'event' }, 'en-GB')).toContain('whosHere.jobEndsEvent');
    expect(jobLine(t, { ...job, walkOnEnd: 'day' }, 'en-GB')).toContain('"time":"01:00"');
  });

  it('asks for the name, the job and the station, and leaves a blank number alone', () => {
    const problems = doorProblems(t, blankDoor('NG'), 'Nigeria', false);
    expect(problems).toEqual({
      name: 'whosHere.nameBlank',
      number: null,
      job: 'whosHere.jobBlank',
      station: 'whosHere.whereBlank',
    });
    expect(firstProblem(problems)).toBe('name');
    expect(doorProblems(t, blankDoor('NG'), 'Nigeria', true).station).toBeNull();
  });

  it('wants a number only where a number is the point', () => {
    expect(numberProblem(t, '', 'NG', 'Nigeria', false)).toBeNull();
    expect(numberProblem(t, '', 'NG', 'Nigeria', true)).toBe('whosHere.mobileBlank');
    expect(numberProblem(t, '803 555 01', 'NG', 'Nigeria', false)).toContain('whosHere.tooShort');
    expect(numberProblem(t, '803 555 0144', 'NG', 'Nigeria', false)).toBeNull();
  });

  it('follows the number as it is typed', () => {
    expect(doorLabel(t, blankDoor('NG'), false)).toBe('whosHere.add');
    expect(doorLabel(t, { ...blankDoor('NG'), number: '803' }, false)).toBe('whosHere.addCopy');
    expect(doorLabel(t, blankDoor('NG'), true)).toBe('whosHere.adding');
  });

  it('reads job · station, leaving out what they have none of', () => {
    expect(rowLine(row('1', 'Tope Bello', 'B'))).toBe('Waiter · Section B');
    expect(rowLine({ ...row('1', 'Tope Bello', null), job: null })).toBe('');
  });

  it('covers from people here on another station, by name, warning who leaves theirs empty', () => {
    const grace = row('5', 'Grace Okon', 'A', '2026-11-28T16:50:00+01:00');
    const bisi = row('2', 'Bisi Adeyemi', 'D', '2026-11-28T15:55:00+01:00');
    const sam = row('12', 'Samuel Okafor', 'D', '2026-11-28T15:50:00+01:00');
    const tope = row('4', 'Tope Bello', 'B');
    const now = read(
      [grace, bisi, sam, row('6', 'Yusuf', 'B', '2026-11-28T17:00:00+01:00')],
      [tope],
    );

    expect(coverCandidates(now, 'B', 'en-GB').map((one) => one.name)).toEqual([
      'Bisi Adeyemi',
      'Grace Okon',
      'Samuel Okafor',
    ]);
    expect(leavesEmpty(now, grace)).toBe(true);
    expect(leavesEmpty(now, bisi)).toBe(false);
  });

  it('announces only who clocked in since the last read', () => {
    const before = read([row('1', 'Dayo', 'A', '2026-11-28T14:00:00+01:00')]);
    const after = read([row('7', 'Amina', 'P', '2026-11-28T18:06:00+01:00'), ...before.here]);

    expect(newlyIn(null, after)).toEqual([]);
    expect(newlyIn(before, after).map((one) => one.name)).toEqual(['Amina']);
  });

  it('says who is on the station after a cover, and who is left on the old one', () => {
    const moved = { ...row('5', 'Grace Okon', 'B', '2026-11-28T16:50:00+01:00') };
    const after = read([moved]);

    expect(movedWords(t, after, '5', 'Section A', 'en-GB')).toBe(
      'whosHere.isOn {"name":"Grace Okon","station":"Section B"} whosHere.nobodyOnSaid {"station":"Section A"}',
    );
    const two = read([moved, row('11', 'Joy Okoro', 'A', '2026-11-28T17:00:00+01:00')]);
    expect(movedWords(t, two, '5', 'Section A', 'en-GB')).toContain('"names":"Joy Okoro"');
  });
});
