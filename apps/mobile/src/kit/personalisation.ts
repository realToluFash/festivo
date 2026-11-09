import { ApiUnreachableError } from '@soirely/api-client';
import type { TFunction } from 'i18next';

import { defaultScheme, type Scheme } from '../theme/tokens.ts';
import { schemeNameKey } from './schemes.ts';

export const OWN: Scheme = defaultScheme;

/** The person's choice: null until they save one, and `violet` once they pick Violet. */
export type Choice = Scheme | null;

export function inUse(choice: Choice): Scheme {
  return choice ?? OWN;
}

export type Refusal = 'failed' | 'offline';

export type Phase = 'choosing' | 'saving' | Refusal;

export interface Colours {
  picked: Scheme;
  phase: Phase;
}

export type SaveAnswer = { saved: true; choice: Scheme } | { saved: false; refusal: Refusal };

/** Save waits until the pick differs from the colours in use, and while a save is out. */
export function saveOn({ picked, phase }: Colours, current: Scheme): boolean {
  return picked !== current && phase !== 'saving';
}

export function refusalOf(error: unknown): Refusal {
  return error instanceof ApiUnreachableError ? 'offline' : 'failed';
}

export function nameOf(t: TFunction, scheme: Scheme): string {
  return t(schemeNameKey(scheme));
}

export function cardSays(t: TFunction, scheme: Scheme): string {
  return t('personalisation.cardSays', { scheme: nameOf(t, scheme) });
}

/** The card's line: Saved with its mark just after a save, else whether the colours are a choice. */
export function cardLine(
  t: TFunction,
  choice: Choice,
  saved: boolean,
): { text: string; done: boolean } {
  if (saved) return { text: t('personalisation.saved'), done: true };

  return {
    text:
      choice == null
        ? t('personalisation.never')
        : t('personalisation.chosen', { own: nameOf(t, OWN) }),
    done: false,
  };
}

export function statusLine(t: TFunction, picked: Scheme, current: Scheme): string {
  return picked === current
    ? t('personalisation.inUse')
    : t('personalisation.notSavedYet', { scheme: nameOf(t, picked) });
}

export function notSavedLine(t: TFunction, refusal: Refusal, picked: Scheme, kept: Scheme): string {
  return t(refusal === 'offline' ? 'personalisation.notSavedOffline' : 'personalisation.notSaved', {
    picked: nameOf(t, picked),
    kept: nameOf(t, kept),
  });
}

export function swatchName(t: TFunction, scheme: Scheme, current: Scheme): string {
  return scheme === current
    ? t('personalisation.currentName', { scheme: nameOf(t, scheme) })
    : nameOf(t, scheme);
}
