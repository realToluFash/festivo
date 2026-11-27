import { AccessibilityInfo, Platform } from 'react-native';

let readerNow: boolean | null = null;

// Asked as the app loads, so a field can read the answer as it mounts (sc-92467).
if (Platform.OS === 'android') {
  void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
    readerNow = on;
  });
  AccessibilityInfo.addEventListener('screenReaderChanged', (on) => {
    readerNow = on;
  });
}

/** Whether a screen reader is on, on Android only, or null until the device has said. */
export function screenReaderNow(): boolean | null {
  return readerNow;
}
