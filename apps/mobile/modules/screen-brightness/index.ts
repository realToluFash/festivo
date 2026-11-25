import { requireOptionalNativeModule } from 'expo';

interface ScreenBrightness {
  raise(): Promise<void>;
  restore(): Promise<void>;
}

/** Absent from a build made before it was added. */
export const screenBrightness = requireOptionalNativeModule<ScreenBrightness>('ScreenBrightness');
