import { useEffect, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';

import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { ASK_MS, type Ask, askAnswered, pressAsk } from './CheckWaits.ts';

/** sc-3963's Ask an owner: pressed, answered after ASK_MS, and the screen reader moved to the sent line. Each caller draws it its own way. */
export function useOwnerAsk(start: Ask) {
  const [ask, setAsk] = useState<Ask>(start);
  const now = useRef<Ask>(start);
  const pressed = useRef(false);
  const sentRef = useRef<ViewInstance>(null);
  const answer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const move = (next: Ask) => {
    now.current = next;
    setAsk(next);
  };
  const onAsk = () => {
    const next = pressAsk(now.current);
    if (!next.sends) return;
    pressed.current = true;
    move(next.ask);
    answer.current = setTimeout(() => move(askAnswered(now.current, true)), ASK_MS);
  };

  useEffect(
    () => () => {
      if (answer.current != null) clearTimeout(answer.current);
    },
    [],
  );
  useEffect(() => {
    if (ask !== 'sent' || !pressed.current) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(sentRef.current), 350);

    return () => clearTimeout(later);
  }, [ask]);

  return { ask, onAsk, sentRef };
}
