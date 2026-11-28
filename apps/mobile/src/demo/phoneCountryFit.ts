import { tokens } from '../theme/tokens.ts';

export const COUNTRY_BASIS = 140;
export const NUMBER_BASIS = 180;
const CHEVRON = 14;
/** The picker's border, padding, gap and chevron around its name. */
export const COUNTRY_CHROME = 2 + tokens.spaceLg * 2 + tokens.spaceSm + CHEVRON;

/** The country box's width beside the number: its basis and a third of what is left, or the whole line once the two bases no longer fit on it. */
export function countryBoxBeside(rowWidth: number): number {
  const left = rowWidth - COUNTRY_BASIS - tokens.spaceSm - NUMBER_BASIS;

  return left < 0 ? rowWidth : COUNTRY_BASIS + left / 3;
}

/** The country goes over the number whenever its name, "+44 Royaume-Uni", does not fit on one line beside it, and always from the accessibility sizes on (sc-7579, #104845). Until both are measured it stays beside. */
export function countryOverNumber(
  atAccessibilitySizes: boolean,
  nameWidth: number | null,
  rowWidth: number | null,
): boolean {
  if (atAccessibilitySizes) return true;
  if (nameWidth == null || rowWidth == null) return false;

  return Math.ceil(nameWidth) + COUNTRY_CHROME > countryBoxBeside(rowWidth);
}
