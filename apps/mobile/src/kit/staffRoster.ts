import type { StaffEntry, StaffLink } from '@soirely/api-client';
import type { TFunction } from 'i18next';

import { clockAt } from './myNight.ts';

export const LINK_WORDS: Record<StaffLink, string> = {
  none: 'staffLink.none',
  copied: 'staffLink.copied',
  shared: 'staffLink.shared',
  sent: 'staffLink.sent',
  opened: 'staffLink.opened',
  no_mobile: 'staffLink.noMobile',
  erased: 'staffLink.erased',
};

export function linkWord(t: TFunction, link: StaffLink): string {
  return t(LINK_WORDS[link]);
}

/** Copied or Shared: given out, and not yet marked as sent. */
export function handedOut(link: StaffLink): boolean {
  return link === 'copied' || link === 'shared';
}

/** Job · station · first shift with "+{n} more", each with its own words where it is missing. */
export function rowLine(t: TFunction, entry: StaffEntry, locale: string): string {
  return [
    entry.job?.name ?? t('staffRoster.noJob'),
    entry.station?.name ?? t('staffRoster.noStation'),
    shiftLine(t, entry, locale) ?? t('staffRoster.noShift'),
  ].join(' · ');
}

export function shiftLine(t: TFunction, entry: StaffEntry, locale: string): string | null {
  const [first, ...rest] = [...entry.shifts].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (first == null) return null;
  const shift = t('staffRoster.shift', {
    start: clockAt(first.startsAt, locale),
    end: clockAt(first.endsAt, locale),
  });

  return rest.length === 0 ? shift : t('staffRoster.more', { shift, count: rest.length });
}

/** Who moved the link and when: "Shared by Kemi Adeyemi · 18:44 · not marked as sent". */
export function trailLine(t: TFunction, entry: StaffEntry, locale: string): string | null {
  if (entry.linkAt == null) return null;
  const time = clockAt(entry.linkAt, locale);
  const name = entry.linkBy ?? '';
  switch (entry.link) {
    case 'shared':
      return t('staffLink.trailShared', { name, time });
    case 'copied':
      return t('staffLink.trailCopied', { name, time });
    case 'sent':
      return t('staffLink.trailSent', { name, time });
    case 'opened':
      return t('staffLink.trailOpened', { time });
    default:
      return null;
  }
}

/** Share link, Copy link, Mark as sent and Replace link… need staff.manage, a mobile number, and contacts not yet erased. */
export function acts(entry: StaffEntry, manages: boolean): boolean {
  return manages && entry.mobile != null && !entry.contactsErased;
}

export function offersMarkSent(entry: StaffEntry, manages: boolean, asking: boolean): boolean {
  return acts(entry, manages) && !asking && handedOut(entry.link);
}

export function offersReplace(entry: StaffEntry, manages: boolean): boolean {
  return acts(entry, manages) && entry.link !== 'none';
}

/** Back from the share sheet, which cannot say whether it went: asked only while the link reads Shared. */
export function asksAfterShare(after: StaffEntry): boolean {
  return after.link === 'shared';
}

/** The person's line under the status: what the link opens, or why there is nothing to give. */
export function helpLine(t: TFunction, link: StaffLink): string {
  if (link === 'erased') return t('staffLink.erasedLine');
  if (link === 'no_mobile') return t('staffLink.noMobileLine');

  return t('staffLink.help');
}
