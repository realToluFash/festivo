import { useIsFocused } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';

import { SETTLED_MS } from './components/Screen.tsx';
import { tappedSwitches } from './kit/tappedSwitch.ts';
import { switchOrganisation } from './signedIn.ts';

const switches = tappedSwitches();

// Past the heading's focus, so a heading that shows later, as a paused or overdue screen gives way, takes nothing.
const SERVED_MS = 2 * SETTLED_MS;

export function switchByTap(id: string): void {
  switchOrganisation(id, () => switches.landed(id));
}

/** A tapped switch that landed while this frame's screen was in view, until its heading has taken focus. */
export function useFrameSwitch(): unknown {
  const here = useIsFocused();
  const [answer, setAnswer] = useState<unknown>(undefined);

  useEffect(() => (here ? switches.listen(setAnswer) : undefined), [here]);

  useEffect(() => {
    if (answer === undefined) return;

    const served = setTimeout(() => setAnswer(undefined), SERVED_MS);

    return () => clearTimeout(served);
  }, [answer]);

  return answer;
}

/** The frame's tapped switch, for a body heading that takes it in place of the frame's title. */
export const FrameSwitch = createContext<unknown>(undefined);

export function useTappedSwitch(): unknown {
  return useContext(FrameSwitch);
}
