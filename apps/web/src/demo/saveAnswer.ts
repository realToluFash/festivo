import { useState } from 'react';

import { NOTE_WORDS } from './arrivalNote.ts';
import { type EditState, EVENT_WORDS as W } from './events.ts';

/** sc-74398: the three answers to a part's Save, shown after its fields and directly above Cancel and Save. */
export type SaveAnswer = 'notSaved' | 'forbidden' | 'changedElsewhere';

export const SAVE_WORDS: Record<SaveAnswer, string> = {
  notSaved: 'Not saved. Your changes are still here. Try again.',
  forbidden: NOTE_WORDS.forbidden,
  changedElsewhere: W.changedElsewhere,
};

/** The demo's states whose Save gets one of the three answers, every press, until Show the latest. */
export function saveAnswerOf(state: EditState | null): SaveAnswer | null {
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
    default:
      return null;
  }
}

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
