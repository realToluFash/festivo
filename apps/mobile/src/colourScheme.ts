import type { Href } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { DESTINATION_HREF, destinationOf } from './kit/appNav.ts';
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

export type Reload = (reason: string) => Promise<void>;

// Loaded when it is needed: the API client imports this module, and expo's entry needs the app's runtime.
// Never the react-native namespace itself: copying it reads every getter, and PushNotificationIOS's throws in Expo Go.
// Expo's reload does nothing outside a ReactActivity, as in Expo Go on Android; a development bundle reloads through DevSettings everywhere.
export const reloadAppAsync: Reload = async (reason) => {
  if (__DEV__) {
    const { devReload } = await import('./devReload.ts');
    devReload(reason);
    return;
  }

  const expo = await import('expo');
  await expo.reloadAppAsync(reason);
};

/** A reload that took has ended this JS by now; one still running after it never restarted. */
export const RESTART_GRACE_MS = 2000;

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

export function schemeToFollow(choice: Choice, launchedIn: string): Scheme | null {
  const wanted = inUse(choice);

  return wanted === launchedIn ? null : wanted;
}

/** Kept on the device before the account is told, so the account never holds a scheme this device cannot show; false where the device cannot keep it. */
export function keepBeforeSaving(choice: Choice, launchedIn: string = schemeAtLaunch): boolean {
  const follow = schemeToFollow(choice, launchedIn);

  return follow == null || keepDeviceScheme(follow);
}

export function keepLaunchScheme(launchedIn: string = schemeAtLaunch): void {
  const scheme = schemeOf(launchedIn);
  if (scheme != null) keepDeviceScheme(scheme);
}

let restart: Promise<boolean> | null = null;

/** Keeps the scheme on the device and starts the JS again in it, which never answers; false, and nothing restarted, where the device cannot keep it or the reload never came. A restart asked for during another answers with that one. */
export function restartIn(
  scheme: Scheme,
  landing: string | null,
  reload: Reload = reloadAppAsync,
): Promise<boolean> {
  if (restart != null) return restart;
  if (!keepDeviceScheme(scheme)) return Promise.resolve(false);
  if (landing != null) holdLanding(landing);

  restart = (async () => {
    try {
      await reload(`colour scheme ${scheme}`);
      await new Promise((resolve) => setTimeout(resolve, RESTART_GRACE_MS));
    } catch {
      // Not restarted: below, as when the grace runs out.
    }

    restart = null;
    takeLanding();

    return false;
  })();

  return restart;
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

let here: string | null = null;

/** The screen the person is on, so a change heard back in the foreground restarts onto it rather than onto Today. */
export function noteWhere(path: string): void {
  here = path === '/' ? null : path;
}

/** The screens to open over Today after a restart: the landing, with its destination under it, so Back from the landing goes to that destination (sc-30441). */
export function landingAfterRestart(): Href[] {
  const path = takeLanding();
  if (path == null || !path.startsWith('/') || path === '/') return [];

  const pathname = path.split('?')[0] ?? path;
  const root = DESTINATION_HREF[destinationOf(pathname)];

  return root === '/' || pathname === root ? [path as Href] : [root, path as Href];
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
  if (follow != null) void restartIn(follow, here, reload);
  else if (deviceScheme() !== launchedIn) keepDeviceScheme(inUse(choice));
}

const ME = /\/api\/auth\/me(\?|$)/;

export function readsMe(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method =
    init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');

  return method.toUpperCase() === 'GET' && ME.test(url);
}

/** Every read of the person carries their colours, from whichever screen made it, so each is heard here rather than at every caller; cloned before the client reads the body. */
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
