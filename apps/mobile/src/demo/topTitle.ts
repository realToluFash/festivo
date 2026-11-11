import { tokens } from '../theme/tokens.ts';

const { size, lineHeight, letterSpacing } = tokens.typeTitleFrame;

/** Events, the Calendar and Settings title their tops alike in every layout (sc-39471): 34, as a large title is. */
export const TOP_TITLE = size;

export const topTitle = {
  lineHeight: size * lineHeight,
  letterSpacing: size * Number.parseFloat(letterSpacing),
};
