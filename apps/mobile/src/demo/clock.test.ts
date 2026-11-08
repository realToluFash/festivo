import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { formatTimeOfDay } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { writtenTime } from './clock.ts';

const TWELVE_HOUR = /\b(AM|PM)\b|a\.m\.|p\.m\./u;

/** Any time asked of Intl without the 24-hour cycle, or an AM or PM written out, in any quote or none. */
function twelveHourIn(text: string): string[] {
  const asked = [...text.matchAll(/\bhour: ['"]|\btimeStyle\b|\btoLocaleTimeString\b|\bhour12\b/gu)]
    .filter(
      (m) =>
        !/hourCycle: 'h23'/u.test(
          text.slice(Math.max(0, (m.index ?? 0) - 160), (m.index ?? 0) + 160),
        ),
    )
    .map((m) => m[0]);
  const written = [...text.matchAll(/\d[\s\u202f]?(AM|PM)\b/gu)].map((m) => m[0]);

  return [...asked, ...written];
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);

    return /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : [];
  });
}

describe('every time in the app’s demo, on the 24-hour clock (sc-31722)', () => {
  it('writes a wall-clock time as the product does, 18:00 in en-US, en-GB and fr-FR', () => {
    for (const locale of ['en-US', 'en-GB', 'fr-FR', 'en']) {
      expect(writtenTime('18:00', locale)).toBe('18:00');
      expect(writtenTime('08:05', locale)).toBe('08:05');
    }
    expect(writtenTime('2026-11-10T18:05', 'en-US')).toBe('18:05');
  });

  it('reads a moment on the clock of the zone it names: 10:15 in Lagos', () => {
    expect(writtenTime(new Date('2026-11-04T09:15:00Z'), 'en-US', 'Africa/Lagos')).toBe('10:15');
    expect(writtenTime('2026-11-04T20:05:00Z', 'en-US', 'Africa/Lagos')).toBe('21:05');
  });

  it('reads a moment with no zone on the reader’s own clock, as the product’s formatTimeOfDay does', () => {
    const at = new Date('2026-10-12T09:14:00Z');

    expect(writtenTime(at, 'en-US')).toBe(formatTimeOfDay(at, 'en-US'));
    expect(writtenTime(at, 'en-US')).not.toMatch(TWELVE_HOUR);
  });

  it('catches what a narrower guard missed: 2-digit hours, timeStyle, toLocaleTimeString, AM in any quote', () => {
    expect(
      twelveHourIn("new Intl.DateTimeFormat(l, { hour: '2-digit', minute: '2-digit' })"),
    ).not.toEqual([]);
    expect(twelveHourIn('d.toLocaleTimeString(l)')).not.toEqual([]);
    expect(twelveHourIn("{ timeStyle: 'short' }")).not.toEqual([]);
    expect(twelveHourIn('<p>until 5:30 PM</p>')).not.toEqual([]);
    expect(twelveHourIn('`at 6 PM`')).not.toEqual([]);
    expect(twelveHourIn("{ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }")).toEqual([]);
    expect(twelveHourIn('Ends at 18:00. PMs and AMs are words.')).toEqual([]);
  });

  it('is the one home: no screen asks Intl for a 12-hour clock or writes AM or PM itself', () => {
    const files = [join('src', 'demo'), join('app', 'demo')]
      .flatMap(sources)
      .filter((path) => !path.endsWith('clock.ts'));
    const offenders = files.filter((path) => {
      const text = readFileSync(path, 'utf8');

      return twelveHourIn(text).length > 0;
    });

    expect(files.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
