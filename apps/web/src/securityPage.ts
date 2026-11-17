import { type DeviceSession, type LinkedProvider, type Provider } from '@soirely/api-client';
import {
  type AppDevice,
  appDevice,
  formatDay,
  formatTimeOfDay,
  readableAgent,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

import { type GlyphName } from './components/Glyph.tsx';
import { PROVIDER_NAMES } from './providerSignIn.ts';

export interface WayIn {
  provider: Provider;
  name: string;
  linked: boolean;
  address: string | null;
}

export interface Ways {
  password: boolean;
  providers: readonly WayIn[];
}

/** The organisation whose rule holds each thing in place, or null where no rule does. */
export interface SecurityRules {
  providerOnly: string | null;
  twoFactor: string | null;
}

export interface AskWords {
  title: string;
  line: string;
  keep: string;
  confirm: string;
  removes: boolean;
}

const PROVIDERS: readonly Provider[] = ['google', 'apple'];

export function waysOf(hasPassword: boolean, linkedOnes: readonly LinkedProvider[]): Ways {
  return {
    password: hasPassword,
    providers: PROVIDERS.map((provider) => {
      const mine = linkedOnes.find((one) => one.provider === provider);

      return {
        provider,
        name: PROVIDER_NAMES[provider],
        linked: mine != null,
        address: mine?.email ?? null,
      };
    }),
  };
}

export function linked(ways: Ways): WayIn[] {
  return ways.providers.filter((way) => way.linked);
}

export function rulesOf(
  organisations: readonly {
    name: string;
    signInRules: { providerOnly: boolean; everyoneNeedsTwoFactor: boolean };
  }[],
): SecurityRules {
  return {
    providerOnly: organisations.find((one) => one.signInRules.providerOnly)?.name ?? null,
    twoFactor: organisations.find((one) => one.signInRules.everyoneNeedsTwoFactor)?.name ?? null,
  };
}

/** "2 ways to sign in · 3 devices"; the devices drop out until they are listed. */
export function cardCounts(ways: Ways, devices: number | null, t: TFunction): string {
  const count = (ways.password ? 1 : 0) + linked(ways).length;
  const signIn = t('security.ways', { count });

  return devices == null ? signIn : `${signIn} · ${t('devices.count', { count: devices })}`;
}

/** What just happened until you leave the page; while two-factor is off, why it matters. */
export function cardLine(
  said: string | null,
  on: boolean,
  t: TFunction,
): { text: string; done: boolean } | null {
  if (said != null) return { text: said, done: true };

  return on ? null : { text: t('security.why'), done: false };
}

export function passwordLine(ways: Ways, t: TFunction): string {
  return ways.password ? t('security.passwordSet') : t('waysCard.notSetUp');
}

export function providerLine(way: WayIn, t: TFunction): string {
  if (!way.linked) return t('waysCard.notLinked');

  return way.address == null
    ? t('waysCard.linked')
    : t('security.linkedAs', { address: way.address });
}

/** No password and one provider: that provider is the way in, and it does not open. */
export function lastWayIn(ways: Ways): WayIn | null {
  const on = linked(ways);

  return !ways.password && on.length === 1 ? (on[0] ?? null) : null;
}

/** A Google-or-Apple rule keeps the last provider linked, password or not. */
export function keptByRule(ways: Ways, way: WayIn, rules: SecurityRules): boolean {
  return rules.providerOnly != null && way.linked && linked(ways).length === 1;
}

function otherOf(ways: Ways, way: WayIn): WayIn | undefined {
  return ways.providers.find((each) => each.provider !== way.provider);
}

export function unlinkNote(ways: Ways, way: WayIn, t: TFunction): string {
  const other = otherOf(ways, way);
  const still = ways.password
    ? t('waysCard.stillPassword')
    : t('waysCard.stillProvider', { provider: other?.name ?? '' });

  return `${t('security.unlinkNote', { provider: way.name })} ${still}`;
}

export function keptNote(ways: Ways, way: WayIn, organisation: string, t: TFunction): string {
  return `${t('waysCard.keptByRule', { organisation })} ${t('waysCard.keptByRuleNext', {
    provider: way.name,
    other: otherOf(ways, way)?.name ?? '',
  })}`;
}

export function unlinkAsk(way: WayIn, ways: Ways, t: TFunction): AskWords {
  const cannot =
    way.address == null
      ? t('waysCard.confirmBodyPlain', { provider: way.name })
      : t('waysCard.confirmBody', { provider: way.name, address: way.address });

  return {
    title: t('waysCard.confirmTitle', { provider: way.name }),
    line: `${cannot} ${unlinkNote(ways, way, t)}`,
    keep: t('waysCard.keep'),
    confirm: t('waysCard.confirmUnlink', { provider: way.name }),
    removes: true,
  };
}

export function turnOffAsk(email: string, t: TFunction): AskWords {
  return {
    title: t('security.turnOffTitle'),
    line: t('security.turnOffNote', { email }),
    keep: t('twoFactorCard.keepItOn'),
    confirm: t('twoFactorCard.turnItOff'),
    removes: true,
  };
}

export function newCodesAsk(t: TFunction): AskWords {
  return {
    title: t('twoFactorCard.newTitle'),
    line: t('twoFactorCard.newWarningBody'),
    keep: t('twoFactorCard.keepCodes'),
    confirm: t('twoFactorCard.makeNewCodes'),
    removes: false,
  };
}

export function signOutAsk(name: string, t: TFunction): AskWords {
  return {
    title: t('devices.checkTitle', { name }),
    line: `${t('security.signOutLine')} ${t('devices.passwordAdvice')}`,
    keep: t('devices.keep'),
    confirm: t('devices.end'),
    removes: true,
  };
}

/** With this device unknown to the server, every listed device goes, this one too. */
export function everywhereAsk(count: number, keepsHere: boolean, t: TFunction): AskWords {
  return {
    title: t('devices.everywhereTitle'),
    line: keepsHere
      ? t('security.everywhereLine', { count })
      : t('devices.everywhereSelf', { count }),
    keep: t('devices.everywhereKeep', { count }),
    confirm: keepsHere
      ? t('devices.everywhereConfirm', { count })
      : t('devices.everywhereConfirmAll', { count }),
    removes: true,
  };
}

export function everywhereDone(signedOut: number, t: TFunction): string {
  return signedOut === 0
    ? t('devices.everywhereNone')
    : t('devices.everywhereDone', { count: signedOut });
}

const APP_NAMES = {
  iPhone: 'devices.appIPhone',
  iPad: 'devices.appIPad',
  phone: 'devices.appAndroidPhone',
  tablet: 'devices.appAndroidTablet',
} as const satisfies Record<AppDevice, string>;

/** A device as it described itself when it signed in. */
export function deviceName(device: DeviceSession, t: TFunction): string {
  const app = appDevice(device.userAgent);
  if (app != null) return t(APP_NAMES[app]);
  const parts = readableAgent(device.userAgent);
  if (parts != null)
    return t('devices.agent', { browser: parts.browser, platform: parts.platform });

  return device.userAgent ?? t('devices.unknownDevice');
}

/** The row's mark: a phone for the app on a phone, a tablet for one on a tablet, a laptop for a browser. */
export function deviceLead(device: DeviceSession): GlyphName {
  const app = appDevice(device.userAgent);
  if (app === 'iPad' || app === 'tablet') return 'tablet';

  return app == null ? 'laptop' : 'device';
}

export function dayAtTime(iso: string, locale: string, t: TFunction): string {
  return t('devices.dayAtTime', {
    day: formatDay(iso, locale),
    time: formatTimeOfDay(iso, locale),
  });
}

export function deviceLine(device: DeviceSession, locale: string, t: TFunction): string {
  return device.thisDevice
    ? t('security.thisDevice')
    : t('devices.lastUsed', { used: dayAtTime(device.renewedAt, locale, t) });
}
