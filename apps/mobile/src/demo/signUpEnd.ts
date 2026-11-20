import type { Href } from 'expo-router';

import { SAMPLE } from './samples.ts';

/** Where the sign-up's last step leaves the person: Home, or no organisation for a managed account (sc-563), its banner in place of Start your own, told it asked when it did. */
export type SignUpEnd = 'home' | 'none' | 'asked';

const ENDS: readonly SignUpEnd[] = ['home', 'none', 'asked'];

export function signUpEndOf(param: string | undefined): SignUpEnd {
  return ENDS.find((end) => end === param) ?? 'home';
}

export const ASKED = `Asked to join ${SAMPLE.organisation}. We’ll email you when they answer.`;

export function signUpLanding(end: SignUpEnd): Href {
  switch (end) {
    case 'none':
      return { pathname: '/demo/today', params: { orgs: 'none', state: 'managed' } };
    case 'asked':
      return { pathname: '/demo/today', params: { orgs: 'none', state: 'managed', toast: ASKED } };
    default:
      return '/demo/today';
  }
}

const MANAGED_STATES = ['managed', 'managedOffer'] as const;
export type ManagedState = (typeof MANAGED_STATES)[number];

export function managedStateOf(state: string | undefined): ManagedState | null {
  return MANAGED_STATES.find((known) => known === state) ?? null;
}

/** The organisation step for a managed address: the banner in the fields' place, no way to Account settings behind the onboarding gate, and how it ends. */
export function managedStep(state: ManagedState): {
  offer: boolean;
  way: false;
  action: string;
  end: SignUpEnd;
} {
  return state === 'managedOffer'
    ? { offer: true, way: false, action: `Ask to join ${SAMPLE.organisation}`, end: 'asked' }
    : { offer: false, way: false, action: 'Continue', end: 'none' };
}
