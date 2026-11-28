import { tokens } from '../theme/tokens.ts';

/** ListPicker's field around the chosen name: its border, padding, the gap to the chevron and the chevron's width. The country-over-number rule adds them up (sc-7579). */
export const COUNTRY_FIELD = {
  borderWidth: 1,
  paddingHorizontal: tokens.spaceLg,
  gap: tokens.spaceSm,
  chevron: 14,
};
