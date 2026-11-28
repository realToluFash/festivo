import { type FloorRead, answeredWithin, listFormat, roomCourse } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { StationRowRead } from './stationWayIn.ts';

/** The Floor row's one line (sc-98893): their sections in section order as a list in the shown language, All tables with service.manage on none, else No section yet; the latest fired course after each. */
export function floorRowLine(t: TFunction, floor: FloorRead, locale: string): string {
  const sections = floor.yours.map((one) => one.name);

  if (sections.length === 0 && !floor.manage) return t('service.floor.wayIn.noSection');
  const where =
    sections.length === 0
      ? t('service.floor.wayIn.allTables')
      : listFormat(locale, { type: 'conjunction' }).format(sections);
  const course = roomCourse(floor)?.course.name ?? null;

  return course == null ? where : t('service.floor.wayIn.line', { where, course });
}

/** One read of the row, given up after NO_ANSWER_MS as Kitchen station's is, so offline shows "as of". */
export function readFloorRow(
  t: TFunction,
  floor: Promise<FloorRead>,
  locale: string,
  now: () => Date = () => new Date(),
): Promise<NonNullable<StationRowRead>> {
  return answeredWithin(floor, () => new Error('The floor read went unanswered.')).then((read) => ({
    line: floorRowLine(t, read, locale),
    at: now().toISOString(),
    stale: false,
  }));
}
