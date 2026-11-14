import type { TFunction } from 'i18next';

import type { ConfirmSays, ProofAsks } from '../../components/AccountConfirm.tsx';
import {
  type Contact,
  type ContactKind,
  type CodeLine,
  verifiedWords,
} from '../../kit/accountPage.ts';
import {
  EMAILS,
  passwordProblem,
  PHONE_COUNTRY,
  PHONES,
  SECOND_PHONE,
  secondFactorProblem,
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
  'addPhoneNoCountry',
  'zone',
  'zoneWaiting',
  'verifyEmail',
  'verifyEmailWrong',
  'verifyEmailExpired',
  'verifyEmailDone',
  'verifyPhone',
  'verifyPhoneExpired',
  'verifyPhoneDone',
  'undeliverable',
  'undeliverableTwo',
  'undeliverableUnverified',
] as const;

export type AccountState = (typeof ACCOUNT_STATES)[number];
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
  /** The zone list held back, as sc-27219's check holds it, so the Time zone row waits. */
  zoneHeld: boolean;
  /** Add a phone number's Code as it opens: blank when the device names no country. */
  phoneCountry: string;
  /** The addresses sc-4332 stopped sending to, by id: AC, not yet built, so the sample says which. */
  undeliverable: readonly string[];
}

export const PRIMARY_EMAIL_ID = 'email-1';
export const SECOND_EMAIL_ID = 'email-2';
export const SECOND_PHONE_ID = 'phone-2';
export const WRONG_CODE = '482170';
export const ZONE_TYPED = 'San';
export const COUNTDOWN_SECONDS = 42;
export const ZONE_HELD_MS = 3000;

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
  zoneHeld: false,
  phoneCountry: PHONE_COUNTRY,
  undeliverable: [],
};

/** What a state link opens on: the rows as its board frame drew them, and the screen or Ask over them. */
export function accountStart(state: AccountState, t: TFunction): AccountStart {
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
    case 'addPhoneNoCountry':
      return { ...AT_REST, screen: 'addPhone', phoneCountry: '' };
    case 'zone':
      return { ...AT_REST, screen: 'zone', typedZone: ZONE_TYPED };
    case 'zoneWaiting':
      return { ...AT_REST, zoneHeld: true };
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

      return {
        ...AT_REST,
        emails,
        said: verifiedWords(rowOf(emails, SECOND_EMAIL_ID), 'email', t),
      };
    }
    case 'verifyPhone':
      return phone('entering');
    case 'verifyPhoneExpired':
      return phone('expired');
    case 'undeliverable':
      return {
        ...AT_REST,
        emails: EMAILS.filter((row) => row.primary),
        undeliverable: [PRIMARY_EMAIL_ID],
      };
    case 'undeliverableTwo':
      return { ...AT_REST, emails: proved(), undeliverable: [PRIMARY_EMAIL_ID, SECOND_EMAIL_ID] };
    case 'undeliverableUnverified':
      return { ...AT_REST, undeliverable: [SECOND_EMAIL_ID] };
    case 'verifyPhoneDone': {
      const phones = withSecondPhone(true);

      return {
        ...AT_REST,
        emails: proved(),
        phones,
        said: verifiedWords(rowOf(phones, SECOND_PHONE_ID), 'phone', t),
      };
    }
  }
}

function rowOf(rows: readonly Contact[], id: string): Contact {
  return rows.find((row) => row.id === id) ?? { id, shown: '', verified: true, primary: false };
}

/** The server's refusal of one already linked, which the demo knows only for the account's own rows. */
export function addRefusal(
  kind: ContactKind,
  shown: string,
  rows: readonly Contact[],
  t: TFunction,
): string | null {
  const taken = rows.some((row) => row.shown.toLowerCase() === shown.toLowerCase());
  if (!taken) return null;

  return t(kind === 'email' ? 'contacts.alreadyLinked' : 'contacts.alreadyLinkedPhone');
}

/** The demo's channels as the product's code lines: a text chosen instead is "the same code". */
export const CHANNEL_LINE: Record<Channel, CodeLine> = {
  email: 'email',
  whatsApp: 'whatsapp',
  text: 'chosen',
};

/** Security's own screens' words, until Security moves to the product. */
export const WORDS = {
  save: 'Save',
  continue: 'Continue',
  resend: 'Send a new code',
  resendNote: 'A new code replaces the last one.',
  expiredTitle: 'That code has expired',
  expiredEmail: 'Codes only work for a while. Send a new one and use the code in the newest email.',
} as const;

export const PASSWORD_SAYS = {
  blank: 'Enter your password.',
  wrong: 'That is not your password. Try again, or reset it by email.',
} as const;

export const CODE_SAYS = {
  blank: 'Enter a code from your app, or a recovery code.',
  wrong: 'That code did not work. Check your app and try again.',
} as const;

/** The demo's asks carry the words a wrong code gets, which the product hears from the server. */
export interface SampleProofAsks extends ProofAsks {
  codeWrong: string;
}

export const CODE_HELP = 'From your authenticator app, or one of your recovery codes.';

export function accountProof(t: TFunction): SampleProofAsks {
  return {
    lead: t('contacts.proveIntro'),
    password: true,
    code: true,
    codeHelp: t('waysCard.codeHelp'),
    codeWrong: CODE_SAYS.wrong,
    instead: null,
  };
}

/** The blanks first, both at once, as the client knows them; then the server's answer, one field at a time. */
export function confirmSays(
  password: string,
  code: string,
  asks: Pick<SampleProofAsks, 'password' | 'code' | 'codeWrong'>,
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

/** Continue on the sample: a provider confirms at once, else the sample's password and code. */
export function sampleContinue(
  asks: SampleProofAsks,
  onProved: () => void,
): (password: string, code: string) => Promise<ConfirmSays | null> {
  return (password, code) => {
    if (asks.instead == null) {
      const says = confirmSays(password, code, asks);
      if (says.password != null || says.code != null) return Promise.resolve(says);
    }
    onProved();

    return Promise.resolve(null);
  };
}
