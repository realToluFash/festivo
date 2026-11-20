import { useState } from 'react';

import type { Answered, SaveAnswer } from '../components/saveAnswer.ts';
import type { EditState } from './events.ts';

/** The product's three answers, and the one the board adds for review: the event no longer available (sc-75689). */
export type DemoAnswer = SaveAnswer | 'eventGone';

export interface DemoAnswered extends Omit<Answered, 'answer' | 'give'> {
  answer: DemoAnswer | null;
  give: (answer: DemoAnswer) => void;
}

/** The demo's states whose Save gets one of the answers, every press, until Show the latest. */
export function saveAnswerOf(state: EditState | null): DemoAnswer | null {
  switch (state) {
    case 'nameNotSaved':
    case 'currencyNotSaved':
      return 'notSaved';
    case 'nameForbidden':
    case 'currencyForbidden':
      return 'forbidden';
    case 'nameChangedElsewhere':
    case 'currencyChangedElsewhere':
      return 'changedElsewhere';
    case 'nameGone':
    case 'currencyGone':
      return 'eventGone';
    default:
      return null;
  }
}

export function useDemoAnswer(): DemoAnswered {
  const [answer, setAnswer] = useState<DemoAnswer | null>(null);
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
