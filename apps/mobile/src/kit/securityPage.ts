import { ApiError, type Provider } from '@soirely/api-client';
import type { TFunction } from 'i18next';

export interface WayIn {
  provider: Provider;
  name: string;
  linked: boolean;
  address: string | null;
}

export interface Ways {
  /** The primary address, which a linked provider's needn't match. */
  email: string;
  password: boolean;
  providers: readonly WayIn[];
}

/** The organisation whose rule holds each thing in place, or null where no rule does. */
export interface SecurityRules {
  providerOnly: string | null;
  twoFactor: string | null;
}

export type SecurityLine = { kind: 'done' | 'todo'; text: string } | null;

export type DeviceKind = 'device' | 'laptop' | 'tablet';

export interface DeviceView {
  id: string;
  kind: DeviceKind;
  name: string;
  here: boolean;
  line: string;
  signedIn: string;
  expires: string;
}

export interface AskWords {
  title: string;
  line: string;
  keep: string;
  confirm: string;
  removes: boolean;
}

export function linked(ways: Ways): WayIn[] {
  return ways.providers.filter((way) => way.linked);
}

export function cardSays(on: boolean, t: TFunction): string {
  return on ? t('security.on') : t('security.off');
}

/** "2 ways to sign in · 3 devices"; the devices drop out until they are listed. */
export function cardCounts(ways: Ways, devices: number | null, t: TFunction): string {
  const count = (ways.password ? 1 : 0) + linked(ways).length;
  const signIn = t('security.ways', { count });

  return devices == null ? signIn : `${signIn} · ${t('devices.count', { count: devices })}`;
}

/** What just happened until you leave the page; while two-factor is off, why it matters. */
export function cardLine(said: string | null, on: boolean, t: TFunction): SecurityLine {
  if (said != null) return { kind: 'done', text: said };

  return on ? null : { kind: 'todo', text: t('security.why') };
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

export function waysFoot(ways: Ways, t: TFunction): string | undefined {
  const last = lastWayIn(ways);

  return last == null ? undefined : t('waysCard.last', { provider: last.name });
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

export function codesLine(left: number, t: TFunction): string {
  return t('twoFactorCard.unused', { left, total: 10 });
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

export type EverywhereOutcome =
  | { kind: 'endedHere' }
  | { kind: 'done'; words: string }
  | { kind: 'failed'; message: string; refused: boolean };

/** Signs out every other device; a failure is an outcome, so the sheet that sent it stays usable. */
export async function signOutOthers(
  send: () => Promise<{ signedOut: number; thisDevice: boolean }>,
  t: TFunction,
): Promise<EverywhereOutcome> {
  try {
    const { signedOut, thisDevice } = await send();

    return thisDevice
      ? { kind: 'endedHere' }
      : { kind: 'done', words: everywhereDone(signedOut, t) };
  } catch (refusal) {
    return {
      kind: 'failed',
      message: t('devices.everywhereFailedBody'),
      refused: refusal instanceof ApiError,
    };
  }
}

export function askBusy(ask: string | null, t: TFunction): string | undefined {
  if (ask === 'unlink') return t('security.unlinking');
  if (ask === 'signOut') return t('security.signingOut');

  return undefined;
}
