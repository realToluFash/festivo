import { Platform } from 'react-native';

/** Tracked in by 2% of its size; not on Android, which measures tracked text a line short and drops the last word. */
export function stepTitle(size: number) {
  return Platform.OS === 'android' ? {} : { letterSpacing: size * -0.02 };
}
