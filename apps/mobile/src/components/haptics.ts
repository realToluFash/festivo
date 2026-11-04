import * as Haptics from 'expo-haptics';

/** The taps the design asks for: success as a code goes green, a light tap as sign-in succeeds, a warning as a code shakes. A device without them stays silent. */
export const tap = {
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  done: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  wrong: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};
