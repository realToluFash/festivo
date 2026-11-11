import { ApiError, type PhoneCodeRoute } from '@soirely/api-client';
import {
  CONTACTS_MOST,
  type ZoneRow,
  callingCode,
  cleanCode,
  contactsLeft,
  formatCountdown,
  formatPhone,
  primaryFirst,
  zoneLabel,
} from '@soirely/domain';

import { type CodeSource } from '../codeCheck.ts';
import { type ProveWith } from '../proving.ts';
import { SAMPLE } from './rules.ts';
import { type DemoLink, VIEWERS, type Viewer, settingsPath } from './settings.ts';

export type Kind = 'email' | 'phone';
export type Channel = 'email' | 'whatsApp' | 'text';

export interface Contact {
  id: string;
  kind: Kind;
  shown: string;
  verified: boolean;
  primary: boolean;
}

export const PHONE_COUNTRY = SAMPLE.country;
export const FIRST_PHONE = formatPhone(`${callingCode(SAMPLE.country) ?? ''}${SAMPLE.number}`);
export const SECOND_PHONE = '+44 7700 900461';
export const WRONG_CODE = '482170';
export const WRONG_FACTOR = '714 320';
export const SEND_MS = 500;
export const RESEND_FROM = 42;

export const ACCOUNT_WORDS = {
  title: 'Your account',
  about: 'About you',
  yourName: 'Your name',
  zoneLine: (id: string) => `Time zone · ${id.replace(/_/g, ' ')}`,
  sendCode: 'Send a code',
  notYet: (shown: string) => `${shown} is not verified yet.`,
  unverified: 'Unverified',
  makePrimary: 'Make primary',
  remove: 'Remove',
  removeAsking: 'Remove…',
  removeLine: 'Soirely stops sending anything to it. You can add it again later, with a new code.',
  keepIt: 'Keep it',
  removeIt: 'Remove it',
  promoteTitle: 'Make this your primary address?',
  promoteLine: (primary: string) =>
    `You will sign in with it from now on, and account mail goes there. ${primary} stays linked and stops signing you in.`,
  keepPrimary: (primary: string) => `Keep ${primary}`,
  promoteGo: 'Make it primary',
  full: `You have ${CONTACTS_MOST}, the most an account can hold. Remove one to add another.`,
  added: 'Added. It is unverified until you enter the code we sent.',
  nameSaved: (name: string) => `Name changed to ${name}.`,
  zoneSaved: (zone: string) => `Time zone changed to ${zone}. Times in your emails now use it.`,
  language: 'Language',
  languageFoot:
    'Every device you sign in on shows Soirely in it, and your emails are written in it. It changes as soon as you choose.',
  languageSaved: (name: string) => `Soirely is now in ${name}, on every device and in your emails.`,
  removed: (shown: string) => `${shown} has been removed.`,
} as const;

export const KIND_WORDS = {
  email: {
    title: 'Email addresses',
    add: 'Add an email address',
    many: 'email addresses',
    one: 'address',
    primaryLine: 'Primary · signs you in',
    otherLine: 'Can reach you, cannot sign you in',
    removeTitle: 'Remove this address?',
    linked: 'That address is already linked to an account.',
    madePrimary: (shown: string) =>
      `${shown} is now your primary address. Sign in with it from now on.`,
  },
  phone: {
    title: 'Phone numbers',
    add: 'Add a phone number',
    many: 'phone numbers',
    one: 'number',
    primaryLine: 'Primary · on your profile',
    otherLine: 'Can reach you',
    removeTitle: 'Remove this number?',
    linked: 'That number is already linked to an account.',
    madePrimary: (shown: string) => `${shown} is now your primary number.`,
  },
} as const;

export const DISCARD = {
  title: 'Discard your change?',
  keep: 'Keep editing',
  go: 'Discard',
  nothingAdded: 'Nothing is added.',
} as const;

export const ADD_WORDS = {
  verb: 'Add',
  shape: 'That does not look like an email address. Check it has an @ and a domain.',
  country: 'Country',
} as const;

export const PROVE_WORDS = {
  title: 'Confirm it’s you',
  verb: 'Continue',
  intro: 'Confirm it’s you before changing the address you sign in with.',
  password: 'Your password',
  code: 'Code',
  codeHelp: 'From your authenticator app, or one of your recovery codes.',
  passwordBlank: 'Enter your password.',
  passwordWrong: 'That is not your password. Try again, or reset it by email.',
  codeBlank: 'Enter a code from your app, or a recovery code.',
  codeWrong: 'That code did not work. Check your app and try again.',
} as const;

export const VERIFY_WORDS = {
  verb: 'Verify',
  short: 'The code is 6 digits.',
  expired: 'That code has expired',
  expiredLine: (newest: string) =>
    `Codes only work for a while. Send a new one and use the code in the newest ${newest}.`,
  resend: 'Send a new code',
  resendIn: (left: number) => `Send a new code in ${formatCountdown(left)}`,
  resendNote: 'A new code replaces the last one.',
  textInstead: 'Text it to me instead',
} as const;

export const CHANNEL_WORDS: Record<
  Channel,
  {
    title: string;
    intro: (shown: string) => string;
    field: string;
    blank: string;
    wrong: string;
    newest: string;
  }
> = {
  email: {
    title: 'Check your email',
    intro: (shown) => `We sent a code to ${shown}. Enter it here to show the address is yours.`,
    field: 'Code from the email',
    blank: 'Enter the 6-digit code from the email.',
    wrong: 'That code does not match. Check the newest email from Soirely and try again.',
    newest: 'email',
  },
  whatsApp: {
    title: 'Check your messages',
    intro: (shown) => `We sent a code to your WhatsApp on ${shown}.`,
    field: 'Code from WhatsApp',
    blank: 'Enter the 6-digit code from WhatsApp.',
    wrong:
      'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
    newest: 'text',
  },
  text: {
    title: 'Check your messages',
    intro: (shown) => `We texted the same code to ${shown}. The one on WhatsApp works too.`,
    field: 'Code from the text',
    blank: 'Enter the 6-digit code from the text.',
    wrong: 'That code does not match. Check the newest text from Soirely and try again.',
    newest: 'text',
  },
};

export const HOME_ZONE: ZoneRow = {
  id: 'Africa/Lagos',
  city: 'Lagos',
  country: 'Nigeria',
  offset: '+01:00',
};

/** The app's sample of zones, offsets as they stand in November. */
export const ZONES: readonly ZoneRow[] = [
  { id: 'Africa/Abidjan', city: 'Abidjan', country: 'Côte d’Ivoire', offset: '+00:00' },
  { id: 'Africa/Accra', city: 'Accra', country: 'Ghana', offset: '+00:00' },
  { id: 'Europe/Berlin', city: 'Berlin', country: 'Germany', offset: '+01:00' },
  { id: 'America/Bogota', city: 'Bogotá', country: 'Colombia', offset: '-05:00' },
  {
    id: 'America/Argentina/Buenos_Aires',
    city: 'Buenos Aires',
    country: 'Argentina',
    offset: '-03:00',
  },
  { id: 'Africa/Dakar', city: 'Dakar', country: 'Senegal', offset: '+00:00' },
  { id: 'Asia/Dubai', city: 'Dubai', country: 'United Arab Emirates', offset: '+04:00' },
  { id: 'Africa/Johannesburg', city: 'Johannesburg', country: 'South Africa', offset: '+02:00' },
  { id: 'Africa/Kinshasa', city: 'Kinshasa', country: 'Congo - Kinshasa', offset: '+01:00' },
  {
    id: 'Asia/Kolkata',
    city: 'Kolkata',
    country: 'India',
    offset: '+05:30',
    aliases: ['Calcutta'],
    formerName: 'Calcutta',
  },
  HOME_ZONE,
  { id: 'Europe/Lisbon', city: 'Lisbon', country: 'Portugal', offset: '+00:00' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', offset: '+00:00' },
  { id: 'America/Los_Angeles', city: 'Los Angeles', country: 'United States', offset: '-08:00' },
  { id: 'Africa/Luanda', city: 'Luanda', country: 'Angola', offset: '+01:00' },
  { id: 'Europe/Madrid', city: 'Madrid', country: 'Spain', offset: '+01:00' },
  { id: 'Africa/Maputo', city: 'Maputo', country: 'Mozambique', offset: '+02:00' },
  { id: 'America/Mexico_City', city: 'Mexico City', country: 'Mexico', offset: '-06:00' },
  { id: 'Africa/Nairobi', city: 'Nairobi', country: 'Kenya', offset: '+03:00' },
  { id: 'America/New_York', city: 'New York', country: 'United States', offset: '-05:00' },
  { id: 'Europe/Paris', city: 'Paris', country: 'France', offset: '+01:00' },
  { id: 'Europe/San_Marino', city: 'San Marino', country: 'San Marino', offset: '+01:00' },
  { id: 'America/El_Salvador', city: 'San Salvador', country: 'El Salvador', offset: '-06:00' },
  { id: 'America/Santarem', city: 'Santarém', country: 'Brazil', offset: '-03:00' },
  { id: 'America/Santiago', city: 'Santiago', country: 'Chile', offset: '-03:00' },
  {
    id: 'America/Santo_Domingo',
    city: 'Santo Domingo',
    country: 'Dominican Republic',
    offset: '-04:00',
  },
  { id: 'America/Sao_Paulo', city: 'São Paulo', country: 'Brazil', offset: '-03:00' },
  { id: 'Australia/Sydney', city: 'Sydney', country: 'Australia', offset: '+11:00' },
  { id: 'Asia/Tokyo', city: 'Tokyo', country: 'Japan', offset: '+09:00' },
  { id: 'America/Toronto', city: 'Toronto', country: 'Canada', offset: '-05:00' },
];

const SAN_MARINO = ZONES.find((zone) => zone.id === 'Europe/San_Marino') ?? HOME_ZONE;

function contact(id: string, kind: Kind, shown: string, verified = true, primary = false): Contact {
  return { id, kind, shown, verified, primary };
}

/** The viewer's own account: their name and address, and the sample's second address and numbers. */
export function yourAccount(viewer: Pick<Viewer, 'key' | 'name' | 'id'>) {
  const other =
    viewer.key === 'folake'
      ? SAMPLE.otherEmail
      : `${viewer.name.toLowerCase().replace(/\s+/g, '.')}@outlook.com`;

  return {
    name: viewer.name,
    newName: `${viewer.name}-Bello`,
    email: contact('email-1', 'email', viewer.id, true, true),
    other: contact('email-2', 'email', other, false),
    phone: contact('phone-1', 'phone', FIRST_PHONE, true, true),
    otherPhone: contact('phone-2', 'phone', SECOND_PHONE, false),
  };
}

/** What is unfinished, or what was just done, with the card's one step while anything is unverified. */
export function cardLine(
  emails: readonly Contact[],
  phones: readonly Contact[],
  said: string | null,
): { line: string | null; done: boolean; waiting: Contact | null } {
  const waiting =
    [...primaryFirst(emails), ...primaryFirst(phones)].find((row) => !row.verified) ?? null;

  if (said != null) return { line: said, done: true, waiting };

  return {
    line: waiting == null ? null : ACCOUNT_WORDS.notYet(waiting.shown),
    done: false,
    waiting,
  };
}

export function rowLine(row: Contact): string {
  return row.primary ? KIND_WORDS[row.kind].primaryLine : KIND_WORDS[row.kind].otherLine;
}

export function contactsFoot(kind: Kind, rows: readonly Contact[]): string {
  const left = contactsLeft(rows);
  if (left === 0) return ACCOUNT_WORDS.full;
  const more = left === 1 ? 'You can add one more.' : `You can add ${left} more.`;

  return `${more} An account holds up to ${CONTACTS_MOST} ${KIND_WORDS[kind].many}, including the primary.`;
}

export function canAdd(rows: readonly Contact[]): boolean {
  return contactsLeft(rows) > 0;
}

export function verifiedWords(row: Contact): string {
  return `${row.shown} is verified. It stays an alternative ${KIND_WORDS[row.kind].one} until you make it primary.`;
}

export function madePrimary(rows: readonly Contact[], id: string): Contact[] {
  return rows.map((row) => ({ ...row, primary: row.id === id }));
}

export function phoneShown(country: string, typed: string): string {
  return formatPhone(`${callingCode(country) ?? ''}${typed.replace(/\D/gu, '')}`);
}

export function sampleRefusal(code: string): ApiError {
  return new ApiError({ type: `https://soirely.com/errors/${code}`, title: code, status: 422 });
}

export function afterSending<T>(answer: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(answer());
      } catch (refusal) {
        reject(refusal instanceof Error ? refusal : new Error(String(refusal)));
      }
    }, SEND_MS),
  );
}

/** What a save does in the sample: it goes after a moment, or the server's reason comes back. */
export function sampleSave(refusal: string | null, saved: () => void): Promise<string | null> {
  return afterSending(() => {
    if (refusal == null) saved();

    return refusal;
  });
}

/** The sample's code check: the code goes to the opening's channel, and only the sample's code verifies. */
export function sampleCodeSource(start: DialogStart): CodeSource {
  let route: PhoneCodeRoute | null =
    start.channel === 'email' ? null : start.channel === 'text' ? 'sms_chosen' : 'whatsapp';

  return {
    opening: () =>
      Promise.resolve({
        cooldownSeconds: start.expired ? 0 : RESEND_FROM,
        codeState: start.expired ? 'expired' : 'live',
        route,
      }),
    verify: (code) =>
      afterSending(() => {
        if (code !== SAMPLE.code) throw sampleRefusal('verification_code_invalid');

        return { primary: false };
      }),
    resend: () => afterSending(() => RESEND_FROM),
    textInstead: () =>
      afterSending(() => {
        route = 'sms_chosen';
      }),
  };
}

/** The sample's proof: its password, then its authenticator or a recovery code. */
export function sampleProof(first: ProveWith, code?: string): Promise<string> {
  return afterSending(() => {
    if ('password' in first && first.password !== SAMPLE.password)
      throw sampleRefusal('invalid_credentials');
    const factor = cleanCode(code ?? '').toLowerCase();
    if (factor !== SAMPLE.authenticator && factor !== SAMPLE.recovery)
      throw sampleRefusal('two_factor_code_invalid');

    return 'sample-proof';
  });
}

export type DialogKind = 'name' | 'zone' | 'addEmail' | 'addPhone' | 'confirm' | 'verify';

export interface DialogStart {
  kind: DialogKind;
  typed: string;
  tried: boolean;
  discarding: boolean;
  picked: ZoneRow | null;
  contact: string | null;
  channel: Channel;
  expired: boolean;
}

export function opening(kind: DialogKind, more: Partial<DialogStart> = {}): DialogStart {
  return {
    kind,
    typed: '',
    tried: false,
    discarding: false,
    picked: null,
    contact: null,
    channel: 'email',
    expired: false,
    ...more,
  };
}

export interface AccountStart {
  name: string;
  zone: ZoneRow;
  /** The account's language, one of the four codes. */
  language: string;
  emails: Contact[];
  phones: Contact[];
  said: string | null;
  open: string | null;
  ask: 'promote' | 'remove' | null;
  dialog: DialogStart | null;
}

/** The app's states after the page at rest, then the moments only the web links to. */
export const ACCOUNT_STATES = [
  'name',
  'promote',
  'confirm',
  'remove',
  'addEmail',
  'addPhone',
  'zone',
  'verifyEmail',
  'verifyEmailWrong',
  'verifyEmailExpired',
  'verifyEmailDone',
  'verifyPhone',
  'verifyPhoneExpired',
  'verifyPhoneDone',
] as const;

export const WEB_MOMENTS = [
  'open',
  'openVerified',
  'allVerified',
  'nameBlank',
  'nameDiscard',
  'nameSaved',
  'zoneNotPicked',
  'zoneNone',
  'zonePicked',
  'zoneSaved',
  'confirmWrong',
  'madePrimary',
  'removed',
  'addEmailShape',
  'addEmailLinked',
  'addEmailDiscard',
  'added',
  'addPhoneShort',
  'verifyPhoneTexted',
  'languageSaved',
] as const;

type AccountState = (typeof ACCOUNT_STATES)[number] | (typeof WEB_MOMENTS)[number];

function stateOf(name: string): AccountState | null {
  return [...ACCOUNT_STATES, ...WEB_MOMENTS].find((state) => state === name) ?? null;
}

/** What a state link opens on; one the page does not know opens it at rest. */
export function accountStart(state: string, viewer: Viewer = VIEWERS.folake): AccountStart {
  const name = stateOf(state);
  const you = yourAccount(viewer);
  const [EMAIL_1, EMAIL_2, PHONE_1, PHONE_2] = [you.email, you.other, you.phone, you.otherPhone];
  const PROVED = [EMAIL_1, { ...EMAIL_2, verified: true }];
  const REST: AccountStart = {
    name: you.name,
    zone: HOME_ZONE,
    language: 'en',
    emails: [EMAIL_1, EMAIL_2],
    phones: [PHONE_1],
    said: null,
    open: null,
    ask: null,
    dialog: null,
  };
  const proved = { ...REST, emails: PROVED };
  const onlyPrimary = { ...REST, emails: [EMAIL_1] };
  const secondPhone = { ...REST, phones: [PHONE_1, PHONE_2] };
  const verify = (channel: Channel, more: Partial<DialogStart> = {}) =>
    opening('verify', { contact: channel === 'email' ? EMAIL_2.id : PHONE_2.id, channel, ...more });

  switch (name) {
    case null:
      return REST;
    case 'open':
      return { ...REST, open: EMAIL_2.id };
    case 'openVerified':
      return { ...proved, open: EMAIL_2.id };
    case 'allVerified':
      return proved;
    case 'name':
      return { ...REST, dialog: opening('name', { typed: you.name }) };
    case 'nameBlank':
      return { ...REST, dialog: opening('name', { tried: true }) };
    case 'nameDiscard':
      return { ...REST, dialog: opening('name', { typed: you.newName, discarding: true }) };
    case 'nameSaved':
      return { ...REST, name: you.newName, said: ACCOUNT_WORDS.nameSaved(you.newName) };
    case 'zone':
      return { ...REST, dialog: opening('zone', { typed: 'San' }) };
    case 'zoneNotPicked':
      return { ...REST, dialog: opening('zone', { typed: 'San', tried: true }) };
    case 'zoneNone':
      return { ...REST, dialog: opening('zone', { typed: 'Atlantis' }) };
    case 'zonePicked':
      return {
        ...REST,
        dialog: opening('zone', { typed: zoneLabel(SAN_MARINO), picked: SAN_MARINO }),
      };
    case 'zoneSaved':
      return { ...REST, zone: SAN_MARINO, said: ACCOUNT_WORDS.zoneSaved(zoneLabel(SAN_MARINO)) };
    case 'languageSaved':
      return { ...REST, language: 'fr', said: ACCOUNT_WORDS.languageSaved('Français') };
    case 'promote':
      return { ...proved, open: EMAIL_2.id, ask: 'promote' };
    case 'confirm':
    case 'confirmWrong':
      return {
        ...proved,
        open: EMAIL_2.id,
        dialog: opening('confirm', {
          contact: EMAIL_2.id,
          tried: name === 'confirmWrong',
          typed: name === 'confirmWrong' ? WRONG_FACTOR : '',
        }),
      };
    case 'madePrimary':
      return {
        ...proved,
        emails: madePrimary(PROVED, EMAIL_2.id),
        said: KIND_WORDS.email.madePrimary(EMAIL_2.shown),
      };
    case 'remove':
      return { ...proved, open: EMAIL_2.id, ask: 'remove' };
    case 'removed':
      return { ...onlyPrimary, said: ACCOUNT_WORDS.removed(EMAIL_2.shown) };
    case 'addEmail':
      return { ...onlyPrimary, dialog: opening('addEmail') };
    case 'addEmailShape':
      return {
        ...onlyPrimary,
        dialog: opening('addEmail', { typed: 'folake.adeyemi@gmail', tried: true }),
      };
    case 'addEmailLinked':
      return { ...onlyPrimary, dialog: opening('addEmail', { typed: EMAIL_1.shown, tried: true }) };
    case 'addEmailDiscard':
      return {
        ...onlyPrimary,
        dialog: opening('addEmail', { typed: 'folake@lumen.studio', discarding: true }),
      };
    case 'added':
      return { ...REST, said: ACCOUNT_WORDS.added };
    case 'addPhone':
      return { ...REST, dialog: opening('addPhone') };
    case 'addPhoneShort':
      return { ...REST, dialog: opening('addPhone', { typed: '7400 12', tried: true }) };
    case 'verifyEmail':
      return { ...REST, dialog: verify('email') };
    case 'verifyEmailWrong':
      return { ...REST, dialog: verify('email', { typed: WRONG_CODE, tried: true }) };
    case 'verifyEmailExpired':
      return { ...REST, dialog: verify('email', { expired: true }) };
    case 'verifyEmailDone':
      return { ...proved, said: verifiedWords({ ...EMAIL_2, verified: true }) };
    case 'verifyPhone':
      return { ...secondPhone, dialog: verify('whatsApp') };
    case 'verifyPhoneTexted':
      return { ...secondPhone, dialog: verify('text') };
    case 'verifyPhoneExpired':
      return { ...secondPhone, dialog: verify('whatsApp', { expired: true }) };
    case 'verifyPhoneDone':
      return {
        ...proved,
        phones: [PHONE_1, { ...PHONE_2, verified: true }],
        said: verifiedWords({ ...PHONE_2, verified: true }),
      };
  }
}

function account(state: string | undefined, name: string): DemoLink {
  return { to: settingsPath('account', VIEWERS.folake, state), name };
}

export const ACCOUNT_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The page',
    states: [
      account(undefined, 'At rest, an address not verified yet'),
      { to: settingsPath('account', VIEWERS.julien), name: 'The same for an admin' },
      { to: settingsPath('account', VIEWERS.ana), name: 'The same for a member' },
      account('open', 'An unverified address, opened'),
      account('openVerified', 'A verified address, opened'),
      account('allVerified', 'Everything verified'),
    ],
  },
  {
    name: 'Your name and time zone',
    states: [
      account('name', 'Name'),
      account('nameBlank', 'Name, left blank'),
      account('nameDiscard', 'Name, Cancel after a change'),
      account('nameSaved', 'Name saved'),
      account('zone', 'Time zone, San typed'),
      account('zoneNotPicked', 'Time zone, not picked'),
      account('zoneNone', 'Time zone, nothing matches'),
      account('zonePicked', 'Time zone, picked'),
      account('zoneSaved', 'Time zone saved'),
    ],
  },
  {
    name: 'Language, moved here from the band (sc-39509)',
    states: [
      account(undefined, 'English, the account’s language'),
      account('languageSaved', 'Français chosen, saved at once'),
    ],
  },
  {
    name: 'Making primary and removing',
    states: [
      account('promote', 'Make this your primary address?'),
      account('confirm', 'Confirm it’s you'),
      account('confirmWrong', 'Confirm it’s you, a wrong code'),
      account('madePrimary', 'Primary changed'),
      account('remove', 'Remove this address?'),
      account('removed', 'Address removed'),
    ],
  },
  {
    name: 'Adding',
    states: [
      account('addEmail', 'Add an email address'),
      account('addEmailShape', 'Add, not an address'),
      account('addEmailLinked', 'Add, already linked'),
      account('addEmailDiscard', 'Add, Cancel after typing'),
      account('added', 'Added'),
      account('addPhone', 'Add a phone number'),
      account('addPhoneShort', 'Add, too short'),
    ],
  },
  {
    name: 'Verifying',
    states: [
      account('verifyEmail', 'Check your email'),
      account('verifyEmailWrong', 'A wrong code'),
      account('verifyEmailExpired', 'The code expired'),
      account('verifyEmailDone', 'Email verified'),
      account('verifyPhone', 'Check your messages, on WhatsApp'),
      account('verifyPhoneTexted', 'Texted instead'),
      account('verifyPhoneExpired', 'The code expired, a number'),
      account('verifyPhoneDone', 'Number verified'),
    ],
  },
];
