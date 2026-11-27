import { describe, expect, it } from 'vitest';

import {
  STATE_NAMES,
  W,
  WALK_ON,
  WALK_ON_ID,
  at,
  canAddMobile,
  choose,
  closeSheet,
  coverCandidates,
  didntClockIn,
  doorAnswer,
  doorLabel,
  doorProblems,
  firstProblem,
  here,
  jobEnd,
  jobLine,
  mobileAnswer,
  moveChosen,
  notHere,
  numberProblem,
  openCover,
  openDoor,
  openMobile,
  seed,
  setDoor,
  setMobile,
  showsDoor,
  stationsTonight,
  toastWords,
  whStateOf,
} from './WhosHereModel.ts';

const names = (list: readonly { name: string }[]) => list.map((p) => p.name);

describe('the lists', () => {
  it('lists who is due by 15 minutes from now, oldest start first, then by name', () => {
    const s = seed('populated');

    expect(names(notHere(s).map((r) => r.p))).toEqual([
      'Joy Okoro',
      'Tope Bello',
      'Yusuf Bello',
      'Amina Yusuf',
      'Ngozi Eze',
    ]);
  });

  it('puts whoever clocked in last at the top of Here', () => {
    expect(names(here(seed('populated'))).slice(0, 2)).toEqual(['Kelechi Nnamdi', 'Tunde Adebayo']);
  });

  it('says a station has nobody here only when nobody here is on it', () => {
    const rows = notHere(seed('populated'));

    expect(rows.find((r) => r.p.name === 'Yusuf Bello')?.nobody).toBe(true);
    expect(rows.find((r) => r.p.name === 'Joy Okoro')?.nobody).toBe(false);
  });

  it('takes someone who clocked out off Here and lists ended shifts as Didn’t clock in', () => {
    const s = seed('didnt_clock_in');

    expect(names(here(s))).not.toContain('Grace Okon');
    expect(names(didntClockIn(s))).toContain('Tope Bello');
  });

  it('shows a station lead only their station, with no Cover', () => {
    const s = seed('station_lead');

    expect(notHere(s).every((r) => r.p.station === 'Section A · T1–T6' && !r.canCover)).toBe(true);
  });

  it('names who is on each station tonight', () => {
    const door = stationsTonight(seed('populated')).find((x) => x.station === 'Door');

    expect(door?.people).toEqual(['Bisi Adeyemi', 'Samuel Okafor']);
  });
});

describe('who may add a mobile number on a row', () => {
  it('is staff.manage on any row without a number', () => {
    const s = seed('row_add_mobile_manage');
    const ngozi = s.list.find((p) => p.name === 'Ngozi Eze');

    expect(ngozi && canAddMobile(s, ngozi)).toBe(true);
  });

  it('is the lead who added a walk-on, on that walk-on only', () => {
    const s = seed('row_add_mobile_walk_on_lead');
    const ngozi = s.list.find((p) => p.name === 'Ngozi Eze');
    const walkOn = s.list.find((p) => p.id === WALK_ON_ID);

    expect(ngozi && canAddMobile(s, ngozi)).toBe(false);
    expect(walkOn && canAddMobile(s, walkOn)).toBe(true);
  });
});

describe('the job’s line', () => {
  it('names the last shift end of that job within 24 hours', () => {
    const s = seed('door_job_shift_end');

    expect(jobLine('Waiter', jobEnd(s, 'Waiter'))).toBe(
      'Waiter shifts end at 01:00. Theirs runs from now until then.',
    );
  });

  it('runs to the event’s end for a job with no shift', () => {
    const s = seed('door_job_no_shift_event_end');

    expect(jobLine('Door', jobEnd(s, 'Door'))).toBe(
      'Door has no shift tonight. Theirs runs from now until the event ends at 02:00.',
    );
  });

  it('runs for 24 hours when the event ends later than that', () => {
    const s = seed('door_job_no_shift_24h');

    expect(jobLine('Door', jobEnd(s, 'Door'))).toBe(
      'Door has no shift tonight. Theirs runs for 24 hours, until 18:05 tomorrow.',
    );
  });
});

describe('Someone’s at the door', () => {
  it('names each missing required field, the first first', () => {
    const s = openDoor(seed('populated'));
    const f = s.sheet?.kind === 'door' ? s.sheet.form : null;
    const p = f == null ? null : doorProblems(s, f, 'Nigeria');

    expect(p).toEqual({
      name: W.nameBlank,
      number: null,
      job: W.jobBlank,
      station: W.whereBlank,
    });
    expect(p && firstProblem(p)).toBe('name');
  });

  it('asks a station lead no station', () => {
    const s = openDoor(seed('station_lead'));
    const f = s.sheet?.kind === 'door' ? s.sheet.form : null;

    expect(f && doorProblems(s, f, 'Nigeria').station).toBeNull();
  });

  it('checks a typed number with sc-62’s rule and lets a blank one through', () => {
    expect(numberProblem('', 'NG', 'Nigeria', false)).toBeNull();
    expect(numberProblem('803 555 01', 'NG', 'Nigeria', false)).toBe(
      'That number looks too short for Nigeria. Check it and try again.',
    );
    expect(numberProblem('803 555 0144 99999', 'NG', 'Nigeria', false)).toBe(
      'That number looks too long for Nigeria. Check it and try again.',
    );
    expect(numberProblem('', 'NG', 'Nigeria', true)).toBe(W.mobileBlank);
  });

  it('labels the button by the number as typed', () => {
    const s = seed('door_number');
    const f = s.sheet?.kind === 'door' ? s.sheet.form : null;

    expect(f && doorLabel(s, f)).toBe('Add and copy the link');
    expect(f && doorLabel({ ...s, epic36: true }, f)).toBe('Add and text the link');
    expect(f && doorLabel(s, { ...f, number: '' })).toBe('Add');
  });

  it('adds someone with no number to Not here yet, with no link', () => {
    const s = setDoor(openDoor(seed('populated')), {
      name: 'Ada Obi',
      job: 'Door',
      station: 'Door',
    });
    const next = doorAnswer(s, '+234');

    expect(next.sheet).toMatchObject({ kind: 'noLink' });
    expect(names(notHere(next).map((r) => r.p))).toContain('Ada Obi');
  });

  it('copies the link for someone added with a number', () => {
    const s = doorAnswer(seed('door_number'), '+234');

    expect(s.sheet).toMatchObject({ kind: 'hasLink', via: 'copy' });
  });

  it('keeps what was typed and offers Close once the event has ended', () => {
    const ended = doorAnswer({ ...seed('door_number'), ended: true }, '+234');

    expect(ended.sheet).toMatchObject({ kind: 'door', form: { refused: true, name: WALK_ON } });
    expect(showsDoor(ended)).toBe(true);
    expect(showsDoor(closeSheet(ended))).toBe(false);
  });

  it('leaves Someone’s at the door out when nothing loaded', () => {
    expect(showsDoor(seed('stale'))).toBe(true);
    expect(showsDoor(seed('unreachable'))).toBe(false);
  });

  it('fails once with sc-3906’s line, then adds', () => {
    const s = { ...seed('door_number'), failNext: true };
    const failed = doorAnswer(s, '+234');

    expect(failed.sheet).toMatchObject({ kind: 'door', form: { failed: true } });
    expect(doorAnswer(failed, '+234').sheet).toMatchObject({ kind: 'hasLink' });
  });
});

describe('Add a mobile number', () => {
  it('keeps the sheet and the number when saving fails, then saves', () => {
    const s = { ...setMobile(seed('add_mobile'), { number: '803 555 0144' }), failNext: true };
    const failed = mobileAnswer(s, '+234');

    expect(failed.sheet).toMatchObject({
      kind: 'mobile',
      form: { failed: true, number: '803 555 0144' },
    });
    expect(failed.list.find((p) => p.id === WALK_ON_ID)?.phone).toBe('');
    expect(mobileAnswer(failed, '+234').sheet).toMatchObject({ kind: 'hasLink' });
  });

  it('writes the number to that person only, and Call takes the pill’s place', () => {
    const start = seed('row_add_mobile_walk_on_lead');
    const s = setMobile(openMobile(start, WALK_ON_ID, true), { number: '803 555 0144' });
    const next = closeSheet(mobileAnswer(s, '+234'));

    expect(next.list.find((p) => p.id === WALK_ON_ID)?.phone).toBe('+234 803 555 0144');
    expect(next.opener).toBe(`call|${WALK_ON_ID}`);
  });
});

describe('Cover', () => {
  it('lists people here who are not on that station, by name', () => {
    const s = seed('populated');

    expect(names(coverCandidates(s, 'Section B · T7–T12'))[0]).toBe('Bisi Adeyemi');
  });

  it('moves nobody until someone is chosen', () => {
    const s = moveChosen(openCover(seed('populated'), 4));

    expect(s.sheet).toMatchObject({ kind: 'cover', tried: true });
  });

  it('moves the chosen person, marks the row covered and says who is where', () => {
    const s = moveChosen(choose(openCover(seed('populated'), 4), 5));

    expect(notHere(s).find((r) => r.p.id === 4)?.coveredBy).toBe('Grace Okon');
    expect(toastWords(s)).toBe('Grace Okon is on Section B · T7–T12. Nobody on Section A · T1–T6.');
  });

  it('keeps the sheet and the choice when the move fails, then moves', () => {
    const chosen = choose(openCover(seed('populated'), 4), 5);
    const failed = moveChosen({ ...chosen, failNext: true });

    expect(failed.sheet).toMatchObject({ kind: 'cover', chosen: 5, failed: true });
    expect(failed.list.find((p) => p.id === 5)?.station).toBe('Section A · T1–T6');
    expect(W.coverFailed('Grace Okon')).toBe(
      'Nothing was changed. Grace Okon was not moved. Try again.',
    );
    expect(moveChosen(failed).sheet).toBeNull();
  });
});

describe('the empty states', () => {
  it('empties Not here yet once everyone due has clocked in, and keeps Here', () => {
    const s = seed('not_here_empty');

    expect(notHere(s)).toEqual([]);
    expect(here(s).length).toBeGreaterThan(0);
  });

  it('empties Here when nobody has clocked in', () => {
    const s = seed('here_empty');

    expect(here(s)).toEqual([]);
    expect(notHere(s).length).toBeGreaterThan(0);
  });

  it('has nobody to move when everyone here is on that station', () => {
    const s = seed('cover_nobody_to_move');

    expect(coverCandidates(s, 'Section A · T1–T6')).toEqual([]);
    expect(names(here(s))).toEqual(['Grace Okon']);
  });
});

describe('the states', () => {
  it('opens every state by name, and an unknown one as populated', () => {
    for (const k of STATE_NAMES) expect(whStateOf(k)).toBe(k);
    expect(whStateOf('nope')).toBe('populated');
  });

  it('says who clocked in, as the status line does', () => {
    expect(toastWords(seed('clocked_in'))).toBe('Amina Yusuf clocked in at 18:06.');
  });

  it('times the sample event at 18:05', () => {
    expect(seed('populated').clock).toBe(at(18, 5));
  });
});
