import { callingCode } from '@soirely/domain';

import type { SampleEvent } from './events.ts';
import { type Guest, type GuestLanguage, ORGANISATION_LANGUAGE, invitesOn } from './guests.ts';

/** sc-26025: the open questions live only in this tab, so a reload keeps them and closing the tab drops them. */
const KEPT = 'soirely-demo:whatsapp-asked';

/** Offered wherever Copy invitation link is: the same phase rule, for a host who acts here. */
export function sendOffered(guest: Guest, event: SampleEvent, clock: Date, acts: boolean): boolean {
  return acts && guest.phone != null && invitesOn(event, clock);
}

export function digitsOf(guest: Guest): string | null {
  if (guest.phone == null) return null;

  return `${callingCode(guest.phone.country) ?? ''}${guest.phone.number}`.replace(/\D/gu, '');
}

/** Soirely's words in a guest's own language: length stand-ins in brackets until l10n writes them (STATES.md, 8 Nov). */
const WORDS: Record<
  GuestLanguage,
  (greeting: string, hosts: string, event: string, date: string) => string
> = {
  en: (greeting, hosts, event, date) =>
    `${greeting}, ${hosts} would love you to come to ${event} on ${date}. Your own page, to reply and see the details:`,
  es: (greeting, hosts, event, date) =>
    `[${greeting}, a ${hosts} les encantaría que vinieras a ${event} el ${date}. Tu página, para responder y ver los detalles:]`,
  fr: (greeting, hosts, event, date) =>
    `[${greeting}, ${hosts} seraient ravis de vous voir à ${event} le ${date}. Votre page, pour répondre et voir les détails :]`,
  pt: (greeting, hosts, event, date) =>
    `[${greeting}, ${hosts} gostariam muito que viesse a ${event} a ${date}. A sua página, para responder e ver os detalhes:]`,
};

/** sc-3790's rule: the guest's own choice, else the host's Language, else the organisation's. */
export function messageLanguage(guest: Guest): GuestLanguage {
  return guest.chose ?? guest.language ?? ORGANISATION_LANGUAGE;
}

export function messageOf(guest: Guest, event: SampleEvent, link: string): string {
  const language = messageLanguage(guest);
  const hosts = new Intl.ListFormat(language, { type: 'conjunction', style: 'long' }).format(
    event.hosts,
  );
  const date = new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeZone: event.timeZone,
  }).format(new Date(event.startsAt));

  return `${WORDS[language](guest.greetAs ?? guest.name, hosts, event.name, date)} ${link}`;
}

/** WhatsApp's own address on the device, never wa.me or any web page with the number or the words in it. */
export function whatsAppHref(guest: Guest, event: SampleEvent, link: string): string | null {
  const digits = digitsOf(guest);

  if (digits == null) return null;

  return `whatsapp://send?phone=${digits}&text=${encodeURIComponent(messageOf(guest, event, link))}`;
}

export function keptAsked(event: string): string[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(`${KEPT}:${event}`) ?? '[]');

    return Array.isArray(raw) ? raw.filter((one): one is string => typeof one === 'string') : [];
  } catch {
    return [];
  }
}

export function keepAsked(event: string, asked: ReadonlySet<string>): void {
  try {
    if (asked.size === 0) sessionStorage.removeItem(`${KEPT}:${event}`);
    else sessionStorage.setItem(`${KEPT}:${event}`, JSON.stringify([...asked]));
  } catch {
    /* A browser that keeps nothing still asks in the page. */
  }
}
