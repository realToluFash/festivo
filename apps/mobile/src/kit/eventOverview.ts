import type { OrganisationEvent } from '@soirely/api-client';
import {
  type EventPhase,
  endLabel,
  eventAllows,
  formatEventRange,
  hostsLine,
  positionPart,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { dayCount } from './eventsList.ts';

export type ManageKey = 'duplicate' | 'pause' | 'callOff' | 'endNow' | 'delete';

/** Only what event-states.json allows the phase; Resume is the paused card's step, so it is not repeated here. */
export function manageOf(event: { startsAt: string }, phase: EventPhase, now: Date): ManageKey[] {
  const end = endLabel(event, phase, now);

  return [
    'duplicate',
    ...(eventAllows(phase, 'pause') ? (['pause'] as const) : []),
    ...(end == null ? [] : [end]),
    ...(eventAllows(phase, 'delete') ? (['delete'] as const) : []),
  ];
}

export function scheduleLocked(phase: EventPhase): boolean {
  return !eventAllows(phase, 'edit_schedule');
}

export interface RowWords {
  title: string;
  line: string;
}

type Dated = Pick<OrganisationEvent, 'startsAt' | 'endsAt' | 'timeZone'>;

export function datesRow(event: Dated, phase: EventPhase, locale: string, t: TFunction): RowWords {
  const title = formatEventRange(event.startsAt, event.endsAt, event.timeZone, locale);

  if (scheduleLocked(phase)) return { title, line: t('eventPage.datesLocked') };

  const count = dayCount(event);

  return {
    title,
    line:
      count > 1
        ? t('eventPage.datesLineDays', { count, timeZone: event.timeZone })
        : t('eventPage.datesLine', { timeZone: event.timeZone }),
  };
}

export function hostsRow(hosts: readonly string[], locale: string, t: TFunction): RowWords {
  return hosts.length === 0
    ? { title: t('eventPage.noHosts'), line: t('eventPage.noHostsLine') }
    : { title: hostsLine(hosts, locale), line: t('eventHosts.heading') };
}

export function venueRow(venue: OrganisationEvent['venue'], t: TFunction): RowWords {
  const name = venue?.name ?? null;
  const address = venue?.address?.formatted ?? null;

  if (name == null && address == null)
    return { title: t('eventPage.venueToBeConfirmed'), line: t('eventPage.venue') };

  return name != null && address != null
    ? { title: name, line: t('eventPage.venueLine', { address }) }
    : { title: name ?? address ?? '', line: t('eventPage.venue') };
}

export function currencyTitle(code: string, locale: string, t: TFunction): string {
  let name = code;
  try {
    name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
  } catch {
    name = code;
  }

  return name === code ? code : t('eventPage.currencyTitle', { code, name });
}

export function coverRow(cover: OrganisationEvent['cover'], t: TFunction): RowWords {
  return cover == null
    ? { title: t('eventPage.defaultCover'), line: t('eventPage.cover') }
    : {
        title: t('eventPage.yourPhoto'),
        line: t('eventPage.coverLine', {
          showing: t(`eventCover.showing_${positionPart(cover.position)}`),
        }),
      };
}
