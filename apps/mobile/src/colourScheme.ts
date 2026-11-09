import type { Href } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { type Choice, inUse } from './kit/personalisation.ts';
import { schemeOf } from './kit/schemes.ts';
import {
  deviceScheme,
  forgetDeviceScheme,
  holdLanding,
  keepDeviceScheme,
  takeLanding,
} from './theme/deviceScheme.ts';
import { type Scheme, schemeAtLaunch } from './theme/tokens.ts';

export const PERSONALISATION_LANDING = '/settings/personalisation?saved=1' satisfies Href;

type Reload = (reason: string) => Promise<void>;

// Loaded when it is needed: the API client imports this module, and expo's entry needs the app's runtime.
const reloadAppAsync: Reload = (reason) =>
  import('expo').then((expo) => expo.reloadAppAsync(reason));

/** Undefined until the account has been read on this launch. */
let heard: Choice | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function heardChoice(): Choice | undefined {
  return heard;
}

export function useAccountChoice(): Choice | undefined {
  return useSyncExternalStore(subscribe, heardChoice, heardChoice);
}

export function holdChoice(choice: Choice): void {
  if (heard === choice) return;
  heard = choice;
  for (const listener of listeners) listener();
}

/** The scheme to restart into, or null when the screens are already in the account's colours. */
export function schemeToFollow(choice: Choice, launchedIn: string): Scheme | null {
  const wanted = inUse(choice);

  return wanted === launchedIn ? null : wanted;
}

let restarting = false;

/** Keeps the scheme on the device and starts the JS again in it; false, and nothing restarted, where the device cannot keep it. */
export async function restartIn(
  scheme: Scheme,
  landing: string | null,
  reload: Reload = reloadAppAsync,
): Promise<boolean> {
  if (restarting) return true;
  if (!keepDeviceScheme(scheme)) return false;
  if (landing != null) holdLanding(landing);
  restarting = true;

  try {
    await reload(`colour scheme ${scheme}`);

    return true;
  } catch {
    restarting = false;
    takeLanding();

    return false;
  }
}

/** On an install's first launch, the colours kept from before an uninstall are forgotten, and the JS starts again in the default where it opened in them. */
export async function forgetOnNewInstall(
  newInstall: boolean,
  openedIn: string | null | undefined = globalThis.soirelyDeviceScheme,
  reload: Reload = reloadAppAsync,
): Promise<void> {
  if (!newInstall || openedIn == null || !forgetDeviceScheme()) return;

  await reload('new install').catch(() => {});
}

/** Where a restart into new colours asked to come back to, once; only a landing this module holds. */
export function landingAfterRestart(): Href | null {
  return takeLanding() === PERSONALISATION_LANDING ? PERSONALISATION_LANDING : null;
}

/** What the account answered, at launch or back in the foreground: kept on the device, and followed where the screens are in other colours. */
export function hearChoice(
  value: unknown,
  launchedIn: string = schemeAtLaunch,
  reload: Reload = reloadAppAsync,
): void {
  const choice = value === null ? null : schemeOf(value);
  if (value !== null && choice == null) return;

  holdChoice(choice);
  const follow = schemeToFollow(choice, launchedIn);
  if (follow != null) void restartIn(follow, null, reload);
  else if (deviceScheme() !== launchedIn) keepDeviceScheme(inUse(choice));
}

const ME = /\/api\/auth\/me(\?|$)/;

export function readsMe(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method =
    init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');

  return method.toUpperCase() === 'GET' && ME.test(url);
}

/** Every read of the person carries their colours, which the client's Account leaves out; cloned before the client reads the body. */
export function heardFrom(response: Response): Response {
  if (!response.ok) return response;

  void response
    .clone()
    .json()
    .then((body: unknown) => {
      if (body != null && typeof body === 'object' && 'colourScheme' in body)
        hearChoice(body.colourScheme);
    })
    .catch(() => {});

  return response;
}
