import { useState } from 'react';

import { readOut } from '../../components/ReadOut.tsx';
import { timeWords } from './clock.ts';
import { type Card, CW, tapped } from './shiftClockModel.ts';

const SEND_MS = 700;

/** The card's own state and its send, shared by its demo and My night (sc-3915), where the card lives. */
export function useClockCard(first: Card) {
  const [c, setCard] = useState<Card>(first);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState(0);

  function press(): void {
    setBusy(true);
    setTimeout(() => {
      const next = tapped(c);
      setCard(next);
      setBusy(false);
      setSaid((n) => n + 1);
      if (next.line == null && next.phase === 'on')
        readOut(CW.clockedInAt(timeWords(next.clockIn ?? 0, next.now)));
      if (next.line == null && next.phase === 'off')
        readOut(CW.clockedOutAt(timeWords(next.clockOut ?? 0, next.now)));
    }, SEND_MS);
  }

  return { c, setCard, busy, said, setSaid, press };
}
