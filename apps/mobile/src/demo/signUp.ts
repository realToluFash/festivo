import { SAMPLE } from './samples.ts';

/** The line under Create your account's title once the sign-up held for its email code has run out (sc-29923). */
export const TIMED_OUT =
  'Your sign-up timed out, so we did not keep the password. Enter it again to get a new code.';

export interface CreateOpening {
  name: string;
  email: string;
  /** Under the title, or null on an ordinary visit. */
  line: string | null;
  focus: 'name' | 'password';
}

/** Back from a run-out sign-up, the name and email are kept and the password is not; opened again later, the app holds the email only. */
export function createOpening(params: {
  state?: string | undefined;
  name?: string | undefined;
  email?: string | undefined;
}): CreateOpening {
  if (params.state !== 'timedOut' && params.state !== 'timedOutReopened') {
    return { name: '', email: '', line: null, focus: 'name' };
  }

  return {
    name: params.state === 'timedOut' ? (params.name ?? SAMPLE.name) : '',
    email: params.email ?? SAMPLE.email,
    line: TIMED_OUT,
    focus: 'password',
  };
}
