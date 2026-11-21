import { callingCode } from '@soirely/domain';

import { DOOR_EVENT } from './doorCode.ts';
import { JOB, SHIFT_NAME } from './doorCheckIn.ts';
import { type Step as RedeemStep, RESEND_FROM, DRAWN_RESEND } from './redeem.ts';
import { SAMPLE } from './rules.ts';
import type { DemoLink } from './settings.ts';

/** A personal staff link opened in a browser, not signed in (sc-4235): Confirm it's you, the phone code, then the shift. */
export const LINK_COUNTRY = 'PT';
export const LINK_NUMBER = '+351912774512';
export const ACCOUNT_EMAIL = 'bisi.adeyemi@gmail.com';
export const OTHER_ACCOUNT = 'Samuel Okafor';
/** Too many requests: the time in the 429's Retry-After, read as a clock. */
export const RETRY_AT = '19:07';

export const S = {
  staffLink: 'Staff link',
  confirm: 'Confirm it’s you',
  sendTo: (masked: string) => `We’ll send a code to ${masked}.`,
  sendCode: 'Send code',
  notYours: 'Not your number?',
  askToChange: 'Ask the event’s organiser to change it on the roster.',
  askToAdd: 'Ask the event’s organiser to add your mobile number to the roster.',
  signIn: 'Sign in',
  signingIn: 'Signing in…',
  tooMany: 'Too many tries',
  tryAt: (time: string) => `Try again at ${time}`,
  linkFor: (name: string) => `This link is for ${name}.`,
  signedInAs: (name: string) => `Signed in as ${name}`,
  signOutContinue: 'Sign out and continue',
  signedOut: 'Signed out.',
  tfTitle: 'Enter your code',
  tfIntro: (email: string) =>
    `Open your authenticator app and enter the 6-digit code for ${email}.`,
  tfCode: 'Code',
  tfVerify: 'Verify and sign in',
  tfVerifying: 'Signing in…',
  tfRecovery: 'Use a recovery code instead',
  tfBlank: 'Enter the 6-digit code from your app.',
  tfLength: 'The code is 6 digits.',
  tfWrong: 'That code did not work. Enter the code your app shows now.',
  recoveryLater: 'Recovery codes are as sign-in draws them (page 27).',
} as const;

/** "+351 ••• ••• 4512": the country's code and the last four digits, masked by the code, never typed into the words. */
export function maskedNumber(e164: string, country = LINK_COUNTRY): string {
  const calling = callingCode(country) ?? '';
  const digits = e164.replace(/\D/gu, '');

  return `${calling} ••• ••• ${digits.slice(-4)}`;
}

export const MASKED = maskedNumber(LINK_NUMBER);
export const LINK_JOB = JOB;
export const LINK_EVENT = DOOR_EVENT;
export const ROSTER_NAME = SHIFT_NAME;

export const rightAuthenticator = (digits: string) => digits === SAMPLE.authenticator;

export function authenticatorLine(digits: string): string | null {
  if (digits === '') return S.tfBlank;

  return digits.length === 6 ? null : S.tfLength;
}

type Busy = 'no' | 'busy' | 'held';
export type CodeStep = Extract<RedeemStep, { kind: 'code' }>;

export type LinkStep =
  | { kind: 'confirm'; busy: Busy; told: boolean; signedOut: boolean }
  | { kind: 'noMobile' }
  | { kind: 'tooMany' }
  | { kind: 'wrongAccount' }
  | CodeStep
  | { kind: 'twoFactor'; digits: string; line: string | null; wrong: boolean; busy: Busy };

export const LINK_STATES = [
  'confirm',
  'sending',
  'not-your-number',
  'no-mobile',
  'code',
  'code-blank',
  'code-short',
  'code-wrong',
  'code-expired',
  'code-exhausted',
  'two-factor',
  'two-factor-blank',
  'two-factor-wrong',
  'wrong-account',
  'too-many',
  'signed-out',
] as const;

export type LinkState = (typeof LINK_STATES)[number];

export function linkStateOf(name: string | null): LinkState {
  return LINK_STATES.find((one) => one === name) ?? 'confirm';
}

const confirm = (extra: Partial<Extract<LinkStep, { kind: 'confirm' }>> = {}): LinkStep => ({
  kind: 'confirm',
  busy: 'no',
  told: false,
  signedOut: false,
  ...extra,
});

export const freshCode = (resend = RESEND_FROM): CodeStep => ({
  kind: 'code',
  via: 'whatsapp',
  digits: '',
  problem: null,
  line: null,
  resend,
  busy: 'no',
  wrongs: 0,
});

const code = (extra: Partial<CodeStep> = {}): LinkStep => ({
  ...freshCode(DRAWN_RESEND),
  ...extra,
});

export const freshTwoFactor = (): LinkStep => ({
  kind: 'twoFactor',
  digits: '',
  line: null,
  wrong: false,
  busy: 'no',
});

/** The step a state opens on, and whether the account behind the number has two-factor on. */
export function linkStart(state: LinkState): { step: LinkStep; twoFactor: boolean } {
  switch (state) {
    case 'sending':
      return { step: confirm({ busy: 'held' }), twoFactor: false };
    case 'not-your-number':
      return { step: confirm({ told: true }), twoFactor: false };
    case 'no-mobile':
      return { step: { kind: 'noMobile' }, twoFactor: false };
    case 'code':
      return { step: code({ digits: '48' }), twoFactor: false };
    case 'code-blank':
      return { step: code({ line: 'blank' }), twoFactor: false };
    case 'code-short':
      return { step: code({ digits: '4829', line: 'short' }), twoFactor: false };
    case 'code-wrong':
      return { step: code({ digits: '482914', problem: 'wrong', wrongs: 1 }), twoFactor: false };
    case 'code-expired':
      return { step: code({ problem: 'expired', resend: 0 }), twoFactor: false };
    case 'code-exhausted':
      return { step: code({ problem: 'exhausted', resend: 0 }), twoFactor: false };
    case 'two-factor':
      return { step: freshTwoFactor(), twoFactor: true };
    case 'two-factor-blank':
      return { step: { ...freshTwoFactor(), line: S.tfBlank } as LinkStep, twoFactor: true };
    case 'two-factor-wrong':
      return {
        step: { kind: 'twoFactor', digits: '714303', line: null, wrong: true, busy: 'no' },
        twoFactor: true,
      };
    case 'wrong-account':
      return { step: { kind: 'wrongAccount' }, twoFactor: false };
    case 'too-many':
      return { step: { kind: 'tooMany' }, twoFactor: false };
    case 'signed-out':
      return { step: confirm({ signedOut: true }), twoFactor: false };
    default:
      return { step: confirm(), twoFactor: false };
  }
}

/** Where the right phone code lands: the authenticator next when the account has two-factor, else the shift at once. */
export const SHIFT_HREF = '/demo/check-in/shift';

const at = (state: LinkState, name: string): DemoLink => ({
  to: `/demo/staff-sign-in?state=${state}`,
  name,
});

export const STAFF_SIGN_IN_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Opening the link, signed out',
    states: [
      at('confirm', 'Confirm it’s you: the event, the job, the masked number'),
      at('sending', 'Send code, sending'),
      at('not-your-number', 'Not your number?: ask the organiser, nothing sent'),
      at('no-mobile', 'No mobile number on the roster'),
      at('too-many', 'Too many tries: nothing about the event'),
    ],
  },
  {
    name: 'The phone code',
    states: [
      at('code', 'Check WhatsApp, Sign in'),
      at('code-blank', 'Sign in, left blank'),
      at('code-short', 'Not six digits'),
      at('code-wrong', 'A wrong code'),
      at('code-expired', 'An expired code'),
      at('code-exhausted', 'Too many wrong tries'),
      at('two-factor', 'Two-factor next: Enter your code'),
      at('two-factor-blank', 'Two-factor, left blank'),
      at('two-factor-wrong', 'Two-factor, a wrong code'),
    ],
  },
  {
    name: 'Signed in, and signed out',
    states: [
      at('wrong-account', 'Signed in as someone else: This link is for…'),
      { to: SHIFT_HREF, name: 'Signed in: straight to the shift, Sign out at the end' },
      at('signed-out', 'Signed out: a status above Confirm it’s you'),
    ],
  },
];
