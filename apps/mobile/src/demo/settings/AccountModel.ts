import {
  CONTACTS_MOST,
  contactsLeft,
  emailProblem,
  exactZone,
  formerName,
  matchingZones,
  phoneLengthProblem,
  type ZoneRow,
  zoneLabel,
} from '@soirely/domain';

import {
  type Contact,
  countryName,
  EMAILS,
  passwordProblem,
  PHONES,
  plural,
  SECOND_PHONE,
  secondFactorProblem,
  ZONES,
} from './AccountSample.ts';

/** Each starting state a board frame drew, as `/demo/settings/account?state=<name>`. */
export const ACCOUNT_STATES = [
  'rest',
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

export type AccountState = (typeof ACCOUNT_STATES)[number];
export type ContactKind = 'email' | 'phone';
export type AccountScreen = 'name' | 'zone' | 'addEmail' | 'addPhone' | 'confirm' | 'verify';
export type VerifyStage = 'entering' | 'wrong' | 'expired';
export type Channel = 'email' | 'whatsApp' | 'text';

export interface Verifying {
  kind: ContactKind;
  id: string;
  stage: VerifyStage;
}

export interface AccountStart {
  emails: Contact[];
  phones: Contact[];
  said: string | null;
  opened: string | null;
  ask: 'promote' | 'remove' | null;
  screen: AccountScreen | null;
  verifying: Verifying | null;
  typedZone: string;
}

export const SECOND_EMAIL_ID = 'email-2';
export const SECOND_PHONE_ID = 'phone-2';
export const WRONG_CODE = '482170';
export const ZONE_TYPED = 'San';
export const COUNTDOWN_SECONDS = 42;
export const ZONES_SHOWN = 8;

export function accountStateOf(name: string | undefined): AccountState {
  return ACCOUNT_STATES.find((state) => state === name) ?? 'rest';
}

const proved = (): Contact[] => EMAILS.map((row) => ({ ...row, verified: true }));

function withSecondPhone(verified: boolean): Contact[] {
  return [...PHONES, { id: SECOND_PHONE_ID, shown: SECOND_PHONE, verified, primary: false }];
}

const AT_REST: AccountStart = {
  emails: [...EMAILS],
  phones: [...PHONES],
  said: null,
  opened: null,
  ask: null,
  screen: null,
  verifying: null,
  typedZone: '',
};

/** What a state link opens on: the rows as its board frame drew them, and the screen or Ask over them. */
export function accountStart(state: AccountState): AccountStart {
  const email = (stage: VerifyStage): AccountStart => ({
    ...AT_REST,
    screen: 'verify',
    verifying: { kind: 'email', id: SECOND_EMAIL_ID, stage },
  });
  const phone = (stage: VerifyStage): AccountStart => ({
    ...AT_REST,
    emails: proved(),
    phones: withSecondPhone(false),
    screen: 'verify',
    verifying: { kind: 'phone', id: SECOND_PHONE_ID, stage },
  });

  switch (state) {
    case 'rest':
      return AT_REST;
    case 'name':
    case 'addPhone':
      return { ...AT_REST, screen: state };
    case 'zone':
      return { ...AT_REST, screen: 'zone', typedZone: ZONE_TYPED };
    case 'promote':
    case 'remove':
      return { ...AT_REST, emails: proved(), opened: SECOND_EMAIL_ID, ask: state };
    case 'confirm':
      return { ...AT_REST, emails: proved(), opened: SECOND_EMAIL_ID, screen: 'confirm' };
    case 'addEmail':
      return { ...AT_REST, emails: EMAILS.filter((row) => row.primary), screen: 'addEmail' };
    case 'verifyEmail':
      return email('entering');
    case 'verifyEmailWrong':
      return email('wrong');
    case 'verifyEmailExpired':
      return email('expired');
    case 'verifyEmailDone': {
      const emails = proved();

      return { ...AT_REST, emails, said: verifiedWords(shownOf(emails, SECOND_EMAIL_ID), 'email') };
    }
    case 'verifyPhone':
      return phone('entering');
    case 'verifyPhoneExpired':
      return phone('expired');
    case 'verifyPhoneDone':
      return {
        ...AT_REST,
        emails: proved(),
        phones: withSecondPhone(true),
        said: verifiedWords(SECOND_PHONE, 'phone'),
      };
  }
}

export function shownOf(rows: readonly Contact[], id: string): string {
  return rows.find((row) => row.id === id)?.shown ?? '';
}

export function primaryFirst(rows: readonly Contact[]): Contact[] {
  return [...rows].sort((a, b) => Number(b.primary) - Number(a.primary));
}

export function primaryOf(rows: readonly Contact[]): Contact | null {
  return rows.find((row) => row.primary) ?? null;
}

export function firstUnverified(
  emails: readonly Contact[],
  phones: readonly Contact[],
): { kind: ContactKind; row: Contact } | null {
  const email = primaryFirst(emails).find((row) => !row.verified);
  if (email != null) return { kind: 'email', row: email };
  const phone = primaryFirst(phones).find((row) => !row.verified);

  return phone == null ? null : { kind: 'phone', row: phone };
}

export type CardLine = { kind: 'done' | 'todo'; text: string } | null;

/** The one line under you: what just happened until the page is left, else what is not verified yet. */
export function cardLine(
  emails: readonly Contact[],
  phones: readonly Contact[],
  said: string | null,
): CardLine {
  if (said != null) return { kind: 'done', text: said };
  const waiting = firstUnverified(emails, phones);

  return waiting == null
    ? null
    : { kind: 'todo', text: `${waiting.row.shown} is not verified yet.` };
}

export const WORDS = {
  title: 'Your account',
  aboutYou: 'About you',
  yourName: 'Your name',
  sendCode: 'Send a code',
  makePrimary: 'Make primary',
  remove: 'Remove',
  removeAsking: 'Remove…',
  removeLine: 'Soirely stops sending anything to it. You can add it again later, with a new code.',
  discardTitle: 'Discard your change?',
  keepEditing: 'Keep editing',
  discard: 'Discard',
  save: 'Save',
  add: 'Add',
  nameTitle: 'Name',
  nameLabel: 'Full name',
  nameBlank: 'Enter your name.',
  zoneTitle: 'Time zone',
  zoneLead: 'Times in the emails and texts Soirely sends you are written in this zone.',
  zoneLabel: 'Find your time zone',
  zonePlaceholder: 'Lagos, Ghana or UTC+01',
  nothingAdded: 'Nothing is added.',
  added: 'Added. It is unverified until you enter the code we sent.',
  promoteTitle: 'Make this your primary address?',
  makeItPrimary: 'Make it primary',
  keepIt: 'Keep it',
  removeIt: 'Remove it',
  confirmTitle: 'Confirm it’s you',
  confirmLead: 'Confirm it’s you before changing the address you sign in with.',
  continue: 'Continue',
  verify: 'Verify',
  expiredTitle: 'That code has expired',
  resend: 'Send a new code',
  resendNote: 'A new code replaces the last one.',
  textInstead: 'Text it to me instead',
  codeShort: 'The code is 6 digits.',
} as const;

export const KIND_WORDS: Record<
  ContactKind,
  {
    section: string;
    addTitle: string;
    label: string;
    help: string;
    blank: string;
    linked: string;
    removeTitle: string;
    many: string;
    one: string;
  }
> = {
  email: {
    section: 'Email addresses',
    addTitle: 'Add an email address',
    label: 'Email address to add',
    help: 'We email a code to prove it is yours. Until then it stays unverified.',
    blank: 'Enter your email address.',
    linked: 'That address is already linked to an account.',
    removeTitle: 'Remove this address?',
    many: 'email addresses',
    one: 'address',
  },
  phone: {
    section: 'Phone numbers',
    addTitle: 'Add a phone number',
    label: 'Mobile number to add',
    help: 'We text a code to prove it is yours. Until then it stays unverified.',
    blank: 'Enter your mobile number.',
    linked: 'That number is already linked to an account.',
    removeTitle: 'Remove this number?',
    many: 'phone numbers',
    one: 'number',
  },
};

const LINES: Record<ContactKind, { primary: string; other: string }> = {
  email: { primary: 'Primary · signs you in', other: 'Can reach you, cannot sign you in' },
  phone: { primary: 'Primary · on your profile', other: 'Can reach you' },
};

export function contactLine(kind: ContactKind, row: Contact): string {
  return row.primary ? LINES[kind].primary : LINES[kind].other;
}

export function zoneLine(zone: ZoneRow): string {
  return `Time zone · ${zone.id.replace(/_/gu, ' ')}`;
}

/** Under a section's rows: how many more fit, or that the account holds the most. */
export function contactsFoot(kind: ContactKind, rows: readonly Contact[]): string {
  const left = contactsLeft(rows);
  if (left === 0)
    return `You have ${CONTACTS_MOST}, the most an account can hold. Remove one to add another.`;

  return `${plural(left, 'You can add one more.', `You can add ${left} more.`)} An account holds up to ${CONTACTS_MOST} ${KIND_WORDS[kind].many}, including the primary.`;
}

export const RESULTS = {
  name: (name: string) => `Name changed to ${name}.`,
  zone: (zone: ZoneRow) =>
    `Time zone changed to ${zoneLabel(zone)}. Times in your emails now use it.`,
  primary: (kind: ContactKind, shown: string) =>
    kind === 'email'
      ? `${shown} is now your primary address. Sign in with it from now on.`
      : `${shown} is now your primary number.`,
  removed: (shown: string) => `${shown} has been removed.`,
} as const;

export function verifiedWords(shown: string, kind: ContactKind): string {
  return `${shown} is verified. It stays an alternative ${KIND_WORDS[kind].one} until you make it primary.`;
}

export const keepPrimary = (primary: string) => `Keep ${primary}`;

export function promoteLine(primary: string): string {
  return `You will sign in with it from now on, and account mail goes there. ${primary} stays linked and stops signing you in.`;
}

export const nameStays = (name: string) => `Your name stays ${name}.`;
export const zoneStays = (zone: ZoneRow) => `Your time zone stays ${zoneLabel(zone)}.`;

/** What only the client can know about an address or number to add: blank, the shape, the country's lengths. */
export function addCheck(kind: ContactKind, typed: string, country: string): string | null {
  const problem = kind === 'email' ? emailProblem(typed) : phoneLengthProblem(typed, country);
  if (problem == null) return null;
  const name = countryName(country);

  switch (problem) {
    case 'blank':
      return KIND_WORDS[kind].blank;
    case 'shape':
      return 'That does not look like an email address. Check it has an @ and a domain.';
    case 'noCountry':
      return 'Choose a country.';
    case 'tooShort':
      return `That number looks too short for ${name}. Check it and try again.`;
    case 'tooLong':
      return `That number looks too long for ${name}. Check it and try again.`;
  }
}

/** The server's refusal of one already linked, which the demo knows only for the account's own rows. */
export function addRefusal(
  kind: ContactKind,
  shown: string,
  rows: readonly Contact[],
): string | null {
  const taken = rows.some((row) => row.shown.toLowerCase() === shown.toLowerCase());

  return taken ? KIND_WORDS[kind].linked : null;
}

export function zoneMatches(typed: string): ZoneRow[] {
  return typed.trim() === '' ? [] : matchingZones(ZONES, typed).slice(0, ZONES_SHOWN);
}

/** Save's answer on the time zone screen: the zone picked or named exactly, or why there is none. */
export function zoneToSave(
  typed: string,
  picked: ZoneRow | null,
): { zone: ZoneRow } | { problem: string } {
  const zone = picked ?? exactZone(ZONES, typed);
  if (zone != null) return { zone };
  const wanted = typed.trim();
  const choose = 'Choose a time zone from the list.';

  return {
    problem:
      wanted === '' || zoneMatches(typed).length > 0
        ? choose
        : `${choose} Nothing matches “${wanted}”.`,
  };
}

export function zoneHelp(zone: ZoneRow): string {
  return `Type a city, a country or an offset, then pick from the list. Now: ${zoneLabel(zone)}.`;
}

export function matchLine(zone: ZoneRow, typed: string): string {
  const was = formerName(zone, typed);

  return was == null ? zone.country : `${zone.country} · was ${was}`;
}

export function noZoneLine(typed: string): string {
  return `No time zone matches “${typed.trim()}”. Try a city, a country or an offset like UTC+01.`;
}

export const PASSWORD_SAYS = {
  blank: 'Enter your password.',
  wrong: 'That is not your password. Try again, or reset it by email.',
} as const;

export const CODE_SAYS = {
  blank: 'Enter a code from your app, or a recovery code.',
  wrong: 'That code did not work. Check your app and try again.',
} as const;

export interface ConfirmSays {
  password: string | null;
  code: string | null;
  checked: boolean;
}

/** What Confirm it's you asks for: in place of both fields, the provider you sign in with. */
export interface ProofAsks {
  lead: string;
  note?: string | undefined;
  password: boolean;
  code: boolean;
  codeHelp: string;
  codeWrong: string;
  instead: string | null;
}

export const CODE_HELP = 'From your authenticator app, or one of your recovery codes.';

export const ACCOUNT_PROOF: ProofAsks = {
  lead: WORDS.confirmLead,
  password: true,
  code: true,
  codeHelp: CODE_HELP,
  codeWrong: CODE_SAYS.wrong,
  instead: null,
};

/** The blanks first, both at once, as the client knows them; then the server's answer, one field at a time. */
export function confirmSays(
  password: string,
  code: string,
  asks: Pick<ProofAsks, 'password' | 'code' | 'codeWrong'> = ACCOUNT_PROOF,
): ConfirmSays {
  const blank = {
    password: asks.password && password === '' ? PASSWORD_SAYS.blank : null,
    code: asks.code && code.trim() === '' ? CODE_SAYS.blank : null,
  };
  if (blank.password != null || blank.code != null) return { ...blank, checked: true };
  if (asks.password && passwordProblem(password) != null)
    return { password: PASSWORD_SAYS.wrong, code: null, checked: false };
  const wrongCode = asks.code && secondFactorProblem(code) != null ? asks.codeWrong : null;

  return { password: null, code: wrongCode, checked: false };
}

export const CHANNELS: Record<
  Channel,
  { title: string; label: string; from: string; wrong: string; newest: string }
> = {
  email: {
    title: 'Check your email',
    label: 'Code from the email',
    from: 'the email',
    wrong: 'That code does not match. Check the newest email from Soirely and try again.',
    newest: 'email',
  },
  whatsApp: {
    title: 'Check your messages',
    label: 'Code from WhatsApp',
    from: 'WhatsApp',
    wrong:
      'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
    newest: 'text',
  },
  text: {
    title: 'Check your messages',
    label: 'Code from the text',
    from: 'the text',
    wrong: 'That code does not match. Check the newest text from Soirely and try again.',
    newest: 'text',
  },
};

export function verifyLead(channel: Channel, shown: string): string {
  if (channel === 'email')
    return `We sent a code to ${shown}. Enter it here to show the address is yours.`;

  return channel === 'text'
    ? `We texted the same code to ${shown}. The one on WhatsApp works too.`
    : `We sent a code to your WhatsApp on ${shown}.`;
}

export function codeMessage(channel: Channel, problem: 'blank' | 'short' | 'wrong'): string {
  if (problem === 'blank') return `Enter the 6-digit code from ${CHANNELS[channel].from}.`;

  return problem === 'short' ? WORDS.codeShort : CHANNELS[channel].wrong;
}

export function expiredLine(channel: Channel): string {
  return `Codes only work for a while. Send a new one and use the code in the newest ${CHANNELS[channel].newest}.`;
}
