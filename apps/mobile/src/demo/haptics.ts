import * as Haptics from 'expo-haptics';

/** The taps the design asks for: success as a code goes green, a warning as one shakes. A device without them stays silent. */
export const tap = {
  done: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  wrong: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};
