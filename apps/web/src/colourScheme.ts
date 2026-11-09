import type { TFunction } from 'i18next';
import { useSyncExternalStore } from 'react';

import { type Scheme, defaultScheme, schemeNames } from './scheme.ts';

export const SCHEME_KEY = 'soirely.colourScheme';
export const SCHEME_CHANNEL = 'soirely:colour-scheme';

export interface ColourScheme {
  shown: Scheme;
  /** The account's own pick: null has never chosen, undefined is not known yet. */
  chosen: Scheme | null | undefined;
}

let current: ColourScheme = { shown: defaultScheme, chosen: undefined };
let held: string | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

export function isScheme(value: unknown): value is Scheme {
  return schemeNames.some((name) => name === value);
}

export function schemeName(t: TFunction, scheme: Scheme): string {
  return t(`personalisation.scheme.${scheme}`);
}

export function nextScheme(scheme: Scheme, by: 1 | -1): Scheme {
  const at = schemeNames.indexOf(scheme);

  return schemeNames[(at + by + schemeNames.length) % schemeNames.length] ?? scheme;
}

export function keyStep(key: string): 1 | -1 | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 1;

  return key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : null;
}

export function storedScheme(): Scheme {
  try {
    const stored = localStorage.getItem(SCHEME_KEY);
    return isScheme(stored) ? stored : defaultScheme;
  } catch {
    return defaultScheme;
  }
}

function store(scheme: Scheme): void {
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    return;
  }
}

function paint(): void {
  document.documentElement.dataset.scheme = held ?? current.shown;
}

function set(next: ColourScheme): void {
  current = next;
  paint();
  listeners.forEach((listener) => listener());
}

/** Before the first paint: the scheme this browser last showed, and every other tab's saves from then on. */
export function startColourScheme(): void {
  set({ shown: storedScheme(), chosen: undefined });

  if (channel != null || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(SCHEME_CHANNEL);
  channel.onmessage = (message: MessageEvent<unknown>) => {
    if (isScheme(message.data)) followAccountScheme(message.data);
  };
}

/** The account's pick as /me or a save answered it; never chosen shows Violet. */
export function followAccountScheme(chosen: Scheme | null): void {
  const shown = chosen ?? defaultScheme;
  store(shown);
  set({ shown, chosen });
}

export function schemeIn(answer: unknown): Scheme | null {
  const scheme = (answer as { colourScheme?: unknown } | null)?.colourScheme;

  return isScheme(scheme) ? scheme : null;
}

/** Every answer from /me carries the account's pick, whichever screen asked. */
export function followMeAnswers(input: RequestInfo | URL, answer: Promise<Response>): void {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.endsWith('/api/auth/me')) return;

  answer
    .then((response) => (response.ok ? response.clone().json() : Promise.reject(response)))
    .then((body: unknown) => followAccountScheme(schemeIn(body)))
    .catch(() => undefined);
}

/** A save: this tab and every other open one take it at once. */
export function savedScheme(chosen: Scheme): void {
  followAccountScheme(chosen);
  channel?.postMessage(chosen);
}

/** Keeps the page in a scheme that is not the person's until the returned release. */
export function holdScheme(scheme: string): () => void {
  held = scheme;
  paint();

  return () => {
    held = null;
    paint();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useColourScheme(): ColourScheme {
  return useSyncExternalStore(subscribe, () => current);
}

export function __resetColourScheme(): void {
  channel?.close();
  channel = null;
  held = null;
  current = { shown: defaultScheme, chosen: undefined };
  delete document.documentElement.dataset.scheme;
}
