import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** The taps the design asks for: success as a code goes green, a light tap as sign-in succeeds, a warning as one shakes. Android's own haptics, unlike its vibrator, stay off when the system's are, as iOS's do. */
export const tap = {
  light: () => {
    (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    ).catch(() => undefined);
  },
  done: () => {
    (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    ).catch(() => undefined);
  },
  wrong: () => {
    (Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    ).catch(() => undefined);
  },
};
