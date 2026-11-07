import i18next, { type i18n } from 'i18next';

import { WALK } from './CreateWalk.ts';

const forks = new Map<string, i18n>();

/** The app's words with pm's "Start your first event" on the empty Today's button, for the demo alone: one copy per language, as changing a copy's language while it draws updates the screens that read it. */
export function startFirstWords(language: string): i18n {
  const known = forks.get(language);
  if (known != null) return known;

  const fork = i18next.cloneInstance({ forkResourceStore: true, lng: language });
  const english = fork.store.data.en?.translation;
  if (english != null && typeof english === 'object') {
    const today = (english as Record<string, unknown>).todayScreen;
    (english as Record<string, unknown>).todayScreen = {
      ...(typeof today === 'object' ? today : {}),
      createEvent: WALK.startFirst,
    };
  }
  forks.set(language, fork);

  return fork;
}
