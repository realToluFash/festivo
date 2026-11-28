import { foldedName } from '@soirely/domain';

type Currency = { code: string; name: string };

/** The currencies whose code or name holds what was typed, accents and case set aside, and the trimmed typed words when a search found none. */
export function currencyMatches<C extends Currency>(
  choices: readonly C[],
  typed: string,
): { shown: readonly C[]; unmatched: string | null } {
  const shown = choices.filter((one) =>
    foldedName(`${one.code} ${one.name}`).includes(foldedName(typed)),
  );
  return { shown, unmatched: shown.length === 0 && typed.trim() !== '' ? typed.trim() : null };
}
