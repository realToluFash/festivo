import { EVENT, GUEST, type Layout, type Lang } from './guest.ts';
import type { DemoLink } from './settings.ts';

/** The phone in the guest's hand decides the button, not the width (sc-9956, Decided, 24 Oct). */
export type Device = 'ios' | 'android' | 'desktop';

export type Offer = 'apple' | 'google' | 'line';

const DEVICES: readonly Device[] = ['ios', 'android', 'desktop'];

export function isDevice(value: string | null): value is Device {
  return value != null && (DEVICES as readonly string[]).includes(value);
}

/** The board's `wallet` tweak: named in the query, else an iPhone on a phone and a computer or tablet elsewhere. */
export function deviceOf(param: string | null, layout: Layout): Device {
  if (isDevice(param)) return param;

  return layout === 'phone' || layout === 'small' ? 'ios' : 'desktop';
}

/** An iPad and an Android tablet count as `desktop`: neither adds a pass from a page. */
export function offerFor(device: Device): Offer {
  if (device === 'ios') return 'apple';
  if (device === 'android') return 'google';

  return 'line';
}

export type Face = 'apple' | 'apple-back' | 'google' | 'google-details' | 'google-emptied';

const FACES: readonly Face[] = [
  'apple',
  'apple-back',
  'google',
  'google-details',
  'google-emptied',
];

export function faceOf(param: string | null): Face {
  return param != null && (FACES as readonly string[]).includes(param) ? (param as Face) : 'apple';
}

export type Names = 'page' | 'long';

/** The page's own sample, and sc-4329's long-names fixture. */
export const NAMES: Record<Names, { event: string; guest: string }> = {
  page: { event: EVENT.name, guest: GUEST },
  long: {
    event: 'Golden Wedding Thanksgiving',
    guest: 'Chief Olusegun Adebayo-Williams and Dr. Funmilayo Adebayo-Williams',
  },
};

export function namesOf(param: string | null): Names {
  return param === 'long' ? 'long' : 'page';
}

/** Who issued the pass: the same in every language (sc-9956, Decided, 24 Oct: the pass's face). */
export const ISSUER = 'Soirely';

interface WalletWords {
  apple: string;
  google: string;
  openOnPhone: string;
  latest: string;
  emptied: string;
  expired: string;
  description: (event: string) => string;
  eventLabel: string;
  guestLabel: string;
}

/** English from the AC and #9968, #10020; es, fr and pt are [bracketed] samples until l10n words them. */
export const WALLET_WORDS: Record<Lang, WalletWords> = {
  en: {
    apple: 'Add to Apple Wallet',
    google: 'Add to Google Wallet',
    openOnPhone: 'Open this page on your phone to save it to your wallet.',
    latest: 'Your own page has the latest date, time and place.',
    emptied: 'This pass is no longer valid',
    expired: 'Expired',
    description: (event) => `Your check-in code for ${event}`,
    eventLabel: 'Event',
    guestLabel: 'Guest',
  },
  es: {
    apple: '[Añadir a Apple Wallet]',
    google: '[Añadir a Google Wallet]',
    openOnPhone: '[Abra esta página en su móvil para guardarla en su cartera.]',
    latest: '[Su propia página tiene la fecha, la hora y el lugar más recientes.]',
    emptied: '[Este pase ya no es válido]',
    expired: '[Caducado]',
    description: (event) => `[Su código de entrada para ${event}]`,
    eventLabel: '[Evento]',
    guestLabel: '[Invitado]',
  },
  fr: {
    apple: '[Ajouter à Apple Wallet]',
    google: '[Ajouter à Google Wallet]',
    openOnPhone:
      '[Ouvrez cette page sur votre téléphone pour l’enregistrer dans votre portefeuille.]',
    latest: '[Votre page a la date, l’heure et le lieu les plus récents.]',
    emptied: '[Ce pass n’est plus valide]',
    expired: '[Expiré]',
    description: (event) => `[Votre code d’entrée pour ${event}]`,
    eventLabel: '[Événement]',
    guestLabel: '[Invité]',
  },
  pt: {
    apple: '[Adicionar à Apple Wallet]',
    google: '[Adicionar ao Google Wallet]',
    openOnPhone: '[Abra esta página no telemóvel para a guardar na sua carteira.]',
    latest: '[A sua página tem a data, a hora e o local mais recentes.]',
    emptied: '[Este passe já não é válido]',
    expired: '[Expirado]',
    description: (event) => `[O seu código de entrada para ${event}]`,
    eventLabel: '[Evento]',
    guestLabel: '[Convidado]',
  },
};

export function isLang(value: string | null): value is Lang {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'pt';
}

/** Everything a pass carries. Nothing else about the guest or the event exists to put on it (GDPR Art. 5(1)(c)). */
export type PassContent =
  | { kind: 'live'; issuer: string; event: string; guest: string; door: string; code: true }
  | { kind: 'emptied'; issuer: string; header: string; expired: string };

export function passContent(face: Face, names: Names, lang: Lang, door: string): PassContent {
  if (face === 'google-emptied') {
    const words = WALLET_WORDS[lang];

    return { kind: 'emptied', issuer: ISSUER, header: words.emptied, expired: words.expired };
  }

  const { event, guest } = NAMES[names];

  return { kind: 'live', issuer: ISSUER, event, guest, door, code: true };
}

const at = (query: string): string => `/demo/wallet-pass?${query}`;

export const WALLET_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The button in the code card',
    states: [
      { to: '/demo/guest?state=coming&wallet=ios', name: 'iPhone: Add to Apple Wallet' },
      {
        to: '/demo/guest?state=coming&wallet=android',
        name: 'Android phone: Add to Google Wallet',
      },
      {
        to: '/demo/guest?state=coming&wallet=desktop',
        name: 'Computer, iPad or Android tablet: the line under the card',
      },
      { to: '/demo/guest?state=comingAlone&wallet=ios', name: 'Coming alone, iPhone' },
      { to: '/demo/guest?state=closed&wallet=android', name: 'Answers closed, Coming, Android' },
      { to: '/demo/guest?state=notComing&wallet=ios', name: 'Not coming: no card, no button' },
      { to: '/demo/guest?state=notSure&wallet=desktop', name: 'Not sure: no card, no line' },
      {
        to: '/demo/guest?state=onTheDay&wallet=ios',
        name: 'On the event’s day, iPhone: Your code leads',
      },
      { to: '/demo/guest?state=onTheDay&wallet=desktop', name: 'On the event’s day, computer' },
    ],
  },
  {
    name: 'The pass in the wallet',
    states: [
      { to: at('face=apple'), name: 'Apple Wallet, front' },
      { to: at('face=apple-back'), name: 'Apple Wallet, back' },
      { to: at('face=google'), name: 'Google Wallet, face' },
      { to: at('face=google-details'), name: 'Google Wallet, details' },
      { to: at('face=google-emptied'), name: 'Google Wallet, emptied on erasure or deletion' },
      { to: at('face=apple&names=long&lang=fr'), name: 'Long names, in French' },
      { to: at('face=google&names=long&lang=pt'), name: 'Long names, in Portuguese' },
      { to: at('face=apple-back&names=long&lang=es'), name: 'Long names on the back, in Spanish' },
    ],
  },
];
