import type { GuestDetails, OrganisationEvent } from '@soirely/api-client';
import { copyLocale, hostsLine, narrowLocale } from '@soirely/domain';
import i18next from 'i18next';

export type InvitationEvent = Pick<OrganisationEvent, 'name' | 'hosts' | 'startsAt' | 'timeZone'>;

/** The invitation as the guest reads it, in the language sc-3790's rule picks for their messages. */
export function whatsAppMessage(
  guest: Pick<GuestDetails, 'fullName' | 'messageLanguage' | 'organisationLanguage'>,
  event: InvitationEvent,
  link: string,
): string {
  const language = narrowLocale(guest.messageLanguage ?? guest.organisationLanguage);
  const date = new Intl.DateTimeFormat(copyLocale(language), {
    dateStyle: 'long',
    timeZone: event.timeZone,
  }).format(new Date(event.startsAt));

  return i18next.getFixedT(language)('guestList.whatsAppMessage', {
    count: event.hosts.length,
    greeting: guest.fullName,
    hosts: hostsLine(event.hosts, language),
    event: event.name,
    date,
    link,
  });
}

/** WhatsApp's own address on the device: wa.me and every other web page would put the guest's bearer link in a web address. */
export function whatsAppHref(
  guest: Pick<GuestDetails, 'fullName' | 'mobile' | 'messageLanguage' | 'organisationLanguage'>,
  event: InvitationEvent,
  link: string,
): string | null {
  const digits = guest.mobile?.replace(/\D/gu, '') ?? '';

  if (digits === '') return null;

  return `whatsapp://send?phone=${digits}&text=${encodeURIComponent(whatsAppMessage(guest, event, link))}`;
}

const KEPT = 'soirely:whatsapp-asked';

/** The open questions live only in this tab: a reload keeps them, closing the tab drops them. */
export function keptAsked(eventId: string): ReadonlySet<string> {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(`${KEPT}:${eventId}`) ?? '[]');

    return new Set(
      Array.isArray(raw) ? raw.filter((one): one is string => typeof one === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

export function keepAsked(eventId: string, asked: ReadonlySet<string>): void {
  try {
    if (asked.size === 0) sessionStorage.removeItem(`${KEPT}:${eventId}`);
    else sessionStorage.setItem(`${KEPT}:${eventId}`, JSON.stringify([...asked]));
  } catch {
    /* A browser that keeps nothing still asks in the page. */
  }
}
