import { writtenTime } from '../clock.ts';
import { SAMPLE } from '../samples.ts';
import { IPS } from './sample.ts';

export type Provider = 'Google' | 'Apple';

export interface Ways {
  password: boolean;
  Google: boolean;
  Apple: boolean;
}

export const PROVIDERS: readonly Provider[] = ['Google', 'Apple'];

/** The address each provider signs in as; Apple can hide it, so it has none. */
export const PROVIDER_ADDRESS: Record<Provider, string | null> = {
  Google: 'folake.adeyemi@gmail.com',
  Apple: null,
};

export const PROOF_MINUTES = 5;

export function linkedProviders(ways: Ways): Provider[] {
  return PROVIDERS.filter((provider) => ways[provider]);
}

/** Long enough, and the server finds it in a known breach. */
export const BREACHED_PASSWORD = '1q2w3e4r5t6y7u8i9o0p';

/** The authenticator key, in base32 as an app takes it. */
export const AUTHENTICATOR_KEY = 'KZ4TQ7MB2XRAH5VN6JDWP3YCLFREGSUZ';

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

/** How many of the ten are still unused at rest. */
export const RECOVERY_LEFT = 8;

export type DeviceKind = 'device' | 'laptop' | 'tablet';

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  here: boolean;
  signedIn: Date;
  /** Null while it is the device in use now. */
  lastUsed: Date | null;
  expires: Date;
  ip: string;
}

export const DEVICES: readonly Device[] = [
  {
    id: 'iphone',
    kind: 'device',
    name: 'Soirely app on iPhone',
    here: true,
    signedIn: new Date(2026, 9, 12, 9, 14),
    lastUsed: null,
    expires: new Date(2026, 11, 4),
    ip: IPS[0] ?? '',
  },
  {
    id: 'safari',
    kind: 'laptop',
    name: 'Safari on macOS',
    here: false,
    signedIn: new Date(2026, 9, 28, 16, 2),
    lastUsed: new Date(2026, 10, 3, 18, 40),
    expires: new Date(2026, 11, 3),
    ip: IPS[1] ?? '',
  },
  {
    id: 'ipad',
    kind: 'tablet',
    name: 'Soirely app on iPad',
    here: false,
    signedIn: new Date(2026, 8, 30, 11, 20),
    lastUsed: new Date(2026, 10, 1, 14, 15),
    expires: new Date(2026, 11, 1),
    ip: IPS[2] ?? '',
  },
];

/** "Oct 12" in en-US, "12 Oct" in en-GB: English in the device's region. */
export function dayOf(when: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(when);
}

export function dayAtTime(when: Date, locale: string): string {
  return `${dayOf(when, locale)} at ${writtenTime(when, locale)}`;
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
