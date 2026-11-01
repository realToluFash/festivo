import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { eventDatesWords, nextStepWords, summaryWords } from './eventsHome.ts';

const t = ((key: string, values: Record<string, unknown> = {}) =>
  `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

const EVENT = {
  status: 'live' as const,
  startsAt: '2026-11-14T09:00:00+01:00',
  endsAt: '2026-11-14T23:00:00+01:00',
  timeZone: 'Europe/Madrid',
  concludedAt: null,
};

describe('summaryWords', () => {
  it('joins the parts whose count is not 0, in order', () => {
    const join = ((key: string, values: Record<string, unknown> = {}) =>
      key === 'eventsScreen.summaryJoin'
        ? `${String(values.first)} · ${String(values.rest)}`
        : `${key.replace('eventsScreen.summary', '')} ${String(values.count)}`) as unknown as TFunction;

    expect(summaryWords({ happeningNow: 2, upcoming: 3, drafts: 1 }, join)).toBe(
      'HappeningNow 2 · Upcoming 3 · Drafts 1',
    );
    expect(summaryWords({ happeningNow: 0, upcoming: 3, drafts: 0 }, join)).toBe('Upcoming 3');
  });

  it('has nothing to say with nothing to count', () => {
    expect(summaryWords({ happeningNow: 0, upcoming: 0, drafts: 0 }, t)).toBeNull();
  });
});

describe('eventDatesWords', () => {
  it('writes one day, then its start and zone, in the event’s zone', () => {
    expect(eventDatesWords(EVENT, 'en-US', t)).toEqual({
      days: 'Saturday, Nov 14',
      time: 'eventsScreen.timeAndZone {"time":"09:00","timeZone":"Europe/Madrid"}',
    });
  });

  it('writes a multi-day event as its first and last day', () => {
    expect(
      eventDatesWords({ ...EVENT, endsAt: '2026-11-16T12:00:00+01:00' }, 'en-US', t).days,
    ).toBe('eventsScreen.days {"first":"Saturday, Nov 14","last":"Monday, Nov 16"}');
  });

  it('says when an event was called off, with no time', () => {
    expect(
      eventDatesWords(
        { ...EVENT, status: 'ended', concludedAt: '2026-11-10T10:00:00+01:00' },
        'en-US',
        t,
      ),
    ).toEqual({ days: 'eventsScreen.calledOffOn {"date":"Nov 10"}', time: null });
  });
});

describe('nextStepWords', () => {
  it('says what each phase asks for next', () => {
    expect(nextStepWords({ kind: 'makeLive' }, t)).toBe('eventsScreen.nextMakeLive {}');
    expect(nextStepWords({ kind: 'changeDates' }, t)).toBe('eventsScreen.nextChangeDates {}');
    expect(nextStepWords({ kind: 'resume' }, t)).toBe('eventsScreen.nextResume {}');
    expect(nextStepWords(null, t)).toBeNull();
  });
});
