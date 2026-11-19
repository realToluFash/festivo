import { SAMPLE } from '../samples.ts';
import { OKTA } from './SingleSignOnModel.ts';
import { SSO_DOMAIN } from './SingleSignOnWords.ts';

export const SIGN_IN_SSO_STATES = ['sso_handoff', 'sso_required'] as const;

export type SignInSsoState = (typeof SIGN_IN_SSO_STATES)[number];

export function signInSsoOf(state: string | undefined): SignInSsoState | null {
  return SIGN_IN_SSO_STATES.find((one) => one === state) ?? null;
}

export const SSO_PROVIDER = OKTA.name;

export const SSO_OWNERS: readonly string[] = [SAMPLE.email];

export const SSO_MEMBER = 'priya@ire.events';

/** How an address signs in: its password, handed to the provider, refused anything else, or an owner's own way past it. */
export type SsoWay = 'password' | 'handoff' | 'required' | 'breakGlass';

export function atSsoDomain(email: string): boolean {
  const [name, domain, ...rest] = email.trim().toLowerCase().split('@');

  return rest.length === 0 && name != null && name !== '' && domain === SSO_DOMAIN;
}

export function ssoWayFor(
  state: SignInSsoState | null,
  email: string,
  anotherWay: boolean,
): SsoWay {
  if (state == null || !atSsoDomain(email)) return 'password';
  if (state === 'sso_handoff') return anotherWay ? 'password' : 'handoff';
  if (!SSO_OWNERS.includes(email.trim().toLowerCase())) return 'required';

  return anotherWay ? 'breakGlass' : 'handoff';
}

export function signInSsoHref(state: SignInSsoState, email: string): string {
  return `/demo/sign-in?state=${state}&email=${email}`;
}
