import type { StaffEntry, StaffReminder } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import { noticeClock, noticeLines, reminderLines, slotWords } from '@soirely/domain';
import { removalLine } from './notices.ts';

const t = i18next.getFixedT('en');
const EVENT = {
  startsAt: '2026-10-17T16:00:00Z',
  endsAt: '2026-10-17T23:00:00Z',
  timeZone: 'Africa/Lagos',
};
const CLOCK = noticeClock(EVENT, 'en-US');

function person(more: Partial<StaffEntry> = {}): StaffEntry {
  return {
    id: 'st_1',
    fullName: 'Tope Bello',
    briefing: 'sent',
    inApp: true,
    notice: null,
    ...more,
  } as StaffEntry;
}

const words = (one: StaffEntry, finished = false) =>
  noticeLines(one, finished, CLOCK, t).map((line) => line.words);

describe('the Briefing column’s notice lines (sc-4333)', () => {
  it('reads a waiting change: when it goes, each change, and that edits join it', () => {
    const one = person({
      notice: {
        state: 'waiting',
        goesAt: '2026-10-15T19:55:00+01:00',
        changes: [
          {
            kind: 'start_time',
            start: '2026-10-17T15:00:00+01:00',
            end: null,
            oldStart: '2026-10-17T17:00:00+01:00',
            oldEnd: null,
            new: null,
            old: null,
            count: 0,
            on: '2026-10-17T15:00:00+01:00',
            dated: false,
          },
          {
            kind: 'job',
            start: null,
            end: null,
            oldStart: null,
            oldEnd: null,
            new: 'Bar',
            old: 'Floor',
            count: 0,
            on: null,
            dated: false,
          },
        ],
      },
    });

    expect(words(one)).toEqual([
      'Goes at 19:55',
      'Start 15:00 (was 17:00)',
      'Job Bar (was Floor)',
      'Edits before then go in the same message.',
    ]);
  });

  it.each([
    [
      false,
      '2026-10-18',
      ['Start Sunday 18:00 (was Saturday 18:00)', 'End Sunday 23:00 (was Saturday 23:00)'],
    ],
    [
      true,
      '2026-10-24',
      [
        'Start Saturday, Oct 24, 18:00 (was Saturday, Oct 17, 18:00)',
        'End Saturday, Oct 24, 23:00 (was Saturday, Oct 17, 23:00)',
      ],
    ],
  ])('names a moved shift’s new day, dated %s (sc-100276)', (dated, day, lines) => {
    const line = (kind: 'start_time' | 'end_time', hour: string) => ({
      kind,
      start: `${day}T${hour}:00+01:00`,
      end: null,
      oldStart: `2026-10-17T${hour}:00+01:00`,
      oldEnd: null,
      new: null,
      old: null,
      count: 0,
      on: null,
      dated,
    });
    const one = person({
      notice: {
        state: 'waiting',
        goesAt: '2026-10-15T19:55:00+01:00',
        changes: [line('start_time', '18:00'), line('end_time', '23:00')],
      },
    });

    expect(words(one).slice(1, 3)).toEqual(lines);
  });

  it('keeps the weekday on the old end of a moved shift over midnight (sc-100276)', () => {
    const one = person({
      notice: {
        state: 'waiting',
        goesAt: '2026-10-15T19:55:00+01:00',
        changes: [
          {
            kind: 'end_time',
            start: '2026-10-19T02:00:00+01:00',
            end: null,
            oldStart: '2026-10-18T02:00:00+01:00',
            oldEnd: null,
            new: null,
            old: null,
            count: 0,
            on: null,
            dated: false,
          },
        ],
      },
    });

    expect(words(one)[1]).toBe('End Monday 02:00 (was Sunday 02:00)');
  });

  it('names the weekday on a shift’s start, and on an end only past midnight', () => {
    const one = person({
      notice: {
        state: 'waiting',
        goesAt: '2026-10-15T19:55:00+01:00',
        changes: [
          {
            kind: 'shift_added',
            start: '2026-10-17T22:00:00+01:00',
            end: '2026-10-18T02:00:00+01:00',
            oldStart: null,
            oldEnd: null,
            new: null,
            old: null,
            count: 0,
            on: null,
            dated: false,
          },
          {
            kind: 'shift_retimed',
            start: '2026-10-17T15:00:00+01:00',
            end: '2026-10-17T23:00:00+01:00',
            oldStart: '2026-10-17T17:00:00+01:00',
            oldEnd: '2026-10-17T23:00:00+01:00',
            new: null,
            old: null,
            count: 0,
            on: null,
            dated: false,
          },
          {
            kind: 'no_shift_left',
            start: null,
            end: null,
            oldStart: null,
            oldEnd: null,
            new: null,
            old: null,
            count: 0,
            on: null,
            dated: false,
          },
        ],
      },
    });

    expect(words(one).slice(1, 4)).toEqual([
      'Assigned Saturday 22:00–Sunday 02:00',
      'Shift Saturday 15:00–23:00 (was 17:00–23:00)',
      'No shift left, still on the staff',
    ]);
  });

  it('names the weekday on an end time on another day than the start of its shift', () => {
    const one = person({
      notice: {
        state: 'waiting',
        goesAt: '2026-10-15T19:55:00+01:00',
        changes: [
          {
            kind: 'end_time',
            start: '2026-10-18T01:00:00+01:00',
            end: null,
            oldStart: '2026-10-17T23:00:00+01:00',
            oldEnd: null,
            new: null,
            old: null,
            count: 0,
            on: '2026-10-17T17:00:00+01:00',
            dated: false,
          },
        ],
      },
    });

    expect(words(one)[1]).toBe('End Sunday 01:00 (was 23:00)');
  });

  it('carries the date with the weekday on an event over more than seven days', () => {
    const long = noticeClock({ ...EVENT, endsAt: '2026-10-27T23:00:00Z' }, 'en-US');

    expect(slotWords('2026-10-17T15:00:00+01:00', null, long)).toBe('Saturday, Oct 17, 15:00');
  });

  it('reads Told, with the call-off on its own line, and hides a waiting change once Finished', () => {
    const told = person({
      notice: { state: 'told', at: '2026-10-15T19:40:00+01:00', channel: 'push', ending: null },
    });
    const calledOff = person({
      notice: {
        state: 'told',
        at: '2026-10-15T19:40:00+01:00',
        channel: 'push',
        ending: 'called_off',
      },
    });
    const waiting = person({
      notice: { state: 'waiting', goesAt: '2026-10-15T19:55:00+01:00', changes: [] },
    });

    expect(words(told)).toEqual(['Told on Thursday, Oct 15 at 19:40, by push.']);
    expect(words(calledOff)).toEqual(['Told on Thursday, Oct 15 at 19:40, by push.', 'Called off']);
    expect(words(waiting, true)).toEqual([]);
  });
});

describe('the removal question’s added line (sc-4333)', () => {
  const line =
    'Tope Bello gets one last message within 15 minutes to say so, and nothing after that.';

  it('is there only once their briefing went and a push reaches them, before the event is Finished', () => {
    expect(removalLine(person(), false, t)).toBe(line);
    expect(removalLine(person({ briefing: 'read' }), false, t)).toBe(line);
    expect(removalLine(person({ briefing: 'changed' }), false, t)).toBe(line);
    expect(removalLine(person({ briefing: 'none' }), false, t)).toBeNull();
    expect(removalLine(person({ inApp: false }), false, t)).toBeNull();
    expect(removalLine(person(), true, t)).toBeNull();
  });
});

describe('the Reminder the day before card (sc-4333)', () => {
  const card: StaffReminder = {
    on: true,
    time: '10:00',
    next: { date: '2026-10-16', count: 3 },
    notBriefed: 1,
    unreachable: 2,
    sent: null,
    concluded: null,
  };

  it('says when the next goes, to how many, and who is left out', () => {
    expect(reminderLines(card, 'en-US', t)).toEqual({
      kind: 'open',
      top: 'Next on Friday, Oct 16, to 3 people as things stand.',
      left: [
        '1 person has not had their briefing, so will not be reminded.',
        '2 people can’t be reached.',
      ],
    });
    expect(
      reminderLines({ ...card, next: null, notBriefed: 0, unreachable: 0 }, 'en-US', t),
    ).toEqual({
      kind: 'open',
      top: 'Nobody to remind yet.',
      left: [],
    });
  });

  it('shows nothing under what it does while off, and the Sent line alone once the last has gone', () => {
    expect(reminderLines({ ...card, on: false }, 'en-US', t)).toEqual({
      kind: 'open',
      top: null,
      left: [],
    });
    expect(reminderLines({ ...card, sent: { date: '2026-10-16', count: 1 } }, 'en-US', t)).toEqual({
      kind: 'open',
      top: 'Sent on Friday, Oct 16, to 1 person.',
      left: [],
    });
  });

  it('once Finished, keeps the Sent line or says why none will go, the switch off too', () => {
    const finished = (more: Partial<StaffReminder>) =>
      reminderLines({ ...card, ...more }, 'en-US', t);

    expect(finished({ concluded: 'ended', sent: { date: '2026-10-16', count: 5 } })).toEqual({
      kind: 'finished',
      line: 'Sent on Friday, Oct 16, to 5 people.',
    });
    expect(finished({ concluded: 'called_off' })).toEqual({
      kind: 'finished',
      line: 'No reminder will be sent: the event has been called off.',
    });
    expect(finished({ concluded: 'ended', on: false })).toEqual({
      kind: 'finished',
      line: 'No reminder will be sent: the event has ended.',
    });
  });
});
