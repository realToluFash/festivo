import { createInstance } from 'i18next';
import { useSyncExternalStore } from 'react';

import en from '../../i18n/locales/en.json';
import * as kit from '../../kit/personalisation.ts';
import type { Choice, Phase, Refusal, SaveAnswer } from '../../kit/personalisation.ts';
import { OWN } from '../../kit/personalisation.ts';
import type { Scheme } from '../../theme/tokens.ts';

export {
  type Choice,
  type Colours,
  inUse,
  OWN,
  type Phase,
  type Refusal,
  type SaveAnswer,
  saveOn,
} from '../../kit/personalisation.ts';
export { schemeOf } from '../../kit/schemes.ts';

export const PERSONALISATION_TITLE = 'Personalisation';

/** The starting states a link can open: /demo/settings/personalisation?state=picked. */
export const PERSONALISATION_STATES = [
  'chosen',
  'colours',
  'picked',
  'saving',
  'saved',
  'saveFailed',
  'offline',
  'loading',
  'failed',
] as const;

export type PersonalisationState = (typeof PERSONALISATION_STATES)[number];

export function personalisationStateOf(name: string | undefined): PersonalisationState | null {
  return PERSONALISATION_STATES.find((state) => state === name) ?? null;
}

/** The demo is in English: the app's own words, from its catalogue. */
const english = createInstance();
void english.init({
  lng: 'en',
  resources: { en: { translation: en } },
  initAsync: false,
  interpolation: { escapeValue: false },
});
const { t } = english;
const words = en.personalisation;

export const WORDS = {
  listLine: en.settings.personalisationLine,
  never: words.never,
  chosen: t('personalisation.chosen', { own: kit.nameOf(t, OWN) }),
  saved: words.saved,
  choose: words.choose,
  follows: words.follows,
  keeps: words.keeps,
  colours: words.colours,
  lead: words.lead,
  inUse: words.inUse,
  restart: words.restart,
  current: words.current,
  save: words.save,
  saving: words.saving,
  tryAgain: words.tryAgain,
  notLoaded: words.notLoaded,
  notLoadedLine: words.notLoadedLine,
  loading: words.loading,
} as const;

export const nameOf = (scheme: Scheme): string => kit.nameOf(t, scheme);

export const cardSays = (scheme: Scheme): string => kit.cardSays(t, scheme);

export const cardLine = (choice: Choice, saved: boolean) => kit.cardLine(t, choice, saved);

export const statusLine = (picked: Scheme, current: Scheme): string =>
  kit.statusLine(t, picked, current);

export const notSavedLine = (refusal: Refusal, picked: Scheme, kept: Scheme): string =>
  kit.notSavedLine(t, refusal, picked, kept);

export const swatchName = (scheme: Scheme, current: Scheme): string =>
  kit.swatchName(t, scheme, current);

/** What the demo says in the app's place: it cannot restart its screens, as its colours are fixed when it is built. */
export function restartTold(scheme: Scheme): string {
  return `Soirely restarts its screens in ${nameOf(scheme)} here. The demo cannot, so only the card and the tile change.`;
}

export interface PersonalisationStart {
  choice: Choice;
  load: 'loading' | 'failed' | 'loaded';
  colours: Colours | null;
  saved: boolean;
}

/** Each state as the boards draw it: the person has never chosen, and picks Garden; with no state, what this visit holds. */
export function personalisationStart(
  state: PersonalisationState | null,
  held: Choice,
): PersonalisationStart {
  const page = { choice: null, load: 'loaded', colours: null, saved: false } as const;
  const garden = (phase: Phase) => ({ ...page, colours: { picked: 'garden', phase } }) as const;

  switch (state) {
    case null:
      return { ...page, choice: held };
    case 'chosen':
      return { ...page, choice: 'garden' };
    case 'saved':
      return { ...page, choice: 'garden', saved: true };
    case 'colours':
      return { ...page, colours: { picked: OWN, phase: 'choosing' } };
    case 'picked':
      return garden('choosing');
    case 'saving':
      return garden('saving');
    case 'saveFailed':
      return garden('failed');
    case 'offline':
      return garden('offline');
    case 'loading':
    case 'failed':
      return { ...page, choice: held, load: state };
  }
}

export interface ColoursClient {
  read: () => Promise<Choice>;
  save: (scheme: Scheme) => Promise<SaveAnswer>;
}

export const SAVE_MS = 500;
export const LOADING_MS = 8000;
export const RETRY_MS = 1500;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The account in the demo, which sends nothing: a failed or an offline state refuses every save, as Notifications' refuses its switch. */
export function sampleClient(
  state: PersonalisationState | null,
  held: Choice,
  wait: (ms: number) => Promise<void> = pause,
): ColoursClient {
  let reads = 0;
  let saves = 0;

  return {
    async read() {
      reads += 1;
      await wait(state === 'loading' && reads === 1 ? LOADING_MS : RETRY_MS);

      return held;
    },
    async save(scheme) {
      saves += 1;
      await wait(state === 'saving' && saves === 1 ? LOADING_MS : SAVE_MS);
      if (state === 'saveFailed') return { saved: false, refusal: 'failed' };
      if (state === 'offline') return { saved: false, refusal: 'offline' };

      return { saved: true, choice: scheme };
    },
  };
}

/** The person's colours for this visit to the demo, in memory alone: the Settings list's tile and the page share them. */
const store = { choice: null as Choice, listeners: new Set<() => void>() };

export function heldChoice(): Choice {
  return store.choice;
}

export function holdChoice(choice: Choice): void {
  if (store.choice === choice) return;
  store.choice = choice;
  store.listeners.forEach((listener) => listener());
}

export function hearChoice(listener: () => void): () => void {
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

export function useHeldChoice(): Choice {
  return useSyncExternalStore(hearChoice, heldChoice, heldChoice);
}
