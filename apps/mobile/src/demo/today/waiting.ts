import type { Moment } from '../../kit/today.ts';

/** Today's events still on their way, or refused: the body waits, the cover and the tabs do not (sc-87600). */
export type Waiting = 'loading' | 'failed';

/** How long the demo's read takes after Try again or a pick in the switcher: past the kit's one second, so its loading shows. */
export const READ_TAKES_MS = 2500;

export function waitingOf(asked: string | undefined): Waiting | null {
  return asked === 'loading' || asked === 'failed' ? asked : null;
}

/** What the next read comes back as: loaded, or `?retry=fails` failing every time. */
export function readEnds(retry: string | undefined): 'loaded' | 'failed' {
  return retry === 'fails' ? 'failed' : 'loaded';
}

/** The cover with nothing read yet: the date and the greeting by time of day, and no line under it, since that line is about the events. Never Now. */
export function waitingCover(moment: Moment): Moment {
  return {
    ...moment,
    name: 'planNow',
    kind: 'plan',
    full: false,
    lead: null,
    sub: '',
    needs: null,
    nextUp: null,
    events: [],
    now: null,
    run: null,
    asOf: null,
  };
}
