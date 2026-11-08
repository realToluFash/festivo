import {
  PASSWORD_MINIMUM_LENGTH,
  cleanCode,
  codeProblem,
  emailProblem,
  meetsPasswordLength,
} from '@soirely/domain';

import {
  ADD_WORDS,
  CHANNEL_WORDS,
  PROVE_WORDS,
  VERIFY_WORDS,
  WRONG_CODE,
  WRONG_FACTOR,
} from './account.ts';
import { writtenTime } from './clock.ts';
import { SAMPLE } from './rules.ts';
import { type DemoLink, VIEWERS, type Viewer, settingsPath } from './settings.ts';

export type Provider = 'Google' | 'Apple';
export type DeviceKind = 'device' | 'laptop' | 'tablet';

export interface Ways {
  password: boolean;
  Google: boolean;
  Apple: boolean;
}

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  here: boolean;
  signedIn: Date;
  lastUsed: Date | null;
  expires: Date;
  ip: string;
}

export interface SecurityPage {
  ways: Ways;
  on: boolean;
  unused: number;
  devices: readonly string[];
  providerRule: boolean;
  twoFactorRule: boolean;
}

export const PROVIDERS: readonly Provider[] = ['Google', 'Apple'];
export const ORG = SAMPLE.organisation;
export const PROOF_MINUTES = 5;
export const CODES_MADE = 10;
export const SEND_MS = 500;
export const RESEND_FROM = 42;
export const NEW_PASSWORD = 'violet confetti hall';
export const SHORT_PASSWORD = 'short pwd';
export const WRONG_PASSWORD = 'horse battery';
export const AUTHENTICATOR_KEY = 'KZ4TQ7MB2XRAH5VN6JDWP3YCLFREGSUZ';
export { WRONG_CODE, WRONG_FACTOR };

export const RECOVERY_CODES: readonly string[] = [
  SAMPLE.recovery,
  'k4mq-8wze',
  'n2df-tq6a',
  'hx7c-3pmv',
  'r9ja-wk4s',
  'e6bn-y2qh',
  'm3tz-pf8d',
  'q7wg-5cxn',
  'a8ks-hv3j',
  'z5ry-dm9t',
];

export const NEW_CODES: readonly string[] = [
  'p6dw-jn3k',
  'c2xh-v8rm',
  'w9tb-4fqe',
  'g3ns-k7ya',
  'u8mc-2zdp',
  'b5ve-r6wq',
  'y4kf-h9sn',
  'd7qa-m3tx',
  'f2jz-c5wb',
  's6hp-e8gu',
];

/** At a desk this device is the browser, so the app's iPhone is one of the others. */
export const DEVICES: readonly [Device, Device, Device] = [
  {
    id: 'safari',
    kind: 'laptop',
    name: 'Safari on macOS',
    here: true,
    signedIn: new Date(2026, 9, 28, 16, 2),
    lastUsed: null,
    expires: new Date(2026, 11, 3),
    ip: '198.51.100.7',
  },
  {
    id: 'iphone',
    kind: 'device',
    name: 'Soirely app on iPhone',
    here: false,
    signedIn: new Date(2026, 9, 12, 9, 14),
    lastUsed: new Date(2026, 10, 3, 18, 40),
    expires: new Date(2026, 11, 4),
    ip: '203.0.113.24',
  },
  {
    id: 'ipad',
    kind: 'tablet',
    name: 'Soirely app on iPad',
    here: false,
    signedIn: new Date(2026, 8, 30, 11, 20),
    lastUsed: new Date(2026, 10, 1, 14, 15),
    expires: new Date(2026, 11, 1),
    ip: '192.0.2.61',
  },
];

const ALL_DEVICES = DEVICES.map((device) => device.id);
const OTHER_DEVICE = DEVICES[1];

function counted(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export const SECURITY_WORDS = {
  title: 'Security',
  on: 'Two-factor is on',
  off: 'Two-factor is off',
  summary: (ways: number, devices: number) =>
    `${counted(ways, '1 way', `${ways} ways`)} to sign in · ${counted(devices, '1 device', `${devices} devices`)}`,
  offLine:
    'Your account holds your clients’ guest lists; two-factor keeps a stolen password from being enough.',
  turnOn: 'Turn on two-factor',
  ways: 'Ways to sign in',
  password: 'Password',
  passwordSet: 'Set up · used with your email to sign in',
  passwordNone: 'Not set up',
  linked: (address: string | null) => (address == null ? 'Linked' : `Linked · ${address}`),
  notLinked: 'Not linked',
  last: (provider: Provider) =>
    `${provider} is your only way to sign in, so it can't be removed. Set a password or link another account before removing this one.`,
  link: (provider: Provider) => `Link ${provider}`,
  linkNote: (provider: Provider, email: string) =>
    `Next, ${provider} opens so you can choose the account to link. Its address doesn't have to match ${email}.`,
  unlinkAsking: 'Unlink…',
  unlinkKept: 'Unlink',
  unlinkLine: (provider: Provider, still: string) =>
    `Devices signed in with ${provider} are signed out. ${still}`,
  stillPassword: 'You can still sign in with your password.',
  stillProvider: (provider: Provider) => `You can still sign in with ${provider}.`,
  keptWay: (provider: Provider, other: Provider) =>
    `A rule set by ${ORG}: everyone in it signs in with Google or Apple, so your last one cannot be removed. Link ${other} first if you want to unlink ${provider}.`,
  twoFactor: 'Two-factor authentication',
  authenticator: 'Authenticator app',
  onLine: 'On · every sign-in asks for a code',
  offRow: 'Off',
  offFoot:
    'Asks for a code from an authenticator app every time you sign in, whether with your password, Google or Apple.',
  turnOffAsking: 'Turn off two-factor…',
  turnOffKept: 'Turn off two-factor',
  turnOffLine: (email: string) =>
    `Sign-ins stop asking for a code. We will email ${email} to say it was turned off.`,
  keptTwoFactor: `${ORG} requires two-factor, so you cannot turn it off.`,
  recoveryCodes: 'Recovery codes',
  codesLine: (left: number) => `${left} of ${CODES_MADE} unused · each works once`,
  newCodes: 'Make new codes',
  newCodesLine: 'New codes replace every code you have now, used or not, as soon as they are made.',
  devices: 'Signed in on',
  here: 'This device · in use now',
  used: (when: string) => `Last used ${when}`,
  signedFrom: (when: string, ip: string) => `Signed in ${when} · from ${ip}`,
  expires: (day: string) => `Expires ${day} if not used again`,
  signOut: 'Sign out',
  signOutAsking: 'Sign out…',
  hereOut: 'You leave Soirely on this device. Your other devices stay signed in.',
  signInAgain:
    'It has to sign in again before it can carry on, so first check that nobody is using it at an event.',
  devicesFoot:
    'Each device is listed as it described itself when it signed in, with the network address it used. Soirely cannot check either, or tell where a device is. Sign out any you do not recognise.',
  everywhere: 'Sign out everywhere else…',
  everywhereHint: 'Every device except this one. Asks you to confirm it is you first.',
} as const;

export const ASK_WORDS = {
  unlinkTitle: (provider: Provider) => `Unlink ${provider}?`,
  unlinkLine: (provider: Provider, address: string | null, still: string) =>
    `You'll no longer be able to sign in with ${provider}${address == null ? '' : ` as ${address}`}. Devices signed in with ${provider} are signed out. ${still}`,
  keepLinked: 'Keep it linked',
  unlinkGo: (provider: Provider) => `Unlink ${provider}`,
  signOutTitle: (name: string) => `Sign out ${name}?`,
  signOutLine:
    'Whoever has it is signed out, and you stay signed in here. If somebody else may have it, change your password as well; that signs out every other device.',
  keepSignedIn: 'Keep it signed in',
  signOutGo: 'Sign it out',
  turnOffTitle: 'Turn off two-factor?',
  keepOn: 'Keep it on',
  turnOffGo: 'Turn it off',
  newCodesTitle: 'Make new recovery codes?',
  keepCodes: 'Keep current codes',
  everywhereTitle: 'Sign out everywhere else?',
  everywhereLine: (others: number) =>
    others === 1
      ? 'This signs out your other device, whoever has it. It has to sign in again before it can carry on. This device stays signed in.'
      : `This signs out your ${others} other devices, whoever has them. They have to sign in again before they can carry on. This device stays signed in.`,
  keepThem: (others: number) => counted(others, 'Keep it signed in', 'Keep them signed in'),
  everywhereGo: (others: number) => counted(others, 'Sign it out', 'Sign them out'),
  passwordStays: 'Your password stays as it was.',
} as const;

export const CONFIRM_WORDS = {
  ...PROVE_WORDS,
  line: (verb: 'link' | 'unlink', provider: Provider) =>
    `To ${verb} ${provider}, confirm it's you. You won't be asked again for ${PROOF_MINUTES} minutes.`,
  everywhereWhy: 'So that nobody who picks up this device can do this without you.',
  codeOnly: 'Enter a code from your authenticator app, or one of your recovery codes.',
  everywhereHelp:
    'From your authenticator app, or one of your recovery codes. Two-factor protects this the way it protects signing in.',
  offEmailed: (email: string) => `We will email ${email} to say it was turned off.`,
  withProvider: (provider: Provider) =>
    `You sign in with ${provider}, so confirm with ${provider} instead.`,
  codeWrongLong:
    'That code did not work. Enter the code your app shows now, or an unused recovery code.',
} as const;

export const PASSWORD_WORDS = {
  title: 'Change password',
  verb: 'Save',
  current: 'Current password',
  forgot: 'Forgot it?',
  next: 'New password',
  rule: `At least ${PASSWORD_MINIMUM_LENGTH} characters`,
  met: 'Met',
  notYet: 'Not yet',
  ruleNote:
    'That is the only rule. When you submit, we also check the password has not appeared in a known data breach.',
  signsOut: 'Saving signs out your other devices; this one stays signed in.',
  changedEmailed: (email: string) => `We will email ${email} to say it was changed.`,
  currentBlank: 'Enter your current password.',
  nextBlank: 'Enter a new password.',
  wrongCurrent: 'That is not your current password. Try again, or reset it by email.',
  same: 'That is already your password. Choose a different one.',
  short: `Use at least ${PASSWORD_MINIMUM_LENGTH} characters.`,
  breached: 'This password has appeared in a known data breach. Choose another.',
  codeTitle: CHANNEL_WORDS.email.title,
  codeVerb: 'Continue',
  codeIntro: (email: string) => `We sent a 6-digit code to ${email} to make sure it's you.`,
  codeField: CHANNEL_WORDS.email.field,
  codeNewest: CHANNEL_WORDS.email.newest,
  codeNote: "Adding a password needs this, so someone using this device without you can't add one.",
  codeBlank: CHANNEL_WORDS.email.blank,
  codeShort: VERIFY_WORDS.short,
  codeWrong: 'That code did not match. Check the newest email from Soirely and try again.',
  chooseTitle: 'Choose a password',
  chooseField: 'Password',
  addedEmailed: (email: string) => `We will email ${email} to say a password was added.`,
  chooseBlank: 'Enter a password.',
} as const;

export const SETUP_WORDS = {
  title: 'Set up two-factor',
  verb: 'Turn on',
  scan: 'Scan this code with your authenticator app',
  qr: 'QR code for your authenticator app',
  cantScan: 'Can’t scan it? Enter this key in the app instead.',
  key: 'Setup key',
  field: 'Enter the 6-digit code the app shows',
  staysOff: 'Two-factor stays off until the code matches, so a setup mistake cannot lock you out.',
  blank: 'Enter the 6-digit code from your app.',
  short: VERIFY_WORDS.short,
  wrong:
    'That code does not match. Check the app was set up with the key above, then enter the code it shows now.',
} as const;

export const RECOVERY_WORDS = {
  title: 'Save your recovery codes',
  verb: 'Finish',
  intro:
    'If you lose your authenticator, each of these signs you in once. This is the only time they are shown.',
  list: 'Recovery codes',
  copyAll: 'Copy all',
  copied: 'Copied',
  copiedAll: `All ${CODES_MADE} codes are on your clipboard.`,
  saved: 'I have saved these codes somewhere safe',
  locked: 'Two-factor is on. Confirm you have saved the codes to leave this step.',
  ready: 'Two-factor is on. Finish to go back to Security.',
} as const;

export const FORGOT_WORDS = {
  title: 'Reset your password',
  verb: 'Send',
  intro:
    'Enter the email you sign in with. If it has an account, we send it a link to set a new password.',
  field: 'Email',
  blank: 'Enter your email address.',
  shape: ADD_WORDS.shape,
  sentTitle: CHANNEL_WORDS.email.title,
  sentVerb: 'Done',
  sentIntro:
    'If that address has an account, we have sent it a link to set a new password. The link works once.',
  nothingThere: 'Nothing there?',
  spam: 'Check your spam folder first, then send it again.',
  again: 'Send it again',
  providerNote:
    'Signed up with Google or Apple? Then there is no password to reset, and the email says how you sign in instead.',
  gotLink: 'Got the link? Open it on any device.',
} as const;

export const RESULT_WORDS = {
  changed: (others: number) =>
    others === 0
      ? 'Password changed. No other device was signed in.'
      : `Password changed. ${counted(others, 'Your other device is', `Your ${others} other devices are`)} signed out.`,
  added: (provider: Provider) => `Password added. You can sign in with it or with ${provider}.`,
  linked: (provider: Provider) =>
    `${provider} is linked. We emailed your verified addresses to say so.`,
  unlinked: (provider: Provider) =>
    `${provider} is unlinked. Devices signed in with it are signed out.`,
  on: 'Two-factor is on. Every sign-in now asks for a code from your app.',
  off: (email: string) => `Two-factor is off. We emailed ${email} to say so.`,
  newCodes: 'New recovery codes made. Your old ones no longer work.',
  device: (name: string) => `${name} is signed out.`,
  everywhere: (others: number) =>
    `${counted(others, 'Your other device is', `Your ${others} other devices are`)} signed out.`,
} as const;

const W = SECURITY_WORDS;

/** The viewer's own sign-in: their address, and the Google account linked to it. */
export function yourSecurity(viewer: Pick<Viewer, 'key' | 'name' | 'id'>) {
  const google =
    viewer.key === 'folake'
      ? SAMPLE.otherEmail
      : `${viewer.name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;

  return {
    email: viewer.id,
    address: { Google: google, Apple: null } as Record<Provider, string | null>,
  };
}

export function linkedProviders(ways: Ways): Provider[] {
  return PROVIDERS.filter((provider) => ways[provider]);
}

export function waysCount(ways: Ways): number {
  return Number(ways.password) + linkedProviders(ways).length;
}

export function onlyWayIn(ways: Ways, provider: Provider): boolean {
  return ways[provider] && !ways.password && linkedProviders(ways).length === 1;
}

export function keptByRule(page: SecurityPage, provider: Provider): boolean {
  return page.providerRule && page.ways[provider] && linkedProviders(page.ways).length === 1;
}

export function otherProvider(provider: Provider): Provider {
  return provider === 'Google' ? 'Apple' : 'Google';
}

export function stillLine(ways: Ways, provider: Provider): string {
  if (ways.password) return W.stillPassword;
  const other = linkedProviders(ways).find((each) => each !== provider);

  return other == null ? '' : W.stillProvider(other);
}

export function devicesOf(page: SecurityPage): Device[] {
  return DEVICES.filter((device) => page.devices.includes(device.id));
}

export function othersOf(page: SecurityPage): number {
  return devicesOf(page).filter((device) => !device.here).length;
}

/** The card: how you are protected, then what you just did, or why two-factor matters while it is off. */
export function cardOf(page: SecurityPage, said: string | null) {
  return {
    says: page.on ? W.on : W.off,
    summary: W.summary(waysCount(page.ways), page.devices.length),
    line: said ?? (page.on ? null : W.offLine),
    done: said != null,
    step: page.on ? null : W.turnOn,
  };
}

export function dayOf(when: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(when);
}

export function dayAtTime(when: Date, locale: string): string {
  return `${dayOf(when, locale)} at ${writtenTime(when, locale)}`;
}

export function deviceLine(device: Device, locale: string): string {
  return device.lastUsed == null ? W.here : W.used(dayAtTime(device.lastUsed, locale));
}

export function ruleMet(password: string): boolean {
  return meetsPasswordLength(password);
}

export function changeProblems(current: string, next: string): { current?: string; next?: string } {
  if (current === '' || next === '')
    return {
      ...(current === '' && { current: PASSWORD_WORDS.currentBlank }),
      ...(next === '' && { next: PASSWORD_WORDS.nextBlank }),
    };
  if (!meetsPasswordLength(next)) return { next: PASSWORD_WORDS.short };
  if (current !== SAMPLE.password) return { current: PASSWORD_WORDS.wrongCurrent };
  if (next === current) return { next: PASSWORD_WORDS.same };

  return next === SAMPLE.breachedPassword ? { next: PASSWORD_WORDS.breached } : {};
}

export function chooseRefusal(password: string): string | null {
  if (password === '') return PASSWORD_WORDS.chooseBlank;
  if (!meetsPasswordLength(password)) return PASSWORD_WORDS.short;

  return password === SAMPLE.breachedPassword ? PASSWORD_WORDS.breached : null;
}

export function emailedCodeRefusal(typed: string): string | null {
  const problem = codeProblem(typed);
  if (problem === 'blank') return PASSWORD_WORDS.codeBlank;
  if (problem === 'short') return PASSWORD_WORDS.codeShort;

  return cleanCode(typed) === SAMPLE.code ? null : PASSWORD_WORDS.codeWrong;
}

export function setupRefusal(typed: string): string | null {
  const problem = codeProblem(typed);
  if (problem === 'blank') return SETUP_WORDS.blank;
  if (problem === 'short') return SETUP_WORDS.short;

  return cleanCode(typed) === SAMPLE.authenticator ? null : SETUP_WORDS.wrong;
}

export function forgotRefusal(typed: string): string | null {
  const problem = emailProblem(typed);
  if (problem === 'blank') return FORGOT_WORDS.blank;

  return problem === 'shape' ? FORGOT_WORDS.shape : null;
}

export type Purpose = 'link' | 'unlink' | 'everywhere' | 'turnOff' | 'newCodes';

export interface ProveAsks {
  lead: string;
  note: string | null;
  password: boolean;
  provider: Provider | null;
  code: boolean;
  codeHelp: string;
}

/** What Confirm it's you asks: your password where the product asks it, a code while two-factor is on, a provider when there is no password. */
export function proveAsks(
  purpose: Purpose,
  provider: Provider | null,
  page: SecurityPage,
  email: string,
): ProveAsks {
  const codeOnly = purpose === 'turnOff' || purpose === 'newCodes';
  const by = linkedProviders(page.ways)[0] ?? null;
  const lead =
    purpose === 'link' || purpose === 'unlink'
      ? CONFIRM_WORDS.line(purpose, provider ?? 'Google')
      : purpose === 'everywhere'
        ? CONFIRM_WORDS.everywhereWhy
        : CONFIRM_WORDS.codeOnly;

  return {
    lead,
    note: purpose === 'link' && provider != null ? W.linkNote(provider, email) : null,
    password: !codeOnly && page.ways.password,
    provider: !codeOnly && !page.ways.password ? by : null,
    code: codeOnly || page.on,
    codeHelp:
      purpose === 'everywhere'
        ? CONFIRM_WORDS.everywhereHelp
        : purpose === 'turnOff'
          ? CONFIRM_WORDS.offEmailed(email)
          : CONFIRM_WORDS.codeHelp,
  };
}

export function proveProblems(
  asks: Pick<ProveAsks, 'password' | 'code'>,
  purpose: Purpose,
  password: string,
  code: string,
): { password?: string; code?: string } {
  const factor = cleanCode(code).toLowerCase();
  const problems: { password?: string; code?: string } = {};
  const wrong =
    purpose === 'link' || purpose === 'unlink'
      ? CONFIRM_WORDS.codeWrong
      : CONFIRM_WORDS.codeWrongLong;

  if (asks.password && password === '') problems.password = CONFIRM_WORDS.passwordBlank;
  else if (asks.password && password !== SAMPLE.password)
    problems.password = CONFIRM_WORDS.passwordWrong;
  if (asks.code && factor === '') problems.code = CONFIRM_WORDS.codeBlank;
  else if (asks.code && factor !== SAMPLE.authenticator && factor !== SAMPLE.recovery)
    problems.code = wrong;

  return problems;
}

/** A drawn QR: 21 modules with its three finder squares and a fixed scatter between them. */
export function qrPath(modules = 21, seed = 4): string {
  let state = seed;
  const next = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const finder = (x: number, y: number): boolean =>
    (x < 8 && y < 8) || (x > modules - 9 && y < 8) || (x < 8 && y > modules - 9);
  let path = '';

  for (let y = 0; y < modules; y += 1)
    for (let x = 0; x < modules; x += 1)
      if (!finder(x, y) && next() < 0.48) path += `M${x} ${y}h1v1h-1z`;

  for (const [fx, fy] of [
    [0, 0],
    [modules - 7, 0],
    [0, modules - 7],
  ] as const)
    path += `M${fx} ${fy}h7v7h-7zM${fx + 1} ${fy + 1}v5h5v-5zM${fx + 2} ${fy + 2}h3v3h-3z`;

  return path;
}

export type DialogKind =
  'change' | 'forgot' | 'sent' | 'setCode' | 'choose' | 'prove' | 'setup' | 'recovery';

export interface DialogStart {
  kind: DialogKind;
  purpose: Purpose | null;
  provider: Provider | null;
  typed: string;
  second: string;
  tried: boolean;
  discarding: boolean;
  copied: boolean;
  saved: boolean;
  expired: boolean;
}

export function opening(kind: DialogKind, more: Partial<DialogStart> = {}): DialogStart {
  return {
    kind,
    purpose: null,
    provider: null,
    typed: '',
    second: '',
    tried: false,
    discarding: false,
    copied: false,
    saved: false,
    expired: false,
    ...more,
  };
}

export type AskKind = 'unlink' | 'signOut' | 'turnOff' | 'newCodes' | 'everywhere';

export interface SecurityStart {
  page: SecurityPage;
  said: string | null;
  open: string | null;
  ask: AskKind | null;
  dialog: DialogStart | null;
}

/** The app's states after the page at rest, then the moments only the web links to. */
export const SECURITY_STATES = [
  'googleOnly',
  'keptByRule',
  'changePassword',
  'setPassword',
  'setPasswordExpired',
  'link',
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

export const WEB_MOMENTS = [
  'googleOpen',
  'twoFactorKept',
  'thisDeviceOpen',
  'deviceOpen',
  'changeBlank',
  'changeWrong',
  'changeShort',
  'changeBreached',
  'changeDiscard',
  'changed',
  'forgotShape',
  'setPasswordWrong',
  'choosePassword',
  'added',
  'linkPick',
  'linkWrong',
  'linked',
  'unlinkProve',
  'unlinked',
  'setupWrong',
  'recoverySaved',
  'turnedOn',
  'newCodesProve',
  'turnOffProve',
  'turnedOff',
  'deviceSignedOut',
  'everywhereProve',
  'everywhereBlank',
  'everywhereDone',
] as const;

type SecurityState = (typeof SECURITY_STATES)[number] | (typeof WEB_MOMENTS)[number];

function stateOf(name: string): SecurityState | null {
  return [...SECURITY_STATES, ...WEB_MOMENTS].find((state) => state === name) ?? null;
}

export const REST_PAGE: SecurityPage = {
  ways: { password: true, Google: true, Apple: false },
  on: true,
  unused: 8,
  devices: ALL_DEVICES,
  providerRule: false,
  twoFactorRule: false,
};

/** What a state link opens on; one the page does not know opens it at rest. */
export function securityStart(state: string, viewer: Viewer = VIEWERS.folake): SecurityStart {
  const name = stateOf(state);
  const { email } = yourSecurity(viewer);
  const REST: SecurityStart = { page: REST_PAGE, said: null, open: null, ask: null, dialog: null };
  const page = (more: Partial<SecurityPage>) => ({ ...REST_PAGE, ...more });
  const googleOnly = page({ ways: { password: false, Google: true, Apple: false }, on: false });
  const kept = page({ providerRule: true, twoFactorRule: true });
  const here = DEVICES.filter((device) => device.here).map((device) => device.id);
  const change = (typed: string, second: string, more: Partial<DialogStart> = {}) => ({
    ...REST,
    dialog: opening('change', { typed, second, ...more }),
  });
  const prove = (purpose: Purpose, provider: Provider | null, more: Partial<DialogStart> = {}) =>
    opening('prove', { purpose, provider, ...more });

  switch (name) {
    case null:
      return REST;
    case 'googleOnly':
      return { ...REST, page: googleOnly };
    case 'keptByRule':
      return { ...REST, page: kept, open: 'Google' };
    case 'googleOpen':
      return { ...REST, open: 'Google' };
    case 'twoFactorKept':
      return { ...REST, page: kept, open: 'auth' };
    case 'thisDeviceOpen':
      return { ...REST, open: here[0] ?? null };
    case 'deviceOpen':
      return { ...REST, open: OTHER_DEVICE.id };
    case 'changePassword':
      return change(SAMPLE.password, NEW_PASSWORD);
    case 'changeBlank':
      return change('', '', { tried: true });
    case 'changeWrong':
      return change(WRONG_PASSWORD, NEW_PASSWORD, { tried: true });
    case 'changeShort':
      return change(SAMPLE.password, SHORT_PASSWORD, { tried: true });
    case 'changeBreached':
      return change(SAMPLE.password, SAMPLE.breachedPassword, { tried: true });
    case 'changeDiscard':
      return change(SAMPLE.password, NEW_PASSWORD, { discarding: true });
    case 'changed':
      return {
        ...REST,
        page: page({ devices: here }),
        said: RESULT_WORDS.changed(ALL_DEVICES.length - here.length),
      };
    case 'forgot':
      return { ...REST, dialog: opening('forgot', { typed: email }) };
    case 'forgotShape':
      return {
        ...REST,
        dialog: opening('forgot', { typed: email.replace(/\.[^.@]+$/u, ''), tried: true }),
      };
    case 'forgotSent':
      return { ...REST, dialog: opening('sent') };
    case 'setPassword':
      return { ...REST, page: googleOnly, dialog: opening('setCode') };
    case 'setPasswordExpired':
      return { ...REST, page: googleOnly, dialog: opening('setCode', { expired: true }) };
    case 'setPasswordWrong':
      return {
        ...REST,
        page: googleOnly,
        dialog: opening('setCode', { typed: WRONG_CODE, tried: true }),
      };
    case 'choosePassword':
      return { ...REST, page: googleOnly, dialog: opening('choose', { typed: NEW_PASSWORD }) };
    case 'added':
      return {
        ...REST,
        page: page({ on: false }),
        said: RESULT_WORDS.added('Google'),
      };
    case 'linkPick':
      return {
        ...REST,
        page: page({ ways: { password: true, Google: false, Apple: false }, providerRule: true }),
      };
    case 'link':
      return { ...REST, open: 'Apple', dialog: prove('link', 'Apple') };
    case 'linkWrong':
      return {
        ...REST,
        open: 'Apple',
        dialog: prove('link', 'Apple', {
          typed: SAMPLE.password,
          second: WRONG_FACTOR,
          tried: true,
        }),
      };
    case 'linked':
      return {
        ...REST,
        page: page({ ways: { password: true, Google: true, Apple: true } }),
        said: RESULT_WORDS.linked('Apple'),
      };
    case 'unlink':
      return { ...REST, open: 'Google', ask: 'unlink' };
    case 'unlinkProve':
      return { ...REST, open: 'Google', dialog: prove('unlink', 'Google') };
    case 'unlinked':
      return {
        ...REST,
        page: page({ ways: { password: true, Google: false, Apple: false } }),
        said: RESULT_WORDS.unlinked('Google'),
      };
    case 'setup':
      return { ...REST, page: page({ on: false }), dialog: opening('setup') };
    case 'setupWrong':
      return {
        ...REST,
        page: page({ on: false }),
        dialog: opening('setup', { typed: WRONG_FACTOR, tried: true }),
      };
    case 'recovery':
      return { ...REST, page: page({ unused: CODES_MADE }), dialog: opening('recovery') };
    case 'recoverySaved':
      return {
        ...REST,
        page: page({ unused: CODES_MADE }),
        dialog: opening('recovery', { copied: true, saved: true }),
      };
    case 'turnedOn':
      return { ...REST, page: page({ unused: CODES_MADE }), said: RESULT_WORDS.on };
    case 'newCodes':
      return { ...REST, open: 'codes', ask: 'newCodes' };
    case 'newCodesProve':
      return { ...REST, open: 'codes', dialog: prove('newCodes', null) };
    case 'turnOff':
      return { ...REST, open: 'auth', ask: 'turnOff' };
    case 'turnOffProve':
      return { ...REST, open: 'auth', dialog: prove('turnOff', null) };
    case 'turnedOff':
      return { ...REST, page: page({ on: false }), said: RESULT_WORDS.off(email) };
    case 'signOutDevice':
      return { ...REST, open: OTHER_DEVICE.id, ask: 'signOut' };
    case 'deviceSignedOut':
      return {
        ...REST,
        page: page({ devices: ALL_DEVICES.filter((id) => id !== OTHER_DEVICE.id) }),
        said: RESULT_WORDS.device(OTHER_DEVICE.name),
      };
    case 'everywhere':
      return { ...REST, ask: 'everywhere' };
    case 'everywhereProve':
      return { ...REST, dialog: prove('everywhere', null) };
    case 'everywhereBlank':
      return { ...REST, dialog: prove('everywhere', null, { tried: true }) };
    case 'everywhereDone':
      return {
        ...REST,
        page: page({ devices: here }),
        said: RESULT_WORDS.everywhere(ALL_DEVICES.length - here.length),
      };
  }
}

export interface HeldStep {
  label: string;
  opens: 'setup' | 'linkPick';
}

export const HELD_STEPS = {
  turnOn: { label: W.turnOn, opens: 'setup' },
  link: { label: 'Link Google or Apple', opens: 'linkPick' },
} as const satisfies Record<string, HeldStep>;

/** A held step elsewhere in Settings opens Security on the moment that ends the hold. */
export function heldStepPath(step: HeldStep, viewer: Pick<Viewer, 'key'>): string {
  return settingsPath('security', viewer, step.opens);
}

function security(state: string | undefined, name: string): DemoLink {
  return { to: settingsPath('security', VIEWERS.folake, state), name };
}

export const SECURITY_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The page',
    states: [
      security(undefined, 'At rest, two-factor on'),
      { to: settingsPath('security', VIEWERS.julien), name: 'The same for an admin' },
      { to: settingsPath('security', VIEWERS.ana), name: 'The same for a member' },
      security('googleOnly', 'Google only, two-factor off'),
      security('googleOpen', 'Google, opened'),
      security('keptByRule', 'Kept by a rule'),
      security('twoFactorKept', 'Two-factor kept by a rule'),
      security('thisDeviceOpen', 'This device, opened'),
      security('deviceOpen', 'Another device, opened'),
    ],
  },
  {
    name: 'Your password',
    states: [
      security('changePassword', 'Change password'),
      security('changeBlank', 'Change, left blank'),
      security('changeWrong', 'Change, a wrong current password'),
      security('changeShort', 'Change, too short'),
      security('changeBreached', 'Change, in a known breach'),
      security('changeDiscard', 'Change, Cancel after typing'),
      security('changed', 'Password changed'),
      security('forgot', 'Reset your password'),
      security('forgotShape', 'Reset, not an address'),
      security('forgotSent', 'Check your email, the link sent'),
    ],
  },
  {
    name: 'Ways to sign in',
    states: [
      security('setPassword', 'Set a password, the code'),
      security('setPasswordWrong', 'Set a password, a wrong code'),
      security('setPasswordExpired', 'Set a password, the code expired'),
      security('choosePassword', 'Choose a password'),
      security('added', 'Password added'),
      security('linkPick', 'Neither linked, a held step’s landing'),
      security('link', 'Link Apple, Confirm it’s you'),
      security('linkWrong', 'Confirm it’s you, a wrong code'),
      security('linked', 'Apple linked'),
      security('unlink', 'Unlink Google?'),
      security('unlinkProve', 'Unlink, Confirm it’s you'),
      security('unlinked', 'Google unlinked'),
    ],
  },
  {
    name: 'Two-factor',
    states: [
      security('setup', 'Set up two-factor'),
      security('setupWrong', 'Set up, a wrong code'),
      security('recovery', 'Save your recovery codes'),
      security('recoverySaved', 'Codes copied and saved'),
      security('turnedOn', 'Two-factor on'),
      security('newCodes', 'Make new recovery codes?'),
      security('newCodesProve', 'New codes, Confirm it’s you'),
      security('turnOff', 'Turn off two-factor?'),
      security('turnOffProve', 'Turn off, Confirm it’s you'),
      security('turnedOff', 'Two-factor off'),
    ],
  },
  {
    name: 'Devices',
    states: [
      security('signOutDevice', 'Sign out a device?'),
      security('deviceSignedOut', 'A device signed out'),
      security('everywhere', 'Sign out everywhere else?'),
      security('everywhereProve', 'Everywhere, Confirm it’s you'),
      security('everywhereBlank', 'Everywhere, left blank'),
      security('everywhereDone', 'Everywhere else signed out'),
    ],
  },
];
