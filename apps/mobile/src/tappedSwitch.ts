import { useEffect, useState } from 'react';

import { switchOrganisation } from './signedIn.ts';

let pending: { id: string } | null = null;

/** A switch into `id` the person tapped for, so the organisation's screen takes screen reader focus to its heading as it shows (sc-11032). */
export function expectTappedSwitch(id: string): void {
  pending = { id };
}

export function switchByTap(id: string): void {
  expectTappedSwitch(id);
  switchOrganisation(id);
}

/** The tapped switch into `id` that this mount shows, once: a screen opened again later takes nothing. */
export function useTappedSwitch(id: string): unknown {
  const [answer] = useState(() => (pending?.id === id ? pending : undefined));

  useEffect(() => {
    if (answer !== undefined && pending === answer) pending = null;
  }, [answer]);

  return answer;
}
