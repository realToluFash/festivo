import { cleanThankYou } from '@soirely/domain';

/** What the Overview's card shows (sc-6476): nothing to a member who cannot end the event when there is no line. */
export function thankYouCardOf(
  line: string | null,
  manages: boolean,
): 'add' | 'edit' | 'readOnly' | null {
  if (line != null) return manages ? 'edit' : 'readOnly';

  return manages ? 'add' : null;
}

/** The toast a save says: a line saved, or one removed; saving nothing over nothing says nothing. */
export function thankYouSaid(
  before: string | null,
  typed: string,
): 'thankYou.saved' | 'thankYou.removed' | null {
  if (cleanThankYou(typed) !== '') return 'thankYou.saved';

  return before != null ? 'thankYou.removed' : null;
}
