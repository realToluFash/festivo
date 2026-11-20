import type { SaveAnswer } from '../components/saveAnswer.ts';
import type { EditState } from './events.ts';

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
