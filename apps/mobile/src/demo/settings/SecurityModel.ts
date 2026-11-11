import type { Provider } from '@soirely/api-client';
import { cleanCode, formatDay } from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { Refused } from '../../components/SecurityPassword.tsx';
import { deviceMoment } from '../../kit/devices.ts';
import type { DeviceView, SecurityRules, Ways } from '../../kit/securityPage.ts';
import { codeHelp, proveIntro } from '../../kit/waysProof.ts';
import { SAMPLE } from '../samples.ts';
import { CODE_SAYS, type SampleProofAsks } from './AccountModel.ts';
import {
  BREACHED_PASSWORD,
  type Device,
  DEVICES,
  linkedProviders,
  PROVIDER_ADDRESS,
  PROVIDER_NAME,
  PROVIDERS,
  RECOVERY_CODES,
  RECOVERY_LEFT,
  type SampleWays,
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
  'setupNoAuthenticator',
  'recovery',
  'newCodes',
  'turnOff',
  'signOutDevice',
  'everywhere',
  'forgot',
  'forgotSent',
  'factorFailed',
  'factorFailedLinked',
  'factorLoadingSignedOut',
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
/** Two-factor's status as the page has it: until it is ready, Security draws no card. */
export type Factor = 'ready' | 'loading' | 'failed';
/** The action that had just finished when the state opens, its line drawn alone while there is no card. */
export type Finished =
  { kind: 'linked'; provider: Provider } | { kind: 'signedOut'; device: string };

export interface SecurityStart {
  ways: SampleWays;
  twoFactor: boolean;
  codesLeft: number;
  rules: SecurityRules;
  opened: string | null;
  inView: string | null;
  ask: SecurityAsk | null;
  screen: SecurityScreen | null;
  proof: Proof | null;
  factor: Factor;
  finished: Finished | null;
  signedOut: readonly string[];
  /** Some app on the device opens otpauth:// links, so the setup step offers Add to my authenticator app. */
  takesLinks: boolean;
}

const ORG = SAMPLE.organisation;
const SIGNED_OUT = 'safari';
const CODE_WRONG_NOW =
  'That code did not work. Enter the code your app shows now, or an unused recovery code.';

/** The sample's ways in, as the product's page lists them. */
export function waysOf(sample: SampleWays): Ways {
  return {
    email: SAMPLE.email,
    password: sample.password,
    providers: PROVIDERS.map((provider) => ({
      provider,
      name: PROVIDER_NAME[provider],
      linked: sample[provider],
      address: PROVIDER_ADDRESS[provider],
    })),
  };
}

export function sampleDevice(device: Device, locale: string, t: TFunction): DeviceView {
  return {
    id: device.id,
    kind: device.kind,
    name: device.name,
    here: device.here,
    line:
      device.lastUsed == null
        ? t('security.thisDevice')
        : t('devices.lastUsed', { used: deviceMoment(device.lastUsed.toISOString(), locale, t) }),
    signedIn: t('devices.signedInFrom', {
      started: deviceMoment(device.signedIn.toISOString(), locale, t),
      ip: device.ip,
    }),
    expires: t('security.expires', { day: formatDay(device.expires.toISOString(), locale) }),
  };
}

/** What Confirm it's you asks for each proof, in the product's words: link and unlink are remembered for a while, the rest ask every time. */
export function proofAsks(
  proof: Proof,
  provider: Provider,
  ways: SampleWays,
  twoFactor: boolean,
  t: TFunction,
): SampleProofAsks {
  const codeOnly = proof === 'turnOff' || proof === 'newCodes';
  const first = linkedProviders(ways)[0];
  const instead = codeOnly || ways.password || first == null ? null : PROVIDER_NAME[first];
  const name = PROVIDER_NAME[provider];
  const lead = codeOnly
    ? t('twoFactorCard.offBody')
    : instead != null
      ? t('waysCard.proveWithProvider', { provider: instead })
      : proof === 'everywhere'
        ? t('devices.everywhereWhy')
        : proveIntro(t, proof === 'link' ? 'link' : 'unlink', name);

  return {
    lead,
    note:
      proof === 'link'
        ? t('waysCard.linkNote', { provider: name, email: SAMPLE.email })
        : undefined,
    password: !codeOnly && instead == null,
    code: instead == null && (codeOnly || twoFactor),
    codeHelp:
      proof === 'turnOff'
        ? t('twoFactorCard.offEmail', { email: SAMPLE.email })
        : proof === 'everywhere'
          ? t('devices.everywhereCodeHelp')
          : codeHelp(t, null),
    codeWrong: proof === 'link' || proof === 'unlink' ? CODE_SAYS.wrong : CODE_WRONG_NOW,
    instead,
  };
}

const BREACHED = 'This password has appeared in a known data breach. Choose another.';

/** What the sample's server says to a change the client let through. */
export function changeRefusal(current: string, next: string): Refused<'current' | 'next'> | null {
  if (current !== SAMPLE.password)
    return {
      field: 'current',
      message: 'That is not your current password. Try again, or reset it by email.',
    };
  if (next === current)
    return { field: 'next', message: 'That is already your password. Choose a different one.' };

  return next === BREACHED_PASSWORD ? { field: 'next', message: BREACHED } : null;
}

export function chooseRefusal(password: string): Refused<'password'> | null {
  return password === BREACHED_PASSWORD ? { field: 'password', message: BREACHED } : null;
}

export function emailedCodeRefusal(code: string): string | null {
  return cleanCode(code) === SAMPLE.code
    ? null
    : 'That code did not match. Check the newest email from Soirely and try again.';
}

export function setupRefusal(code: string): string | null {
  return cleanCode(code) === SAMPLE.authenticator
    ? null
    : 'That code does not match. Check the app was set up with the key above, then enter the code it shows now.';
}

/** Where each state starts: the sample's ways, two-factor and rules, and what is open over the page. */
export function securityStart(state: SecurityState): SecurityStart {
  const googleOnly =
    state === 'googleOnly' || state === 'setPassword' || state === 'setPasswordExpired';
  const picking = state === 'linkPick';
  const start: SecurityStart = {
    ways: { password: !googleOnly, google: !picking, apple: false },
    twoFactor: !googleOnly && state !== 'setup' && state !== 'setupNoAuthenticator',
    codesLeft: state === 'recovery' ? RECOVERY_CODES.length : RECOVERY_LEFT,
    rules: {
      providerOnly: state === 'keptByRule' || picking ? ORG : null,
      twoFactor: state === 'keptByRule' ? ORG : null,
    },
    opened: null,
    inView: null,
    ask: null,
    screen: null,
    proof: null,
    factor: 'ready',
    takesLinks: true,
    finished: null,
    signedOut: [],
  };

  switch (state) {
    case 'keptByRule':
      return { ...start, opened: 'google' };
    case 'changePassword':
      return { ...start, screen: 'change' };
    case 'setPassword':
    case 'setPasswordExpired':
      return { ...start, screen: state };
    case 'link':
      return { ...start, opened: 'apple', screen: 'confirm', proof: 'link' };
    case 'linkPick':
      return { ...start, inView: 'apple' };
    case 'unlink':
      return { ...start, opened: 'google', ask: 'unlink' };
    case 'setup':
      return { ...start, screen: 'setup' };
    case 'setupNoAuthenticator':
      return { ...start, screen: 'setup', takesLinks: false };
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
    case 'factorFailed':
      return { ...start, factor: 'failed' };
    case 'factorFailedLinked':
      return {
        ...start,
        ways: { ...start.ways, apple: true },
        factor: 'failed',
        finished: { kind: 'linked', provider: 'apple' },
      };
    case 'factorLoadingSignedOut':
      return {
        ...start,
        factor: 'loading',
        finished: { kind: 'signedOut', device: SIGNED_OUT },
        signedOut: [SIGNED_OUT],
      };
    default:
      return start;
  }
}

/** The finished action's done line, in the words the card would say it in. */
export function finishedLine(finished: Finished | null, t: TFunction): string | null {
  if (finished == null) return null;
  if (finished.kind === 'linked')
    return t('security.linkedDone', { provider: PROVIDER_NAME[finished.provider] });

  return t('devices.ended', {
    name: DEVICES.find((device) => device.id === finished.device)?.name ?? '',
  });
}
