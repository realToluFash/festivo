import i18next, { type i18n } from 'i18next';

import { WALK } from './CreateWalk.ts';

let words: i18n | null = null;

/** The app's words with pm's "Start your first event" on the empty Today's button, for the demo alone. */
export function startFirstWords(language: string): i18n {
  if (words != null) {
    if (words.language !== language) void words.changeLanguage(language);

    return words;
  }
  const fork = i18next.cloneInstance({ forkResourceStore: true });
  const english = fork.store.data.en?.translation;
  if (english != null && typeof english === 'object') {
    const today = (english as Record<string, unknown>).todayScreen;
    (english as Record<string, unknown>).todayScreen = {
      ...(typeof today === 'object' ? today : {}),
      createEvent: WALK.startFirst,
    };
  }
  words = fork;

  return fork;
}
