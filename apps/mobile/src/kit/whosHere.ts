import type { WhosHere, WhosHereJob, WhosHereRow } from '@soirely/api-client';
import { formatWallClock, listFormat, phoneLengthProblem, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { clockAt } from './myNight.ts';

const DUE_WITHIN_MINUTES = 15;

export interface DoorDraft {
  name: string;
  country: string;
  number: string;
  job: string | null;
  station: string | null;
}

export interface DoorProblems {
  name: string | null;
  number: string | null;
  job: string | null;
  station: string | null;
}

export type DoorField = keyof DoorProblems;

export function blankDoor(country: string): DoorDraft {
  return { name: '', country, number: '', job: null, station: null };
}

/** "Everyone due by {time}": fifteen minutes on from the server's now, on the event's clock. */
export function dueBy(now: string, locale: string): string {
  const wall = new Date(Date.parse(`${wallOfZoned(now)}:00Z`) + DUE_WITHIN_MINUTES * 60_000);

  return formatWallClock(wall.toISOString().slice(0, 16), locale);
}

export function jobLine(t: TFunction, job: WhosHereJob, locale: string): string {
  const time = clockAt(job.walkOnEndsAt, locale);
  if (job.walkOnEnd === 'shift') return t('whosHere.jobEndsShift', { job: job.name, time });
  if (job.walkOnEnd === 'event') return t('whosHere.jobEndsEvent', { job: job.name, time });

  return t('whosHere.jobEndsDay', { job: job.name, time });
}

/** A typed number's refusal, naming the country; a blank one only where a number is the point. */
export function numberProblem(
  t: TFunction,
  number: string,
  country: string,
  countryName: string,
  required: boolean,
): string | null {
  switch (phoneLengthProblem(number, country)) {
    case 'blank':
    case 'noCountry':
      return required ? t('whosHere.mobileBlank') : null;
    case 'tooShort':
      return t('whosHere.tooShort', { country: countryName });
    case 'tooLong':
      return t('whosHere.tooLong', { country: countryName });
    case null:
      return null;
  }
}

export function doorProblems(
  t: TFunction,
  draft: DoorDraft,
  countryName: string,
  stationFixed: boolean,
): DoorProblems {
  return {
    name: draft.name.trim() === '' ? t('whosHere.nameBlank') : null,
    number: numberProblem(t, draft.number, draft.country, countryName, false),
    job: draft.job == null ? t('whosHere.jobBlank') : null,
    station: !stationFixed && draft.station == null ? t('whosHere.whereBlank') : null,
  };
}

export function firstProblem(problems: DoorProblems): DoorField | null {
  return (['name', 'number', 'job', 'station'] as const).find((k) => problems[k] != null) ?? null;
}

/** Add with no number, Add and copy the link with one: epic 36's texting does not exist yet. */
export function doorLabel(t: TFunction, draft: DoorDraft, busy: boolean): string {
  if (busy) return t('whosHere.adding');
  return draft.number.trim() === '' ? t('whosHere.add') : t('whosHere.addCopy');
}

/** "{job} · {station}", either left out when they have none. */
export function rowLine(row: WhosHereRow): string {
  return [row.job, row.station?.name].filter((one) => one != null && one !== '').join(' · ');
}

export function shiftLine(t: TFunction, row: WhosHereRow, locale: string): string {
  return t('whosHere.shift', {
    start: clockAt(row.shiftStartsAt, locale),
    end: clockAt(row.shiftEndsAt, locale),
  });
}

/** People in Here who are not already on that station, by name. */
export function coverCandidates(read: WhosHere, stationId: string, locale: string): WhosHereRow[] {
  return read.here
    .filter((row) => row.station?.id !== stationId)
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** Moving them leaves their station with nobody here. */
export function leavesEmpty(read: WhosHere, row: WhosHereRow): boolean {
  return (
    row.station != null &&
    read.here.filter((one) => one.station?.id === row.station?.id).length === 1
  );
}

/** Who has clocked in since the last read, latest first. */
export function newlyIn(before: WhosHere | null, after: WhosHere): WhosHereRow[] {
  if (before == null) return [];
  const was = new Set(before.here.map((row) => row.id));

  return after.here.filter((row) => !was.has(row.id));
}

export function clockedInWords(t: TFunction, row: WhosHereRow, locale: string): string {
  return t('whosHere.clockedInSaid', {
    name: row.name,
    time: row.clockedInAt == null ? '' : clockAt(row.clockedInAt, locale),
  });
}

/** After a cover: who is on which station, and who is left on the old one. */
export function movedWords(
  t: TFunction,
  read: WhosHere,
  moverId: string,
  from: string | null,
  locale: string,
): string {
  const mover = read.here.find((row) => row.id === moverId);
  if (mover == null) return '';
  const onIt = t('whosHere.isOn', { name: mover.name, station: mover.station?.name ?? '' });
  if (from == null) return onIt;
  const left = read.here
    .filter((row) => row.station?.name === from && row.id !== moverId)
    .map((row) => row.name);
  const rest =
    left.length === 0
      ? t('whosHere.nobodyOnSaid', { station: from })
      : t('whosHere.areOn', {
          count: left.length,
          names: listFormat(locale, { type: 'conjunction' }).format(left),
          station: from,
        });

  return `${onIt} ${rest}`;
}
