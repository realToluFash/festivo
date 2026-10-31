import { type DeviceSession, proofRefusal } from '@soirely/api-client';
import {
  type AppDevice,
  appDevice,
  formatDay,
  formatTimeOfDay,
  readableAgent,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

export type EverywhereRefusal =
  | { kind: 'field'; field: 'password' | 'code'; message: string }
  | { kind: 'limited'; until: Date | null }
  | { kind: 'failed'; message: string };

const APP_NAMES = {
  iPhone: 'devices.appIPhone',
  iPad: 'devices.appIPad',
  phone: 'devices.appAndroidPhone',
  tablet: 'devices.appAndroidTablet',
} as const satisfies Record<AppDevice, string>;

/** As the device described itself; a string Soirely cannot read is shown as it came (sc-55). */
export function deviceName(device: DeviceSession, t: TFunction): string {
  const app = appDevice(device.userAgent);

  if (app != null) return t(APP_NAMES[app]);

  const parts = readableAgent(device.userAgent);

  if (parts != null)
    return t('devices.agent', { browser: parts.browser, platform: parts.platform });

  return device.userAgent ?? t('devices.unknownDevice');
}

export function deviceMoment(iso: string, locale: string, t: TFunction): string {
  return t('devices.dayAtTime', {
    day: formatDay(iso, locale),
    time: formatTimeOfDay(iso, locale),
  });
}

/** The devices card's words for what `/proof` refused, as the web's card says them. */
export function everywhereRefusal(
  error: unknown,
  viaProvider: boolean,
  t: TFunction,
): EverywhereRefusal {
  const refusal = proofRefusal(error, !viaProvider);

  if (refusal.kind === 'limited') return refusal;
  if (refusal.kind === 'field')
    return {
      ...refusal,
      message:
        refusal.field === 'password'
          ? t('devices.everywherePasswordWrong')
          : t('devices.everywhereCodeWrong'),
    };

  return { kind: 'failed', message: t('devices.everywhereFailedBody') };
}

/** How long until a limited refusal lifts, or null when nothing says when. */
export function liftsIn(refusal: EverywhereRefusal | null, now: number): number | null {
  if (refusal?.kind !== 'limited' || refusal.until == null) return null;

  return Math.max(0, refusal.until.getTime() - now);
}

export type EverywhereButton =
  | { kind: 'provider'; label: string; off: boolean }
  | { kind: 'primary'; label: string; off: boolean };

/** Google's or Apple's own button until the code step, the primary from there or beside a password. */
export function everywhereButton(
  step: {
    providerName: string | null;
    confirmed: boolean;
    codeAsked: boolean;
    working: boolean;
    refusal: EverywhereRefusal | null;
    until: string | null;
    keepsThisDevice: boolean;
    count: number;
  },
  t: TFunction,
): EverywhereButton {
  const off = step.refusal?.kind === 'limited';

  if (step.providerName != null && !(step.confirmed && step.codeAsked))
    return {
      kind: 'provider',
      label: t('devices.everywhereContinueWith', { provider: step.providerName }),
      off,
    };

  return {
    kind: 'primary',
    label: off
      ? step.until == null
        ? t('devices.everywhereRetrySoon')
        : t('devices.everywhereRetryAt', { time: step.until })
      : step.working
        ? t('devices.everywhereWorking')
        : step.keepsThisDevice
          ? t('devices.everywhereConfirm', { count: step.count })
          : t('devices.everywhereConfirmAll', { count: step.count }),
    off,
  };
}
