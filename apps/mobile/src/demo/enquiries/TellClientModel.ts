import { LOCALES, formatEventClock, zoneCity } from '@soirely/domain';

import { CW, type Consultation, type How, started } from './ConsultationsModel.ts';
import { type Enquiry, PEOPLE, type Person } from './EnquiriesModel.ts';

export type Language = 'en' | 'es' | 'fr' | 'pt';
export const LANGUAGES: readonly Language[] = ['en', 'es', 'fr', 'pt'];

export function languageName(language: Language): string {
  return LOCALES.find((one) => one.code === language)?.nativeName ?? language;
}

export function languageOf(code: string | null | undefined): Language {
  const bare = (code ?? 'en').slice(0, 2);

  return LANGUAGES.find((one) => one === bare) ?? 'en';
}

export type Way = 'whatsApp' | 'email' | 'copy';
export type Best = 'phoneCall' | 'whatsApp' | 'textMessage' | 'email';
export type Said = 'booked' | 'changed' | 'cancelled';

export interface Reach {
  phone: string | null;
  email: string | null;
  best: Best | null;
}

/** What the device can open. The web can't tell, so it offers both; the app asks (cd, 10 Nov). */
export interface Device {
  whatsApp: boolean;
  mail: boolean;
}

export const EVERY_WAY: Device = { whatsApp: true, mail: true };
export const SIMULATOR: Device = { whatsApp: false, mail: false };

/** The fields that make a message say "changed": Led by is not among them. */
export type AsBooked = Pick<
  Consultation,
  'startsAt' | 'timeZone' | 'minutes' | 'how' | 'where' | 'link'
>;

export function asBooked(consultation: Consultation): AsBooked {
  const { startsAt, timeZone, minutes, how, where, link } = consultation;

  return { startsAt, timeZone, minutes, how, where, link };
}

export function hasChanged(consultation: Consultation, booked: AsBooked): boolean {
  const now = asBooked(consultation);

  return (Object.keys(now) as (keyof AsBooked)[]).some((key) => now[key] !== booked[key]);
}

export function saidOf(consultation: Consultation, booked: AsBooked, now: string): Said | null {
  if (started(consultation, now)) return null;
  if (consultation.cancelled) return 'cancelled';

  return hasChanged(consultation, booked) ? 'changed' : 'booked';
}

const ORDER: Record<Best | 'none', readonly Way[]> = {
  whatsApp: ['whatsApp', 'email', 'copy'],
  email: ['email', 'whatsApp', 'copy'],
  textMessage: ['copy', 'whatsApp', 'email'],
  phoneCall: ['whatsApp', 'email', 'copy'],
  none: ['whatsApp', 'email', 'copy'],
};

export function waysOf(reach: Reach, device: Device): Way[] {
  return ORDER[reach.best ?? 'none'].filter((way) =>
    way === 'whatsApp'
      ? reach.phone != null && device.whatsApp
      : way === 'email'
        ? reach.email != null && device.mail
        : true,
  );
}

const CITIES: Readonly<Record<string, Record<Language, string>>> = {
  'Europe/Lisbon': { en: 'Lisbon', es: 'Lisboa', fr: 'Lisbonne', pt: 'Lisboa' },
  'Europe/London': { en: 'London', es: 'Londres', fr: 'Londres', pt: 'Londres' },
  'America/New_York': { en: 'New York', es: 'Nueva York', fr: 'New York', pt: 'Nova Iorque' },
  'Europe/Paris': { en: 'Paris', es: 'París', fr: 'Paris', pt: 'Paris' },
  'America/Sao_Paulo': { en: 'São Paulo', es: 'São Paulo', fr: 'São Paulo', pt: 'São Paulo' },
};

export function cityOf(timeZone: string, language: Language): string {
  return CITIES[timeZone]?.[language] ?? zoneCity(timeZone);
}

/** CLDR's long day in the message's language: en-GB gives the AC's "Thursday 12 November", pt the European form. */
const DAY_LOCALE: Record<Language, string> = { en: 'en-GB', es: 'es', fr: 'fr', pt: 'pt-PT' };

function yearIn(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(new Date(instant));
}

export function dayOf(consultation: Consultation, language: Language, now: string): string {
  const zone = consultation.timeZone;
  const year =
    yearIn(consultation.startsAt, zone) === yearIn(now, zone) ? {} : { year: 'numeric' as const };

  return new Intl.DateTimeFormat(DAY_LOCALE[language], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: zone,
    ...year,
  }).format(new Date(consultation.startsAt));
}

/** Soirely's 24-hour clock in the consultation's zone, and its hour, never getHours() (cd, 10 Nov). */
export function clockOf(
  consultation: Consultation,
  language: Language,
): { time: string; hour: number } {
  const time = formatEventClock(consultation.startsAt, consultation.timeZone, DAY_LOCALE[language]);

  return { time, hour: Number(time.slice(0, 2)) };
}

type Variant = 'video' | 'videoNoLink' | 'inPerson' | 'inPersonNoWhere' | 'phone';

export function variantOf(consultation: Consultation): Variant {
  const kinds: Record<How, Variant> = {
    video: consultation.link == null ? 'videoNoLink' : 'video',
    inPerson: consultation.where == null ? 'inPersonNoWhere' : 'inPerson',
    phone: 'phone',
  };

  return kinds[consultation.how];
}

interface Parts {
  client: string;
  org: string;
  day: string;
  time: string;
  /** The hour as count: es and pt write the 01 hour in the singular (l10n, #37170). */
  hour: number;
  city: string;
  minutes: number;
  where: string;
  link: string;
}

interface Words {
  when: (p: Parts) => string;
  booked: (p: Parts) => string;
  changed: (p: Parts) => string;
  cancelled: (p: Parts) => string;
  how: Record<Variant, (p: Parts) => string>;
  subject: (p: Parts) => string;
  subjectCancelled: (p: Parts) => string;
}

/** Working copy: en from the AC, es, fr and pt proposed for [l10n], who settle all four. One key per message, never stitched, in the build. */
const WORDS: Record<Language, Words> = {
  en: {
    when: (p) => `${p.day} at ${p.time} ${p.city} time`,
    booked: (p) =>
      `Hello ${p.client}, this is ${p.org}, confirming our consultation: ${WORDS.en.when(p)}, for ${p.minutes} minutes,`,
    changed: (p) =>
      `Hello ${p.client}, this is ${p.org}. Our consultation has changed. It is now ${WORDS.en.when(p)}, for ${p.minutes} minutes,`,
    cancelled: (p) =>
      `Hello ${p.client}, this is ${p.org}. Our consultation on ${WORDS.en.when(p)} is cancelled.`,
    how: {
      video: (p) => `by video call. The link: ${p.link}`,
      videoNoLink: () => 'by video call.',
      inPerson: (p) => `in person at ${p.where}.`,
      inPersonNoWhere: () => 'in person.',
      phone: () => 'by phone. We’ll call you.',
    },
    subject: (p) => `Consultation with ${p.org}, ${p.day}`,
    subjectCancelled: (p) => `Consultation cancelled, ${p.day}`,
  },
  es: {
    when: (p) => `${p.day}, ${p.hour === 1 ? 'a la' : 'a las'} ${p.time}, hora de ${p.city}`,
    booked: (p) =>
      `Hola ${p.client}, le escribe ${p.org} para confirmar nuestra consulta: ${WORDS.es.when(p)}, durante ${p.minutes} minutos,`,
    changed: (p) =>
      `Hola ${p.client}, le escribe ${p.org}. Nuestra consulta ha cambiado. Ahora es el ${WORDS.es.when(p)}, durante ${p.minutes} minutos,`,
    cancelled: (p) =>
      `Hola ${p.client}, le escribe ${p.org}. Nuestra consulta del ${WORDS.es.when(p)} queda cancelada.`,
    how: {
      video: (p) => `por videollamada. El enlace: ${p.link}`,
      videoNoLink: () => 'por videollamada.',
      inPerson: (p) => `en persona, en ${p.where}.`,
      inPersonNoWhere: () => 'en persona.',
      phone: () => 'por teléfono. Le llamaremos.',
    },
    subject: (p) => `Consulta con ${p.org}, ${p.day}`,
    subjectCancelled: (p) => `Consulta cancelada, ${p.day}`,
  },
  fr: {
    when: (p) => `${p.day} à ${p.time}, heure de ${p.city}`,
    booked: (p) =>
      `Bonjour ${p.client}, ici ${p.org}, pour confirmer notre consultation : ${WORDS.fr.when(p)}, pendant ${p.minutes} minutes,`,
    changed: (p) =>
      `Bonjour ${p.client}, ici ${p.org}. Notre consultation a changé. Elle aura lieu ${WORDS.fr.when(p)}, pendant ${p.minutes} minutes,`,
    cancelled: (p) =>
      `Bonjour ${p.client}, ici ${p.org}. Notre consultation du ${WORDS.fr.when(p)} est annulée.`,
    how: {
      video: (p) => `en visioconférence. Le lien : ${p.link}`,
      videoNoLink: () => 'en visioconférence.',
      inPerson: (p) => `en personne, ${p.where}.`,
      inPersonNoWhere: () => 'en personne.',
      phone: () => 'par téléphone. Nous vous appellerons.',
    },
    subject: (p) => `Consultation avec ${p.org}, ${p.day}`,
    subjectCancelled: (p) => `Consultation annulée, ${p.day}`,
  },
  pt: {
    when: (p) => `${p.day}, ${p.hour === 1 ? 'à' : 'às'} ${p.time}, hora de ${p.city}`,
    booked: (p) =>
      `Olá ${p.client}, escreve-lhe ${p.org} para confirmar a nossa consulta: ${WORDS.pt.when(p)}, durante ${p.minutes} minutos,`,
    changed: (p) =>
      `Olá ${p.client}, escreve-lhe ${p.org}. A nossa consulta mudou. Passa a ser ${WORDS.pt.when(p)}, durante ${p.minutes} minutos,`,
    cancelled: (p) =>
      `Olá ${p.client}, escreve-lhe ${p.org}. A nossa consulta de ${WORDS.pt.when(p)} foi cancelada.`,
    how: {
      video: (p) => `por videochamada. O link: ${p.link}`,
      videoNoLink: () => 'por videochamada.',
      inPerson: (p) => `presencialmente, em ${p.where}.`,
      inPersonNoWhere: () => 'presencialmente.',
      phone: () => 'por telefone. Nós ligamos-lhe.',
    },
    subject: (p) => `Consulta com ${p.org}, ${p.day}`,
    subjectCancelled: (p) => `Consulta cancelada, ${p.day}`,
  },
};

export interface Message {
  body: string;
  subject: string;
}

export function messageOf(
  consultation: Consultation,
  said: Said,
  client: string,
  org: string,
  language: Language,
  now: string,
): Message {
  const words = WORDS[language];
  const { time, hour } = clockOf(consultation, language);
  const parts: Parts = {
    client,
    org,
    day: dayOf(consultation, language, now),
    time,
    hour,
    city: cityOf(consultation.timeZone, language),
    minutes: consultation.minutes,
    where: consultation.where ?? '',
    link: consultation.link ?? '',
  };

  if (said === 'cancelled')
    return { body: words.cancelled(parts), subject: words.subjectCancelled(parts) };

  const opening = said === 'changed' ? words.changed(parts) : words.booked(parts);

  return {
    body: `${opening} ${words.how[variantOf(consultation)](parts)}`,
    subject: words.subject(parts),
  };
}

/** WhatsApp's own address on the device, with the E.164 digits: never wa.me or any web page (sc-26025). */
export function whatsAppHref(phone: string, body: string): string {
  return `whatsapp://send?phone=${phone.replace(/\D/gu, '')}&text=${encodeURIComponent(body)}`;
}

/** RFC 6068: the address with its @ kept, and the subject and body percent-encoded, spaces as %20. */
export function mailtoHref(email: string, subject: string, body: string): string {
  const to = encodeURIComponent(email).replace(/%40/gu, '@');

  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function hrefOf(way: Way, reach: Reach, message: Message): string | null {
  if (way === 'whatsApp' && reach.phone != null) return whatsAppHref(reach.phone, message.body);
  if (way === 'email' && reach.email != null)
    return mailtoHref(reach.email, message.subject, message.body);

  return null;
}

export const TW = {
  tell: (client: string) => `Tell ${client}`,
  close: 'Close',
  language: 'Language',
  message: 'The message',
  ways: {
    whatsApp: 'Send on WhatsApp',
    email: 'Send by email',
    copy: 'Copy message',
  } satisfies Record<Way, string>,
  named: {
    whatsApp: (client: string) => `Send on WhatsApp to ${client}`,
    email: (client: string) => `Send by email to ${client}`,
    copy: (client: string) => `Copy message for ${client}`,
  } satisfies Record<Way, (client: string) => string>,
  subject: (subject: string) => `Subject: ${subject}`,
  copied: 'Copied',
  notCopied: 'Not copied. Press and hold the message to copy it.',
  offerLine: {
    booked: (client: string) => `Let ${client} know when and how.`,
    changed: (client: string) => `Let ${client} know what changed.`,
    cancelled: (client: string) => `Let ${client} know it is cancelled.`,
  } satisfies Record<Said, (client: string) => string>,
  done: 'Done',
  wouldOpen: 'In the product this opens, and the demo does not:',
  fromNotification: (words: string) => `Opened from the notification: “${words}”`,
  free: 'In a Free organisation Enquiries isn’t there: no enquiry page, no Consultations and no Tell {client}, as with the rest of Enquiries (sc-31226).',
  ledByChanged:
    'Led by moved from Folake Adeyemi to Kemi Ojo since it was booked: Tell still writes the booked message.',
  pressNotSeen:
    'Each press records the way, which message and the time, and nobody sees it: nothing is drawn for it.',
  copiedLook:
    'The look once Copy message has copied. Press it to copy for real: Copied shows only once the clipboard takes it.',
  simulatorLine:
    'On the iOS simulator there is no WhatsApp and no mail app, so only Copy message is offered.',
  proposal:
    'Every word is a proposal for [l10n]: en from the AC, es, fr and pt for them to settle.',
} as const;

export const TELL_NOW = '2026-11-10T10:00:00Z';
export const ORG = 'Casa Lume';

export const ANA: Enquiry = {
  id: 'enq-ana',
  client: 'Ana Ferreira',
  tab: 'open',
  type: 'wedding',
  date: '2027-06-19',
  assignedTo: 'folake',
  changedAt: '2026-11-09T16:00:00Z',
  phone: '+351912345678',
  email: 'ana.ferreira@example.pt',
  notes: 'Quinta in Sintra, about 90 guests.',
};

export const REACH: Reach = { phone: ANA.phone, email: ANA.email, best: 'whatsApp' };

const LISBON = 'Europe/Lisbon';

export const TOLD = {
  video: {
    id: 'con-video',
    startsAt: '2026-11-12T15:00:00Z',
    timeZone: LISBON,
    minutes: 60,
    how: 'video',
    where: null,
    link: 'https://meet.example.com/abc-defg-hij',
    ledBy: 'folake',
    cancelled: false,
  },
  visit: {
    id: 'con-visit',
    startsAt: '2026-11-19T10:30:00Z',
    timeZone: LISBON,
    minutes: 90,
    how: 'inPerson',
    where: 'Quinta da Regaleira, Rua Barbosa du Bocage 5, 2710-567 Sintra',
    link: null,
    ledBy: 'kemi',
    cancelled: false,
  },
  held: {
    id: 'con-held',
    startsAt: '2026-11-06T11:00:00Z',
    timeZone: LISBON,
    minutes: 30,
    how: 'phone',
    where: null,
    link: null,
    ledBy: 'folake',
    cancelled: false,
  },
  cancelledPast: {
    id: 'con-cancelled-past',
    startsAt: '2026-11-09T15:00:00Z',
    timeZone: LISBON,
    minutes: 60,
    how: 'video',
    where: null,
    link: 'https://meet.example.com/abc-defg-hij',
    ledBy: 'folake',
    cancelled: true,
  },
  inPerson: {
    id: 'con-in-person',
    startsAt: '2026-11-12T15:00:00Z',
    timeZone: LISBON,
    minutes: 60,
    how: 'inPerson',
    where: 'Casa Lume, Rua da Rosa 45, 1200-382 Lisboa',
    link: null,
    ledBy: 'folake',
    cancelled: false,
  },
  paris: {
    id: 'con-paris',
    startsAt: '2026-11-13T00:30:00Z',
    timeZone: 'Europe/Paris',
    minutes: 45,
    how: 'video',
    where: null,
    link: 'https://meet.example.com/abc-defg-hij',
    ledBy: 'folake',
    cancelled: false,
  },
  nextYear: {
    id: 'con-next-year',
    startsAt: '2027-01-12T15:00:00Z',
    timeZone: LISBON,
    minutes: 60,
    how: 'video',
    where: null,
    link: 'https://meet.example.com/abc-defg-hij',
    ledBy: 'folake',
    cancelled: false,
  },
} as const satisfies Record<string, Consultation>;

const MOVED_FROM: AsBooked = { ...asBooked(TOLD.video), startsAt: '2026-11-11T15:00:00Z' };

export const TELL_STATES = [
  'upcoming',
  'changed',
  'led-by-only',
  'cancelled-ahead',
  'held',
  'cancelled-past',
  'read-only-leader',
  'free',
  'video',
  'in-person',
  'in-person-no-where',
  'phone-call',
  'message-changed',
  'message-cancelled',
  'language-pt',
  'language-es-0130',
  'next-year',
  'order-whatsapp',
  'order-email',
  'order-text',
  'order-none',
  'phone-only',
  'email-only',
  'app-simulator',
  'copied',
  'offer-booked',
  'offer-changed',
  'offer-cancelled',
  'notification-changed',
  'notification-cancelled',
] as const;

export type TellState = (typeof TELL_STATES)[number];

export function tellStateOf(value: string | null | undefined): TellState {
  return TELL_STATES.find((state) => state === value) ?? 'upcoming';
}

export type Surface =
  { kind: 'none' } | { kind: 'tell'; id: string } | { kind: 'offer'; id: string; said: Said };

export interface TellStart {
  enquiry: Enquiry;
  viewer: Person;
  reach: Reach;
  device: Device;
  list: Consultation[];
  booked: Record<string, AsBooked>;
  surface: Surface;
  language: Language | null;
  copied: boolean;
  free: boolean;
  arrived: { id: string; words: string } | null;
  note: string | null;
}

function bookedAsIs(list: readonly Consultation[]): Record<string, AsBooked> {
  return Object.fromEntries(list.map((one) => [one.id, asBooked(one)]));
}

export function tellStart(state: TellState): TellStart {
  const list: Consultation[] = [TOLD.video, TOLD.visit];
  const start: TellStart = {
    enquiry: ANA,
    viewer: PEOPLE.folake,
    reach: REACH,
    device: EVERY_WAY,
    list,
    booked: bookedAsIs(list),
    surface: { kind: 'none' },
    language: null,
    copied: false,
    free: false,
    arrived: null,
    note: null,
  };
  const only = (one: Consultation, extra: Partial<TellStart> = {}): TellStart => ({
    ...start,
    list: [one, TOLD.visit],
    booked: bookedAsIs([one, TOLD.visit]),
    surface: { kind: 'tell', id: one.id },
    ...extra,
  });
  const moved = { ...start.booked, [TOLD.video.id]: MOVED_FROM };
  const cancelled = { ...TOLD.video, cancelled: true };
  const panel = { kind: 'tell', id: TOLD.video.id } as const;

  switch (state) {
    case 'upcoming':
      return start;
    case 'changed':
      return { ...start, booked: moved };
    case 'led-by-only':
      return {
        ...start,
        list: [{ ...TOLD.video, ledBy: 'kemi' }, TOLD.visit],
        note: TW.ledByChanged,
      };
    case 'cancelled-ahead':
      return { ...start, list: [cancelled, TOLD.visit] };
    case 'held':
      return { ...start, list: [TOLD.held, ...list], booked: bookedAsIs([TOLD.held, ...list]) };
    case 'cancelled-past':
      return {
        ...start,
        list: [TOLD.cancelledPast, ...list],
        booked: bookedAsIs([TOLD.cancelledPast, ...list]),
      };
    case 'read-only-leader':
      return {
        ...start,
        viewer: PEOPLE.tunde,
        list: [{ ...TOLD.video, ledBy: 'tunde' }, TOLD.visit],
      };
    case 'free':
      return { ...start, free: true };
    case 'video':
      return { ...start, surface: panel };
    case 'in-person':
      return only(TOLD.inPerson);
    case 'in-person-no-where':
      return only({ ...TOLD.inPerson, where: null });
    case 'phone-call':
      return only({ ...TOLD.inPerson, how: 'phone', where: null });
    case 'message-changed':
      return { ...start, booked: moved, surface: panel };
    case 'message-cancelled':
      return { ...start, list: [cancelled, TOLD.visit], surface: panel };
    case 'language-pt':
      return { ...start, surface: panel, language: 'pt' };
    case 'language-es-0130':
      return only(TOLD.paris, { language: 'es' });
    case 'next-year':
      return only(TOLD.nextYear);
    case 'order-whatsapp':
      return { ...start, surface: panel, reach: { ...REACH, best: 'whatsApp' } };
    case 'order-email':
      return { ...start, surface: panel, reach: { ...REACH, best: 'email' } };
    case 'order-text':
      return { ...start, surface: panel, reach: { ...REACH, best: 'textMessage' } };
    case 'order-none':
      return { ...start, surface: panel, reach: { ...REACH, best: null } };
    case 'phone-only':
      return { ...start, surface: panel, reach: { ...REACH, email: null } };
    case 'email-only':
      return { ...start, surface: panel, reach: { ...REACH, phone: null } };
    case 'app-simulator':
      return { ...start, surface: panel, device: SIMULATOR, note: TW.simulatorLine };
    case 'copied':
      return { ...start, surface: panel, copied: true, note: TW.copiedLook };
    case 'offer-booked':
      return { ...start, surface: { kind: 'offer', id: TOLD.video.id, said: 'booked' } };
    case 'offer-changed':
      return {
        ...start,
        booked: moved,
        surface: { kind: 'offer', id: TOLD.video.id, said: 'changed' },
      };
    case 'offer-cancelled':
      return {
        ...start,
        list: [cancelled, TOLD.visit],
        surface: { kind: 'offer', id: TOLD.video.id, said: 'cancelled' },
      };
    case 'notification-changed':
      return {
        ...start,
        viewer: PEOPLE.kemi,
        booked: {
          ...start.booked,
          [TOLD.visit.id]: { ...asBooked(TOLD.visit), startsAt: '2026-11-18T10:30:00Z' },
        },
        arrived: {
          id: TOLD.visit.id,
          words: CW.moved(PEOPLE.folake.name, ANA.client, 'Thursday, Nov 19, 10:30'),
        },
      };
    case 'notification-cancelled':
      return {
        ...start,
        viewer: PEOPLE.kemi,
        list: [TOLD.video, { ...TOLD.visit, cancelled: true }],
        arrived: {
          id: TOLD.visit.id,
          words: CW.cancelledBy(PEOPLE.folake.name, ANA.client, 'Thursday, Nov 19, 10:30'),
        },
      };
    default:
      return start;
  }
}

const STATE_WORDS: Record<TellState, [string, string]> = {
  upcoming: [
    'Row · upcoming',
    'Tell Ana Ferreira on each upcoming consultation: the booked message',
  ],
  changed: ['Row · changed', 'Moved since booking: the changed message'],
  'led-by-only': ['Row · Led by only', 'Only Led by changed: still the booked message'],
  'cancelled-ahead': ['Row · cancelled, still ahead', 'The cancelled message'],
  held: ['Row · Held', 'No Tell on a Held consultation'],
  'cancelled-past': ['Row · cancelled, passed', 'No Tell once its start has passed'],
  'read-only-leader': ['Row · a Member who leads it', 'Reads the page, and Tell still shows'],
  free: ['A Free organisation', 'None of Enquiries shows'],
  video: ['Tell · video call', 'The default: message, Language and the ways'],
  'in-person': ['Tell · in person', 'The Where line as typed'],
  'in-person-no-where': ['Tell · in person, no Where', 'Only “in person”'],
  'phone-call': ['Tell · phone call', '“We’ll call you”'],
  'message-changed': ['Tell · changed', 'Our consultation has changed'],
  'message-cancelled': ['Tell · cancelled', 'The cancelled message and subject'],
  'language-pt': ['Tell · Português', '“às 15:00, hora de Lisboa”'],
  'language-es-0130': ['Tell · Español, 01:30 in Paris', '“a la 01:30, hora de París”'],
  'next-year': ['Tell · next year', 'The date shows the year'],
  'order-whatsapp': ['Tell · best way WhatsApp', 'Send on WhatsApp first'],
  'order-email': ['Tell · best way Email', 'Send by email first'],
  'order-text': ['Tell · best way Text message', 'Copy message first'],
  'order-none': ['Tell · no best way', 'WhatsApp, email, Copy'],
  'phone-only': ['Tell · a phone only', 'No Send by email'],
  'email-only': ['Tell · an email only', 'No Send on WhatsApp'],
  'app-simulator': ['Tell · the iOS simulator', 'Only Copy message (the app only)'],
  copied: ['Tell · Copied', 'Copied, read out'],
  'offer-booked': ['Offer · after Book', 'Booked, with Tell Ana Ferreira next'],
  'offer-changed': ['Offer · after a change', 'Changed, with Tell Ana Ferreira next'],
  'offer-cancelled': ['Offer · after Cancel', 'Cancelled, with Tell Ana Ferreira next'],
  'notification-changed': ['Notification · moved', 'Opens the page at that consultation'],
  'notification-cancelled': ['Notification · cancelled', 'Opens the page at that consultation'],
};

export const TELL_BOARDS: readonly {
  state: TellState;
  title: string;
  what: string;
  href: string;
}[] = TELL_STATES.map((state) => ({
  state,
  title: STATE_WORDS[state][0],
  what: STATE_WORDS[state][1],
  href: `/demo/tell-client?state=${state}`,
}));
