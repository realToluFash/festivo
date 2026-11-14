import { appUserAgent } from '@soirely/domain';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** Built once: none of its parts changes while the app runs. An Android device that reports no class is a phone (sc-1242). */
export const appAgent = appUserAgent({
  version: Constants.expoConfig?.version ?? '0.0.0',
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  osName: Device.osName,
  osVersion: Device.osVersion ?? String(Platform.Version),
  tablet: Device.deviceType === Device.DeviceType.TABLET,
});
