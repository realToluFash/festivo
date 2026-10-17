import { type DeviceSession, proofRefusal } from '@soirely/api-client';
import { formatDay, formatTimeOfDay, readableAgent } from '@soirely/domain';
import { type TFunction } from 'i18next';

export type EverywhereRefusal =
  | { kind: 'field'; field: 'password' | 'code'; message: string }
  | { kind: 'limited'; until: Date | null }
  | { kind: 'failed'; message: string };

/** As the device described itself; a string Soirely cannot read is shown as it came (sc-55). */
export function deviceName(device: DeviceSession, t: TFunction): string {
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
