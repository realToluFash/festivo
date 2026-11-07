import { useSyncExternalStore } from 'react';

import type { Scheme } from '../../theme/tokens.ts';
import { lookOf, SCHEME_ORDER } from './PersonalisationSchemes.ts';

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

export function schemeOf(name: string | undefined): Scheme | null {
  return SCHEME_ORDER.find((scheme) => scheme === name) ?? null;
}

export const OWN: Scheme = 'violet';

/** The person's choice: null until they save one, and `violet` once they pick Violet. */
export type Choice = Scheme | null;

export function inUse(choice: Choice): Scheme {
  return choice ?? OWN;
}

export type Refusal = 'failed' | 'offline';

export const WORDS = {
  listLine: 'Your colours, for every screen',
  never: 'Soirely’s own colours, until you choose others.',
  chosen: 'Your choice. Violet is Soirely’s own.',
  saved: 'Saved. Every screen is in your colours now.',
  choose: 'Choose colours',
  follows: 'Your colours follow you on every device you sign in on. Only you see them.',
  keeps: 'Event covers, emails, messages and guests’ pages keep their own colours.',
  colours: 'Colours',
  lead: 'Pick the colours Soirely shows you.',
  inUse: 'In use now. Pick another to see it here.',
  restart: 'Saving restarts Soirely’s screens to put your colours on, then brings you back here.',
  current: 'Current',
  save: 'Save',
  saving: 'Saving…',
  tryAgain: 'Try again',
  notLoaded: 'Your colours did not load.',
  notLoadedLine: 'Check your connection and try again.',
  loading: 'Loading…',
} as const;

export const nameOf = (scheme: Scheme): string => lookOf(scheme).name;

export function cardSays(scheme: Scheme): string {
  return `You see Soirely in ${nameOf(scheme)}`;
}

/** The card's line: Saved with its mark just after a save, else whether the colours are a choice. */
export function cardLine(choice: Choice, saved: boolean): { text: string; done: boolean } {
  if (saved) return { text: WORDS.saved, done: true };

  return { text: choice == null ? WORDS.never : WORDS.chosen, done: false };
}

export function statusLine(picked: Scheme, current: Scheme): string {
  return picked === current
    ? WORDS.inUse
    : `Not saved yet. Save puts ${nameOf(picked)} on every screen.`;
}

export function notSavedLine(refusal: Refusal, picked: Scheme, kept: Scheme): string {
  const because = refusal === 'offline' ? ' because you are offline' : '';

  return `${nameOf(picked)} was not saved${because}. Your colours stay ${nameOf(kept)}.`;
}

export function swatchName(scheme: Scheme, current: Scheme): string {
  return scheme === current ? `${nameOf(scheme)}, current` : nameOf(scheme);
}

/** What the demo says in the app's place: it cannot restart its screens, as its colours are fixed when it is built. */
export function restartTold(scheme: Scheme): string {
  return `Soirely restarts its screens in ${nameOf(scheme)} here. The demo cannot, so only the card and the tile change.`;
}

export type Phase = 'choosing' | 'saving' | Refusal;

export interface Colours {
  picked: Scheme;
  phase: Phase;
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

/** Save waits until the pick differs from the colours in use, and while a save is out. */
export function saveOn({ picked, phase }: Colours, current: Scheme): boolean {
  return picked !== current && phase !== 'saving';
}

export type SaveAnswer = { saved: true; choice: Scheme } | { saved: false; refusal: Refusal };

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
