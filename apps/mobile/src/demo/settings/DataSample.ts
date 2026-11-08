import { writtenTime } from '../clock.ts';

/** One "now" for every page: Monday, Oct 19, 2026 at 10:12 in Lagos (enterprise-b-spec.md §2). */
export const NOW = '2026-10-19T09:12:00Z';
export const ZONE = 'Africa/Lagos';

const DAY_MS = 24 * 60 * 60 * 1000;

export function plusDays(at: string, days: number): string {
  return new Date(new Date(at).getTime() + days * DAY_MS).toISOString().replace('.000Z', 'Z');
}

export const CHECK_DAYS = 7;
export const PUT_BACK_DAYS = 14;
export const ONLY_DAYS = 14;

export const AT = {
  ireProved: '2026-10-06T10:02:00Z',
  ireEventsAdded: '2026-10-16T15:45:00Z',
  onlySwitchedOn: '2026-09-19T10:05:00Z',
  failedAdded: '2026-10-05T08:30:00Z',
  missingSince: '2026-10-17T13:20:00Z',
  leftEnterprise: '2026-10-18T08:30:00Z',
} as const;

/** Every other instant is derived from the ones above, as the API derives it. */
export const DERIVED = {
  checksUntil: plusDays(AT.ireEventsAdded, CHECK_DAYS),
  onlyStarts: plusDays(NOW, ONLY_DAYS),
  onlySince: plusDays(AT.onlySwitchedOn, ONLY_DAYS),
  stopped: plusDays(AT.failedAdded, CHECK_DAYS),
  putBackBy: plusDays(AT.missingSince, PUT_BACK_DAYS),
  addedNowUntil: plusDays(NOW, CHECK_DAYS),
} as const;

export const IRE = 'ire.events';
export const IRE_EVENTS = 'ireevents.com';
export const RECORD_VALUE = 'k7q2m9x4c8rt5bn3wd6jp1hz0ys5gfa';
export const recordName = (domain: string) => `_soirely-verify.${domain}`;

export type DomainStatus = 'proved' | 'waiting' | 'failed' | 'missing' | 'kept';
export type Only = 'off' | 'scheduled' | 'on';

export interface Domain {
  name: string;
  status: DomainStatus;
  provedAt: string | null;
  /** Waiting: the checks end. Failed: they stopped. Missing: put it back by. */
  deadline: string | null;
  only: Only;
  /** On: since. Scheduled: it starts. */
  onlyAt: string | null;
}

export const PROVED_IRE: Domain = {
  name: IRE,
  status: 'proved',
  provedAt: AT.ireProved,
  deadline: null,
  only: 'off',
  onlyAt: null,
};

export const WAITING_IRE_EVENTS: Domain = {
  name: IRE_EVENTS,
  status: 'waiting',
  provedAt: null,
  deadline: DERIVED.checksUntil,
  only: 'off',
  onlyAt: null,
};

export type DataZone = typeof ZONE | 'Europe/London';

export function zoneFor(viewer: string): DataZone {
  return viewer === 'julien' ? 'Europe/London' : ZONE;
}

function zoneWord(iso: string, zone: DataZone): string {
  if (zone === ZONE) return 'WAT';

  const at = new Date(iso);
  const lastSunday = (month: number) => {
    const end = new Date(Date.UTC(at.getUTCFullYear(), month + 1, 0, 1));

    return end.getTime() - end.getUTCDay() * DAY_MS;
  };

  return at.getTime() >= lastSunday(2) && at.getTime() < lastSunday(9) ? 'BST' : 'GMT';
}

/** Dates in the reader's own zone, named (sc-868): Julien, an admin, reads in London. */
export interface DataSay {
  at(iso: string): string;
  day(iso: string): string;
  exact(iso: string): string;
  time(iso: string): string;
  dayKey(iso: string): string;
}

export function dataSayIn(locale: string, zone: DataZone = ZONE): DataSay {
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: zone,
  });
  const dated = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: zone,
  });
  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: zone,
  });
  const key = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zone,
  });

  return {
    at: (iso) =>
      `${day.format(new Date(iso))} at ${writtenTime(new Date(iso), locale, zone)} ${zoneWord(iso, zone)}`,
    day: (iso) => day.format(new Date(iso)),
    exact: (iso) =>
      `${dated.format(new Date(iso))} at ${clock.format(new Date(iso))} ${zoneWord(iso, zone)}`,
    time: (iso) => writtenTime(new Date(iso), locale, zone),
    dayKey: (iso) => key.format(new Date(iso)),
  };
}
