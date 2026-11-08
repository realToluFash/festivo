import { emailProblem, meetsPasswordLength, PASSWORD_MINIMUM_LENGTH } from '@soirely/domain';

import { SAMPLE } from '../samples.ts';
import { CODE_HELP, CODE_SAYS, type ProofAsks } from './AccountModel.ts';
import { authenticatorProblem, plural, sentCodeProblem } from './AccountSample.ts';
import {
  BREACHED_PASSWORD,
  dayAtTime,
  dayOf,
  type Device,
  linkedProviders,
  PROOF_MINUTES,
  type Provider,
  PROVIDER_ADDRESS,
  RECOVERY_CODES,
  RECOVERY_LEFT,
  type Ways,
} from './SecuritySample.ts';

/** Each starting state a board frame drew, as `/demo/settings/security?state=<name>`. */
export const SECURITY_STATES = [
  'rest',
  'googleOnly',
  'keptByRule',
  'changePassword',
  'setPassword',
  'setPasswordExpired',
  'link',
  'linkPick',
  'unlink',
  'setup',
  'recovery',
  'newCodes',
  'turnOff',
  'signOutDevice',
  'everywhere',
  'forgot',
  'forgotSent',
] as const;

export type SecurityState = (typeof SECURITY_STATES)[number];

export function securityStateOf(param: string | undefined): SecurityState {
  return SECURITY_STATES.find((name) => name === param) ?? 'rest';
}

export type SecurityAsk = 'unlink' | 'turnOff' | 'newCodes' | 'signOut' | 'everywhere';
export type SecurityScreen =
  | 'change'
  | 'forgot'
  | 'forgotSent'
  | 'setPassword'
  | 'setPasswordExpired'
  | 'confirm'
  | 'setup'
  | 'recovery';
export type Proof = 'link' | 'unlink' | 'everywhere' | 'turnOff' | 'newCodes';

export interface Rules {
  providerOnly: boolean;
  twoFactor: boolean;
}

export interface SecurityStart {
  ways: Ways;
  twoFactor: boolean;
  codesLeft: number;
  rules: Rules;
  opened: string | null;
  inView: string | null;
  ask: SecurityAsk | null;
  screen: SecurityScreen | null;
  proof: Proof | null;
}

const ORG = SAMPLE.organisation;
const CODES = RECOVERY_CODES.length;
const OTHER: Record<Provider, Provider> = { Google: 'Apple', Apple: 'Google' };
const CODE_WRONG_NOW =
  'That code did not work. Enter the code your app shows now, or an unused recovery code.';

export const WORDS = {
  title: 'Security',
  turnOn: 'Turn on two-factor',
  why: 'Your account holds your clients’ guest lists; two-factor keeps a stolen password from being enough.',
  ways: 'Ways to sign in',
  password: 'Password',
  passwordSet: 'Set up · used with your email to sign in',
  passwordNotSet: 'Not set up',
  linked: 'Linked',
  notLinked: 'Not linked',
  unlink: 'Unlink…',
  unlinkKept: 'Unlink',
  twoFactor: 'Two-factor authentication',
  authenticator: 'Authenticator app',
  authenticatorOn: 'On · every sign-in asks for a code',
  off: 'Off',
  twoFactorFoot:
    'Asks for a code from an authenticator app every time you sign in, whether with your password, Google or Apple.',
  turnOff: 'Turn off two-factor…',
  turnOffKept: 'Turn off two-factor',
  turnOffNote: `Sign-ins stop asking for a code. We will email ${SAMPLE.email} to say it was turned off.`,
  turnOffKeptNote: `${ORG} requires two-factor, so you cannot turn it off.`,
  recoveryCodes: 'Recovery codes',
  newCodes: 'Make new codes',
  newCodesNote: 'New codes replace every code you have now, used or not, as soon as they are made.',
  signedInOn: 'Signed in on',
  thisDevice: 'This device · in use now',
  devicesFoot:
    'Each device is listed as it described itself when it signed in, with the network address it used. Soirely cannot check either, or tell where a device is. Sign out any you do not recognise.',
  signOut: 'Sign out',
  signOutAsking: 'Sign out…',
  signOutNote:
    'It has to sign in again before it can carry on, so first check that nobody is using it at an event.',
  signOutHereNote: 'You leave Soirely on this device. Your other devices stay signed in.',
  everywhere: 'Sign out everywhere else…',
  everywhereNote: 'Every device except this one. Asks you to confirm it is you first.',
  changeTitle: 'Change password',
  currentLabel: 'Current password',
  newLabel: 'New password',
  forgot: 'Forgot it?',
  rule: `At least ${PASSWORD_MINIMUM_LENGTH} characters`,
  met: 'Met',
  notYet: 'Not yet',
  ruleNote:
    'That is the only rule. When you submit, we also check the password has not appeared in a known data breach.',
  changeSignsOut: 'Saving signs out your other devices; this one stays signed in.',
  changeEmail: `We will email ${SAMPLE.email} to say it was changed.`,
  changeStays: 'Your password stays as it was.',
  resetTitle: 'Reset your password',
  resetLead:
    'Enter the email you sign in with. If it has an account, we send it a link to set a new password.',
  emailLabel: 'Email',
  send: 'Send',
  sentTitle: 'Check your email',
  sentLead:
    'If that address has an account, we have sent it a link to set a new password. The link works once.',
  nothingThere: 'Nothing there?',
  nothingThereLine: 'Check your spam folder first, then send it again.',
  sendAgain: 'Send it again',
  signedUpWith:
    'Signed up with Google or Apple? Then there is no password to reset, and the email says how you sign in instead.',
  gotTheLink: 'Got the link? Open it on any device.',
  done: 'Done',
  codeTitle: 'Check your email',
  codeLead: `We sent a 6-digit code to ${SAMPLE.email} to make sure it's you.`,
  codeLabel: 'Code from the email',
  codeWhy: "Adding a password needs this, so someone using this device without you can't add one.",
  chooseTitle: 'Choose a password',
  chosenLabel: 'Password',
  chooseEmail: `We will email ${SAMPLE.email} to say a password was added.`,
  nothingAdded: 'Nothing is added.',
  setupTitle: 'Set up two-factor',
  setupVerb: 'Turn on',
  scan: 'Scan this code with your authenticator app',
  scanPhone: 'Scan the code from another screen, or enter this key in the app.',
  scanTablet: 'Can’t scan it? Enter this key in the app instead.',
  qrLabel: 'QR code for your authenticator app',
  setupLabel: 'Enter the 6-digit code the app shows',
  setupHelp: 'Two-factor stays off until the code matches, so a setup mistake cannot lock you out.',
  codesTitle: 'Save your recovery codes',
  codesLead:
    'If you lose your authenticator, each of these signs you in once. This is the only time they are shown.',
  codesPhone: 'Keep them somewhere other than this phone.',
  copyAll: 'Copy all',
  copied: 'Copied',
  copiedLine: `All ${CODES} codes are on your clipboard.`,
  savedBox: 'I have saved these codes somewhere safe',
  savedNot: 'Two-factor is on. Confirm you have saved the codes to leave this step.',
  savedYes: 'Two-factor is on. Finish to go back to Security.',
  finish: 'Finish',
  codeOnlyLead: 'Enter a code from your authenticator app, or one of your recovery codes.',
  everywhereLead: 'So that nobody who picks up this device can do this without you.',
} as const;

export function cardSays(twoFactor: boolean): string {
  return twoFactor ? 'Two-factor is on' : 'Two-factor is off';
}

export function waysCount(ways: Ways): number {
  return (ways.password ? 1 : 0) + linkedProviders(ways).length;
}

export function cardCounts(ways: Ways, devices: number): string {
  const count = waysCount(ways);

  return `${count} ${plural(count, 'way', 'ways')} to sign in · ${devices} ${plural(devices, 'device', 'devices')}`;
}

export type SecurityLine = { kind: 'done' | 'todo'; text: string } | null;

/** What just happened until you leave the page; while two-factor is off, why it matters. */
export function cardLine(said: string | null, twoFactor: boolean): SecurityLine {
  if (said != null) return { kind: 'done', text: said };

  return twoFactor ? null : { kind: 'todo', text: WORDS.why };
}

export function passwordLine(ways: Ways): string {
  return ways.password ? WORDS.passwordSet : WORDS.passwordNotSet;
}

export function providerLine(ways: Ways, provider: Provider): string {
  if (!ways[provider]) return WORDS.notLinked;
  const address = PROVIDER_ADDRESS[provider];

  return address == null ? WORDS.linked : `${WORDS.linked} · ${address}`;
}

/** No password and one provider: that provider is the way in, and it does not open. */
export function lastWayIn(ways: Ways): Provider | null {
  const linked = linkedProviders(ways);

  return !ways.password && linked.length === 1 ? (linked[0] ?? null) : null;
}

export function waysFoot(ways: Ways): string | undefined {
  const last = lastWayIn(ways);
  if (last == null) return undefined;

  return `${last} is your only way to sign in, so it can't be removed. Set a password or link another account before removing this one.`;
}

/** A Google-or-Apple rule keeps the last provider linked, password or not. */
export function keptByRule(ways: Ways, provider: Provider, rules: Rules): boolean {
  return rules.providerOnly && ways[provider] && linkedProviders(ways).length === 1;
}

export function unlinkNote(ways: Ways, provider: Provider): string {
  const still = ways.password ? 'your password' : OTHER[provider];

  return `Devices signed in with ${provider} are signed out. You can still sign in with ${still}.`;
}

export function keptNote(provider: Provider): string {
  return `A rule set by ${ORG}: everyone in it signs in with Google or Apple, so your last one cannot be removed. Link ${OTHER[provider]} first if you want to unlink ${provider}.`;
}

export function linkNote(provider: Provider): string {
  return `Next, ${provider} opens so you can choose the account to link. Its address doesn't have to match ${SAMPLE.email}.`;
}

export function codesLine(left: number): string {
  return `${left} of ${CODES} unused · each works once`;
}

export function deviceLine(device: Device, locale: string): string {
  return device.lastUsed == null
    ? WORDS.thisDevice
    : `Last used ${dayAtTime(device.lastUsed, locale)}`;
}

export function deviceSignedIn(device: Device, locale: string): string {
  return `Signed in ${dayAtTime(device.signedIn, locale)} · from ${device.ip}`;
}

export function deviceExpires(device: Device, locale: string): string {
  return `Expires ${dayOf(device.expires, locale)} if not used again`;
}

export interface AskWords {
  title: string;
  line: string;
  keep: string;
  confirm: string;
  removes: boolean;
}

export function unlinkAsk(provider: Provider, ways: Ways): AskWords {
  const address = PROVIDER_ADDRESS[provider];
  const as = address == null ? '' : ` as ${address}`;

  return {
    title: `Unlink ${provider}?`,
    line: `You'll no longer be able to sign in with ${provider}${as}. ${unlinkNote(ways, provider)}`,
    keep: 'Keep it linked',
    confirm: `Unlink ${provider}`,
    removes: true,
  };
}

export const TURN_OFF_ASK: AskWords = {
  title: 'Turn off two-factor?',
  line: WORDS.turnOffNote,
  keep: 'Keep it on',
  confirm: 'Turn it off',
  removes: true,
};

export const NEW_CODES_ASK: AskWords = {
  title: 'Make new recovery codes?',
  line: WORDS.newCodesNote,
  keep: 'Keep current codes',
  confirm: WORDS.newCodes,
  removes: false,
};

export function signOutAsk(device: Device): AskWords {
  return {
    title: `Sign out ${device.name}?`,
    line: 'Whoever has it is signed out, and you stay signed in here. If somebody else may have it, change your password as well; that signs out every other device.',
    keep: 'Keep it signed in',
    confirm: 'Sign it out',
    removes: true,
  };
}

export function everywhereAsk(others: number): AskWords {
  const one = others === 1;

  return {
    title: 'Sign out everywhere else?',
    line: one
      ? 'This signs out your other device, whoever has it. It has to sign in again before it can carry on. This device stays signed in.'
      : `This signs out your ${others} other devices, whoever has them. They have to sign in again before they can carry on. This device stays signed in.`,
    keep: one ? 'Keep it signed in' : 'Keep them signed in',
    confirm: one ? 'Sign it out' : 'Sign them out',
    removes: true,
  };
}

function othersOut(others: number): string {
  return others === 1
    ? 'Your other device is signed out.'
    : `Your ${others} other devices are signed out.`;
}

export const RESULTS = {
  passwordChanged: (others: number): string =>
    `Password changed. ${others === 0 ? 'No other device was signed in.' : othersOut(others)}`,
  passwordAdded: (ways: Ways): string =>
    `Password added. You can sign in with it or with ${linkedProviders(ways).join(' or ')}.`,
  linked: (provider: Provider): string =>
    `${provider} is linked. We emailed your verified addresses to say so.`,
  unlinked: (provider: Provider): string =>
    `${provider} is unlinked. Devices signed in with it are signed out.`,
  twoFactorOn: 'Two-factor is on. Every sign-in now asks for a code from your app.',
  twoFactorOff: `Two-factor is off. We emailed ${SAMPLE.email} to say so.`,
  newCodes: 'New recovery codes made. Your old ones no longer work.',
  signedOut: (device: Device): string => `${device.name} is signed out.`,
  everywhere: othersOut,
};

/** What Confirm it's you asks for each proof: link and unlink remember it for 5 minutes, the rest ask every time. */
export function proofAsks(
  proof: Proof,
  provider: Provider,
  ways: Ways,
  twoFactor: boolean,
): ProofAsks {
  const codeOnly = proof === 'turnOff' || proof === 'newCodes';
  const instead = codeOnly || ways.password ? null : (linkedProviders(ways)[0] ?? null);
  const verb = proof === 'link' ? 'link' : 'unlink';
  const lead = codeOnly
    ? WORDS.codeOnlyLead
    : proof === 'everywhere'
      ? WORDS.everywhereLead
      : `To ${verb} ${provider}, confirm it's you. You won't be asked again for ${PROOF_MINUTES} minutes.`;

  return {
    lead:
      instead == null ? lead : `You sign in with ${instead}, so confirm with ${instead} instead.`,
    note: proof === 'link' ? linkNote(provider) : undefined,
    password: !codeOnly && instead == null,
    code: instead == null && (codeOnly || twoFactor),
    codeHelp:
      proof === 'turnOff'
        ? `We will email ${SAMPLE.email} to say it was turned off.`
        : proof === 'everywhere'
          ? `${CODE_HELP} Two-factor protects this the way it protects signing in.`
          : CODE_HELP,
    codeWrong: proof === 'link' || proof === 'unlink' ? CODE_SAYS.wrong : CODE_WRONG_NOW,
    instead,
  };
}

export interface FieldSays<K extends string> {
  says: Record<K, string | null>;
  checked: boolean;
}

const PASSWORD_REFUSED = {
  short: `Use at least ${PASSWORD_MINIMUM_LENGTH} characters.`,
  breached: 'This password has appeared in a known data breach. Choose another.',
} as const;

/** Change password: blanks and a short new one on the client, so nothing is sent; then the server's refusals. */
export function changeSays(current: string, next: string): FieldSays<'current' | 'next'> {
  const client = {
    current: current === '' ? 'Enter your current password.' : null,
    next:
      next === ''
        ? 'Enter a new password.'
        : meetsPasswordLength(next)
          ? null
          : PASSWORD_REFUSED.short,
  };
  if (client.current != null || client.next != null) return { says: client, checked: true };
  if (current !== SAMPLE.password)
    return {
      says: {
        current: 'That is not your current password. Try again, or reset it by email.',
        next: null,
      },
      checked: false,
    };
  if (next === current)
    return {
      says: { current: null, next: 'That is already your password. Choose a different one.' },
      checked: false,
    };

  return {
    says: { current: null, next: next === BREACHED_PASSWORD ? PASSWORD_REFUSED.breached : null },
    checked: false,
  };
}

export function chooseSays(password: string): FieldSays<'password'> {
  if (password === '') return { says: { password: 'Enter a password.' }, checked: true };
  if (!meetsPasswordLength(password))
    return { says: { password: PASSWORD_REFUSED.short }, checked: true };

  return {
    says: { password: password === BREACHED_PASSWORD ? PASSWORD_REFUSED.breached : null },
    checked: false,
  };
}

export function emailedCodeSays(code: string): string | null {
  const problem = sentCodeProblem(code);
  if (problem == null) return null;
  if (problem === 'blank') return 'Enter the 6-digit code from the email.';

  return problem === 'short'
    ? 'The code is 6 digits.'
    : 'That code did not match. Check the newest email from Soirely and try again.';
}

export function setupSays(code: string): string | null {
  const problem = authenticatorProblem(code);
  if (problem == null) return null;
  if (problem === 'blank') return 'Enter the 6-digit code from your app.';

  return problem === 'short'
    ? 'The code is 6 digits.'
    : 'That code does not match. Check the app was set up with the key above, then enter the code it shows now.';
}

export function resetSays(email: string): string | null {
  const problem = emailProblem(email);
  if (problem == null) return null;

  return problem === 'blank'
    ? 'Enter your email address.'
    : 'That does not look like an email address. Check it has an @ and a domain.';
}

/** Where each state starts: the sample's ways, two-factor and rules, and what is open over the page. */
export function securityStart(state: SecurityState): SecurityStart {
  const googleOnly =
    state === 'googleOnly' || state === 'setPassword' || state === 'setPasswordExpired';
  const picking = state === 'linkPick';
  const start: SecurityStart = {
    ways: { password: !googleOnly, Google: !picking, Apple: false },
    twoFactor: !googleOnly && state !== 'setup',
    codesLeft: state === 'recovery' ? RECOVERY_CODES.length : RECOVERY_LEFT,
    rules: { providerOnly: state === 'keptByRule' || picking, twoFactor: state === 'keptByRule' },
    opened: null,
    inView: null,
    ask: null,
    screen: null,
    proof: null,
  };

  switch (state) {
    case 'keptByRule':
      return { ...start, opened: 'Google' };
    case 'changePassword':
      return { ...start, screen: 'change' };
    case 'setPassword':
    case 'setPasswordExpired':
      return { ...start, screen: state };
    case 'link':
      return { ...start, opened: 'Apple', screen: 'confirm', proof: 'link' };
    case 'linkPick':
      return { ...start, inView: 'Apple' };
    case 'unlink':
      return { ...start, opened: 'Google', ask: 'unlink' };
    case 'setup':
      return { ...start, screen: 'setup' };
    case 'recovery':
      return { ...start, screen: 'recovery' };
    case 'newCodes':
      return { ...start, opened: 'codes', ask: 'newCodes' };
    case 'turnOff':
      return { ...start, opened: 'authenticator', ask: 'turnOff' };
    case 'signOutDevice':
      return { ...start, opened: 'safari', ask: 'signOut' };
    case 'everywhere':
      return { ...start, ask: 'everywhere', inView: 'everywhere' };
    case 'forgot':
      return { ...start, screen: 'forgot' };
    case 'forgotSent':
      return { ...start, screen: 'forgotSent' };
    default:
      return start;
  }
}
