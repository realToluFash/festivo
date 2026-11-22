import type { CheckIn, CheckInGuest, ListedEvent } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  beforeOpenTags,
  checksIn,
  clockOf,
  countLine,
  doorMatches,
  doorRows,
  onEventDay,
  sameName,
  walkInProblem,
} from './checkIn.ts';
import { listEventOf, shownEvent } from './eventsList.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  values == null ? key : `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

const ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

function guest(id: string, fullName: string, more: Partial<CheckInGuest> = {}): CheckInGuest {
  return {
    id,
    fullName,
    reply: 'coming',
    repliedAt: null,
    code: null,
    walkIn: false,
    arrival: null,
    companions: [],
    ...more,
  };
}

const LIST: CheckIn = {
  state: 'open',
  opensAt: '2026-11-21T16:00:00+01:00',
  timeZone: 'Africa/Lagos',
  count: { attended: 1, expected: 4 },
  guests: [
    guest('g_z', 'Zainab Bello'),
    guest('g_a', ADAEZE, {
      companions: [
        { id: 'c_1', fullName: 'Rui Duarte', state: 'coming', arrival: null },
        { id: 'c_2', fullName: null, state: 'coming', arrival: null },
        { id: 'c_3', fullName: null, state: 'coming', arrival: null },
      ],
    }),
    guest('g_e', 'Émile Ávila', { walkIn: true, reply: 'noReply' }),
  ],
};

describe('finding a guest at the door (sc-1454)', () => {
  it('matches every typed word as the start of a word in the name, any order, ignoring case and accents', () => {
    expect(doorMatches(ADAEZE, 'okon ada')).toBe(true);
    expect(doorMatches(ADAEZE, 'WILL')).toBe(true);
    expect(doorMatches(ADAEZE, 'kwo')).toBe(false);
    expect(doorMatches('Émile Ávila', 'emile avi')).toBe(true);
  });

  it('lists everyone A to Z, each companion under their host, an unnamed one as the guest of their host, numbered', () => {
    expect(doorRows(t, LIST, '', 'en').map((row) => row.name)).toEqual([
      ADAEZE,
      'Rui Duarte',
      `guestList.guestOf {"host":"${ADAEZE}"}`,
      `guestList.guestOfNth {"host":"${ADAEZE}","nth":2}`,
      'Émile Ávila',
      'Zainab Bello',
    ]);
  });

  it('finds a companion by their own name and shows them under their host', () => {
    expect(doorRows(t, LIST, 'rui', 'en').map((row) => [row.id, row.companion])).toEqual([
      ['g_a', false],
      ['c_1', true],
    ]);
  });

  it('reads Walk-in in place of a walk-in’s reply', () => {
    expect(doorRows(t, LIST, 'emile', 'en')[0]?.reply).toBe('walkIn');
  });
});

describe('the count and the times', () => {
  it('reads attended of expected, and attended alone with nobody expected', () => {
    expect(countLine(t, LIST.count)).toBe('checkIn.count {"count":1,"expected":4}');
    expect(countLine(t, { attended: 37, expected: 0 })).toBe('checkIn.countAlone {"count":37}');
  });

  it('reads the 24-hour clock in the event’s zone', () => {
    expect(clockOf('2026-11-21T19:42:10+01:00')).toBe('19:42');
  });
});

describe('Open check-in', () => {
  const event = { startsAt: '2026-11-21T18:00:00+01:00', endsAt: '2026-11-22T02:00:00+01:00' };

  it('shows on each of the event’s days, a day counted from 05:00', () => {
    expect(onEventDay(event, '2026-11-21T05:00:00+01:00')).toBe(true);
    expect(onEventDay(event, '2026-11-22T04:59:00+01:00')).toBe(true);
    expect(onEventDay(event, '2026-11-21T04:59:00+01:00')).toBe(false);
    expect(onEventDay(event, '2026-11-22T05:00:00+01:00')).toBe(false);
  });

  it('is for whoever holds guests.check_in', () => {
    expect(checksIn({ permissions: ['guests.read', 'guests.check_in'] })).toBe(true);
    expect(checksIn({ permissions: ['guests.read'] })).toBe(false);
    expect(checksIn(null)).toBe(false);
  });
});

describe('a walk-in', () => {
  it('needs a name of at most 200 characters, trimmed', () => {
    expect(walkInProblem('   ')).toBe('blank');
    expect(walkInProblem('a'.repeat(201))).toBe('long');
    expect(walkInProblem(` ${'a'.repeat(200)} `)).toBeNull();
  });

  it('counts a name as a person sees it, as the API does', () => {
    expect(walkInProblem('👍🏾'.repeat(120))).toBeNull();
    expect(walkInProblem('Ọ̀'.repeat(200))).toBeNull();
    expect(walkInProblem('👍🏾'.repeat(201))).toBe('long');
  });

  it('finds the same name on the list, ignoring case and accents', () => {
    expect(sameName(LIST, 'chief mrs adaeze okonkwo-williams')?.id).toBe('g_a');
    expect(sameName(LIST, 'RUI DUARTE')?.id).toBe('c_1');
    expect(sameName(LIST, 'Kofi Asante')).toBeNull();
  });
});

describe('beforeOpenTags', () => {
  const event = shownEvent(
    listEventOf({
      id: 'ev-1',
      name: 'Adaeze at Eko',
      type: 'wedding',
      status: 'live',
      startsAt: '2026-11-21T18:00:00+01:00',
      endsAt: '2026-11-21T23:00:00+01:00',
      timeZone: 'Africa/Lagos',
      concludedAt: null,
      venue: null,
      cover: null,
      milestones: [],
    } as unknown as ListedEvent),
    'live',
  );

  it('names the start beside Live on the day, as the demo draws "Today, 18:00"', () => {
    expect(beforeOpenTags(event, new Date('2026-11-21T14:00:00+01:00'), t)).toEqual([
      { word: 'eventsScreen.live', mark: 'live' },
      { word: 'checkIn.todayAt {"time":"18:00"}' },
    ]);
  });

  it("keeps the card's own chips on an earlier day", () => {
    expect(beforeOpenTags(event, new Date('2026-11-20T23:30:00+01:00'), t)).toEqual([
      { word: 'eventsScreen.live', mark: 'live' },
      { word: 'timeline.inDays {"count":1}' },
    ]);
  });
});
