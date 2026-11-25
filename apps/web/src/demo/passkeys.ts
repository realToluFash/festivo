/** A passkey as the API would list it: the provider only when its AAGUID is in the public list, Synced from the BS flag (never BE), and the day it was made. Nothing else feeds a row. */
export interface Passkey {
  id: string;
  provider: string | null;
  synced: boolean;
  added: Date;
}

export interface Factors {
  app: Date | null;
  passkeys: readonly Passkey[];
}

export const MAX_PASSKEYS = 10;
export const CHALLENGE_MINUTES = 5;
export const APP_ON = new Date(2026, 9, 3, 10, 12);

export const PASSKEYS: readonly [Passkey, Passkey, Passkey] = [
  {
    id: 'pk-icloud',
    provider: 'iCloud Keychain',
    synced: true,
    added: new Date(2026, 10, 20, 9, 4),
  },
  {
    id: 'pk-google',
    provider: 'Google Password Manager',
    synced: true,
    added: new Date(2026, 10, 12, 18, 30),
  },
  { id: 'pk-key', provider: null, synced: false, added: new Date(2026, 10, 6, 11, 45) },
];

const TEN_PROVIDERS = [
  'iCloud Keychain',
  'Google Password Manager',
  null,
  '1Password',
  'Bitwarden',
  'Windows Hello',
  null,
  'Dashlane',
  'Samsung Pass',
  'Proton Pass',
] as const;

/** Ten passkeys, the most an account holds: a day apart, newest first, the unlisted ones on a security key. */
export const TEN_PASSKEYS: readonly Passkey[] = TEN_PROVIDERS.map((provider, index) => ({
  id: `pk-${index + 1}`,
  provider,
  synced: provider != null && provider !== 'Windows Hello',
  added: new Date(2026, 10, 20 - index, 9, 0),
}));

export function madePasskey(now: Date, count: number): Passkey {
  return { id: `pk-made-${count}`, provider: 'iCloud Keychain', synced: true, added: now };
}

export type FactorRow =
  { key: 'auth'; kind: 'app'; on: Date } | { key: string; kind: 'passkey'; passkey: Passkey };

export function factorRows(factors: Factors): FactorRow[] {
  const rows: FactorRow[] = factors.passkeys.map((passkey) => ({
    key: passkey.id,
    kind: 'passkey',
    passkey,
  }));
  if (factors.app != null) rows.push({ key: 'auth', kind: 'app', on: factors.app });

  return rows.sort((a, b) => dated(b).getTime() - dated(a).getTime());
}

function dated(row: FactorRow): Date {
  return row.kind === 'app' ? row.on : row.passkey.added;
}

export function factorCount(factors: Factors): number {
  return factors.passkeys.length + (factors.app == null ? 0 : 1);
}

export function offersPasskey(factors: Factors, webauthn: boolean): boolean {
  return webauthn && factors.passkeys.length < MAX_PASSKEYS;
}

export function atMost(factors: Factors, webauthn: boolean): boolean {
  return webauthn && factors.passkeys.length >= MAX_PASSKEYS;
}

export function offersApp(factors: Factors): boolean {
  return factors.app == null && factors.passkeys.length > 0;
}

export function turnOffAt(factors: Factors): 'row' | 'end' {
  return factorCount(factors) === 1 ? 'row' : 'end';
}

export type CodeStep = 'code' | 'recovery';

export function codeStepOf(factors: Factors): CodeStep {
  return factors.app == null ? 'recovery' : 'code';
}

export function firstStep(factors: Factors, webauthn: boolean): 'passkey' | CodeStep {
  return webauthn && factors.passkeys.length > 0 ? 'passkey' : codeStepOf(factors);
}

export type Held = 'app' | 'passkeys' | 'both';

export function heldOf(factors: Factors): Held {
  if (factors.passkeys.length === 0) return 'app';

  return factors.app == null ? 'passkeys' : 'both';
}

/** The lost-two-factor link names the factors the member has; all three lead where today's does (sc-86885, #87307). */
export const LOST_WORDS: Record<Held, string> = {
  app: 'Lost your authenticator and your recovery codes?',
  passkeys: 'Lost your passkeys and your recovery codes?',
  both: 'Lost your passkeys, your authenticator and your recovery codes?',
};

/** The page the lost link opens names the same factors; with the app only it reads as today (sc-86885, #87331). */
export const LOST_PAGE_WORDS: Record<Held, { title: string; line: string }> = {
  app: {
    title: 'Get back in without your authenticator',
    line: 'For when you have lost your authenticator app and your recovery codes.',
  },
  passkeys: {
    title: 'Get back in without your passkeys',
    line: 'For when you have lost your passkeys and your recovery codes.',
  },
  both: {
    title: 'Get back in without your passkeys or authenticator',
    line: 'For when you have lost your passkeys, your authenticator app and your recovery codes.',
  },
};

/** Save your recovery codes, its first line by the factors held (sc-86885, #87331). */
export const SAVE_WORDS: Record<Held, string> = {
  app: 'If you lose your authenticator, each of these signs you in once. This is the only time they are shown.',
  passkeys:
    'If you lose your passkeys, each of these signs you in once. This is the only time they are shown.',
  both: 'If you lose your passkeys and your authenticator, each of these signs you in once. This is the only time they are shown.',
};

/** The lost page's `?state=` for the factors held. */
export function lostStart(held: Held): string | undefined {
  return held === 'app' ? undefined : held === 'passkeys' ? 'passkeys-only' : 'both';
}

export function passkeyName(passkey: Passkey): string {
  return passkey.provider ?? PASSKEY_WORDS.passkey;
}

export function keptIn(passkey: Passkey): string {
  return passkey.provider ?? 'your password manager or security key';
}

export const PASSKEY_WORDS = {
  choiceTitle: 'Turn on two-factor',
  choiceAsk: 'How do you want to do it?',
  usePasskey: 'Use a passkey',
  usePasskeyLine:
    'Unlock with your face, fingerprint, PIN or screen lock, on this device, your phone or a security key.',
  useApp: 'Use an authenticator app',
  useAppLine: 'Enter a 6-digit code from an app on your phone each time.',
  ownDevice: 'Add a passkey only on your own phone or computer, never on a shared or venue device.',
  waiting: 'Waiting for your passkey…',
  passkey: 'Passkey',
  synced: 'Synced',
  deviceOnly: 'This device only',
  added: (day: string) => `Added ${day}`,
  appOn: (day: string) => `Turned on ${day}`,
  addPasskey: 'Add a passkey',
  addApp: 'Add an authenticator app',
  atMost: `You have ${MAX_PASSKEYS} passkeys, the most an account can hold. Remove one to add another.`,
  remove: 'Remove…',
  removeLine: 'Asks you to confirm it’s you first. We email you to say it was removed.',
  turnOffEnd: 'Removes every passkey and the app, and stops sign-ins asking for either.',
  proveTitle: 'Confirm it’s you',
  waitTitle: 'Use your passkey',
  waitLine: 'Your browser asks for it. Unlock it with your face, fingerprint, PIN or screen lock.',
  useCode: 'Use a code instead',
  usePasskeyInstead: 'Use a passkey instead',
  refused: 'That passkey did not work. Use a passkey again, or use a code instead.',
  noBrowser: 'This browser can’t use passkeys.',
  pausedTitle: 'Too many tries',
  paused: (time: string) =>
    `Two-factor is paused until ${time}. Then use a passkey, or enter a code.`,
  tryAt: (time: string) => `Try again at ${time}`,
  codeLead: 'Enter a code from your authenticator app, or one of your recovery codes.',
  codeHelp: 'From your authenticator app, or one of your recovery codes.',
  recoveryLead: 'Enter one of your recovery codes. Each works once.',
  recoveryLabel: 'Recovery code',
  recoveryHelp: 'One of the codes you saved when you turned on two-factor.',
  codeLabel: 'Code',
  codeBlank: 'Enter a code from your authenticator app, or a recovery code.',
  recoveryBlank: 'Enter one of your recovery codes.',
  codeWrong: 'That code did not work. Check it and try again.',
  makeTitle: 'Add a passkey',
  makeLine: 'Your browser asks where to save it. Choose your own phone, computer or security key.',
  continue: 'Continue',
  addAppLine: 'The app is added only once the code matches. Your passkeys keep working either way.',
  addAppVerb: 'Add the app',
} as const;

export const REMOVE_WORDS = {
  passkeyTitle: (passkey: Passkey) =>
    passkey.provider == null ? 'Remove this passkey?' : `Remove the ${passkey.provider} passkey?`,
  appTitle: 'Remove the authenticator app?',
  passkeyLine: (passkey: Passkey, email: string) =>
    `It stops working for Soirely at once. It stays in ${keptIn(passkey)} until you delete it there. We will email ${email} to say it was removed.`,
  appLine: (email: string) =>
    `Its codes stop working for Soirely at once. Your passkeys keep working. We will email ${email} to say it was removed.`,
  keep: 'Keep it',
  passkeyGo: 'Remove the passkey',
  appGo: 'Remove the app',
} as const;

export const PASSKEY_RESULTS = {
  onPasskey: 'Two-factor is on. Every sign-in now asks for your passkey.',
  passkeyAdded: (email: string) => `Passkey added. We emailed ${email} to say so.`,
  appAdded: (email: string) => `Authenticator app added. We emailed ${email} to say so.`,
  passkeyRemoved: (passkey: Passkey, email: string) =>
    `Passkey removed. It stays in ${keptIn(passkey)} until you delete it there. We emailed ${email} to say so.`,
  appRemoved: (email: string) => `Authenticator app removed. We emailed ${email} to say so.`,
} as const;
