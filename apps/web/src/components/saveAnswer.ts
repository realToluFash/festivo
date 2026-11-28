import { useState } from 'react';

/** sc-74398: the answers to a part's Save, shown after its fields and directly above Cancel and Save. */
export type SaveAnswer = 'notSaved' | 'forbidden' | 'eventGone' | 'changedElsewhere';

export interface Answered {
  answer: SaveAnswer | null;
  /** How many presses of Save this answer has had, so each brings it and Save back into view. */
  times: number;
  give: (answer: SaveAnswer) => void;
  clear: () => void;
}

export function useSaveAnswer(first: SaveAnswer | null = null): Answered {
  const [answer, setAnswer] = useState(first);
  const [times, setTimes] = useState(0);

  return {
    answer,
    times,
    give: (next) => {
      setAnswer(next);
      setTimes((count) => count + 1);
    },
    clear: () => setAnswer(null),
  };
}
