import type { Schedule, ScheduleItem } from '@soirely/api-client';
import { nightTracks, nightView } from '@soirely/domain';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';

import { nightItemsOf } from './night.ts';
import { cardTitle, runOfShowCardOf } from './runOfShowCard.ts';

const i18n = createInstance();

beforeAll(() =>
  i18n.init({
    lng: 'en',
    resources: { en: { translation: en }, es: { translation: es } },
    interpolation: { escapeValue: false },
  }),
);

const ZONE = 'Europe/London';
const at = (wall: string) => `${wall}:00+00:00`;

function item(
  id: string,
  title: string,
  planned: string,
  marks: Partial<Pick<ScheduleItem, 'startedAt' | 'endedAt' | 'skipped'>> = {},
): ScheduleItem {
  return {
    id,
    title,
    startsAt: at(planned),
    startedAt: marks.startedAt ?? null,
    endedAt: marks.endedAt ?? null,
    skipped: marks.skipped ?? false,
    day: planned.slice(0, 10),
    lengthMinutes: 30,
    place: 'Garden',
    ownerName: null,
    ownerRole: null,
    note: null,
    fixedTime: false,
    showToGuests: false,
    course: null,
    courseNotice: false,
    version: 1,
  };
}

const schedule = (items: ScheduleItem[]): Schedule => ({
  timeZone: ZONE,
  earliest: at('2030-11-15T06:00'),
  latest: at('2030-11-16T02:00'),
  itemsMaximum: 200,
  items,
});

function cardAt(items: ScheduleItem[], now: string, waiting = 0, lng = 'en') {
  const track = nightTracks(nightItemsOf(schedule(items)), at(now))[0];
  if (track == null) throw new Error('no track');

  return runOfShowCardOf(
    'Ada & Tom',
    'Garden',
    track,
    nightView(track, at(now), ZONE),
    at(now),
    waiting,
    lng,
    i18n.getFixedT(lng),
  );
}

describe('the run-of-show card this device puts up (sc-66580)', () => {
  it('says Now since its start, Next about its expected start, and As of', () => {
    expect(
      cardAt(
        [
          item('speeches', 'Speeches', '2030-11-15T19:30', { startedAt: at('2030-11-15T19:35') }),
          item('dance', 'First dance', '2030-11-15T20:00'),
        ],
        '2030-11-15T19:40',
      ),
    ).toEqual({
      title: 'Ada & Tom · Garden',
      lines: ['Speeches · since 19:35', 'Next: First dance · about 20:05', 'As of 19:40'],
    });
  });

  it('counts the presses still waiting to send', () => {
    expect(
      cardAt(
        [item('speeches', 'Speeches', '2030-11-15T19:30', { startedAt: at('2030-11-15T19:35') })],
        '2030-11-15T19:40',
        2,
      ).lines,
    ).toEqual([
      'Speeches · since 19:35',
      'Nothing else is planned for Garden.',
      'As of 19:40 · 2 presses waiting to send',
    ]);
  });

  it('says only That’s everything once the track is done', () => {
    expect(
      cardAt(
        [
          item('speeches', 'Speeches', '2030-11-15T19:30', {
            startedAt: at('2030-11-15T19:35'),
            endedAt: at('2030-11-15T19:50'),
          }),
        ],
        '2030-11-15T19:55',
      ).lines,
    ).toEqual(['That’s everything.']);
  });

  it('takes the hour-is-1 article in Spanish', () => {
    const [nothing, next, asOf] = cardAt(
      [item('dance', 'Primer baile', '2030-11-16T01:30')],
      '2030-11-16T01:10',
      0,
      'es',
    ).lines;

    expect(nothing).toBe('No hay nada en curso');
    expect(next).toMatch(/^A continuación: Primer baile · hacia la 0?1:30$/u);
    expect(asOf).toMatch(/^Actualizado a la 0?1:10$/u);
  });

  it('keeps a long title’s first 39 and an ellipsis', () => {
    expect(cardTitle('a'.repeat(41))).toBe(`${'a'.repeat(39)}…`);
    expect(cardTitle('a'.repeat(40))).toBe('a'.repeat(40));
  });
});
