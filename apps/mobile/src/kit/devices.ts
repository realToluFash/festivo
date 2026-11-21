import type { DeviceSession } from '@soirely/api-client';
import {
  type AppDevice,
  appDevice,
  formatDay,
  formatTimeOfDay,
  readableAgent,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

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
