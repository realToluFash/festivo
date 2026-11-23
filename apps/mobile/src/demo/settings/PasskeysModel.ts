import { dayOf } from './SecuritySample.ts';

export type Unlock = 'faceId' | 'touchId' | 'passkey';

export interface SamplePasskey {
  id: string;
  /** The provider's name when its AAGUID is in the public list; null shows Passkey. */
  provider: string | null;
  /** The backup state (BS) the passkey last reported: Synced, or This device only. */
  synced: boolean;
  added: Date;
}

export interface Factors {
  app: Date | null;
  passkeys: readonly SamplePasskey[];
}

export const PASSKEY_CAP = 10;

export type KeyMode = 'choose' | 'proof' | 'add';

export const APP_ON = new Date(2026, 9, 12);

const PROVIDERS: readonly (string | null)[] = [
  'iCloud Keychain',
  'Google Password Manager',
  null,
  '1Password',
];

export function samplePasskey(index: number): SamplePasskey {
  const provider = PROVIDERS[index % PROVIDERS.length] ?? null;

  return {
    id: `passkey-${index + 1}`,
    provider,
    synced: provider != null,
    added: new Date(2026, 10, 20 - index * 3),
  };
}

export function samplePasskeys(count: number): SamplePasskey[] {
  return Array.from({ length: count }, (_, index) => samplePasskey(index));
}

export function madeHere(ios: boolean, made: Date, count: number): SamplePasskey {
  return {
    id: `made-${count}`,
    provider: ios ? 'iCloud Keychain' : 'Google Password Manager',
    synced: true,
    added: made,
  };
}

export function unlockOf(ios: boolean, enrolled: 'faceId' | 'touchId' | null): Unlock {
  return ios && enrolled != null ? enrolled : 'passkey';
}

const CHOICE: Record<Unlock, { title: string; line: string }> = {
  faceId: {
    title: 'Use Face ID',
    line: 'Saves a passkey and asks for your face each time you sign in.',
  },
  touchId: {
    title: 'Use Touch ID',
    line: 'Saves a passkey and asks for your fingerprint each time you sign in.',
  },
  passkey: {
    title: 'Use a passkey',
    line: 'Saves a passkey and asks for your screen lock each time you sign in.',
  },
};

export function passkeyChoice(unlock: Unlock): { title: string; line: string } {
  return CHOICE[unlock];
}

export const APP_CHOICE = {
  title: 'Use an authenticator app',
  line: 'Asks for a 6-digit code from an app on your phone each time you sign in.',
};

export function factorCount(factors: Factors): number {
  return factors.passkeys.length + (factors.app == null ? 0 : 1);
}

export interface FactorRow {
  id: string;
  kind: 'app' | 'passkey';
  title: string;
  line: string;
  /** Every factor but the last has Remove…; the last has Turn off two-factor… in its place. */
  removable: boolean;
}

export function factorRows(factors: Factors, locale: string): FactorRow[] {
  const removable = factorCount(factors) > 1;
  const rows: (FactorRow & { at: Date })[] = factors.passkeys.map((passkey) => ({
    id: passkey.id,
    kind: 'passkey',
    title: passkey.provider ?? 'Passkey',
    line: `${passkey.synced ? 'Synced' : 'This device only'} · Added ${dayOf(passkey.added, locale)}`,
    removable,
    at: passkey.added,
  }));
  if (factors.app != null)
    rows.push({
      id: 'authenticator',
      kind: 'app',
      title: 'Authenticator app',
      line: `Turned on ${dayOf(factors.app, locale)}`,
      removable,
      at: factors.app,
    });

  return rows
    .sort((one, other) => other.at.getTime() - one.at.getTime())
    .map(({ at: _at, ...row }) => row);
}

export function offersAddPasskey(factors: Factors): boolean {
  return factors.passkeys.length < PASSKEY_CAP;
}

export function offersAddApp(factors: Factors): boolean {
  return factors.app == null && factors.passkeys.length > 0;
}

export function secondStep(factors: Factors): 'passkey' | 'code' {
  return factors.passkeys.length > 0 ? 'passkey' : 'code';
}

export function codeInstead(factors: Factors): 'code' | 'recovery' {
  return factors.app == null ? 'recovery' : 'code';
}

export function withoutFactor(factors: Factors, id: string): Factors {
  return id === 'authenticator'
    ? { ...factors, app: null }
    : { ...factors, passkeys: factors.passkeys.filter((passkey) => passkey.id !== id) };
}

export const CARD_LINE =
  'Add a passkey only on your own phone or computer, never on a shared or venue device.';

export function removeAsk(
  row: FactorRow,
  email: string,
): { title: string; line: string; keep: string; confirm: string; removes: true } {
  if (row.kind === 'app')
    return {
      title: 'Remove the authenticator app?',
      line: `Its codes stop working for Soirely at once. Your passkeys and recovery codes still work. We will email ${email}.`,
      keep: 'Keep the app',
      confirm: 'Remove the app',
      removes: true,
    };

  return {
    title: 'Remove this passkey?',
    line: `${row.title} · ${row.line}. It stops working for Soirely at once, but stays in your password manager until you delete it there. We will email ${email}.`,
    keep: 'Keep the passkey',
    confirm: 'Remove the passkey',
    removes: true,
  };
}

export function removedLine(row: FactorRow, email: string): string {
  return row.kind === 'app'
    ? `Authenticator app removed. We emailed ${email}.`
    : `Passkey removed. Delete it from your password manager too if you no longer want it. We emailed ${email}.`;
}

export function addedLine(kind: 'app' | 'passkey', email: string): string {
  return kind === 'app'
    ? `Authenticator app added. We emailed ${email}.`
    : `Passkey added. We emailed ${email}.`;
}

export type PasskeyStep = 'signIn' | 'confirm' | 'reset';

export const WAITING = 'Waiting for your passkey…';
export const PASSKEY_REFUSED =
  'That passkey did not work. Use a passkey again, or use a code instead.';

export function waitingWords(step: PasskeyStep, email: string): { title: string; intro: string } {
  switch (step) {
    case 'signIn':
      return {
        title: 'Use your passkey',
        intro: `Confirm it’s you with a passkey saved for ${email}.`,
      };
    case 'confirm':
      return {
        title: 'Confirm it’s you',
        intro: 'Use your passkey to confirm this change.',
      };
    case 'reset':
      return {
        title: 'Confirm it’s you',
        intro: `Use your passkey before you set a new password for ${email}.`,
      };
  }
}

export function changeLead(change: 'remove' | 'addPasskey' | 'addApp'): string {
  switch (change) {
    case 'remove':
      return 'Confirm it’s you before you remove it.';
    case 'addPasskey':
      return 'Confirm it’s you before you add a passkey.';
    case 'addApp':
      return 'Confirm it’s you before you add an authenticator app.';
  }
}

export const PASSKEY_ON = 'Two-factor is on. Every sign-in now asks for your passkey.';
