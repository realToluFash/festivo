import { callingCode } from '@soirely/domain';

import type { SampleEvent } from './events.ts';
import type { Guest } from './guests.ts';

/** sc-26025: the open questions live only in this tab, so a reload keeps them and closing the tab drops them. */
const KEPT = 'soirely-demo:whatsapp-asked';

export function sendOffered(guest: Guest, event: SampleEvent, manages: boolean): boolean {
  return manages && guest.phone != null && event.status === 'live';
}

export function digitsOf(guest: Guest): string | null {
  if (guest.phone == null) return null;

  return `${callingCode(guest.phone.country) ?? ''}${guest.phone.number}`.replace(/\D/gu, '');
}

export function messageOf(guest: Guest, event: SampleEvent, link: string): string {
  const hosts = new Intl.ListFormat('en', { type: 'conjunction', style: 'long' }).format(
    event.hosts,
  );
  const date = new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
    timeZone: event.timeZone,
  }).format(new Date(event.startsAt));

  return `${guest.greetAs ?? guest.name}, ${hosts} would love you to come to ${event.name} on ${date}. Your own page, to reply and see the details: ${link}`;
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
