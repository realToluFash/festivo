import { tokens } from '../theme/tokens.ts';
import { tracking } from '../theme/tracking.ts';

const { size, lineHeight } = tokens.typeTitleFrame;

/** Events, the Calendar and Settings title their tops alike in every layout (sc-39471): 34, as a large title is. */
export const TOP_TITLE = size;

export const topTitle = {
  lineHeight: size * lineHeight,
  letterSpacing: tracking(tokens.typeTitleFrame),
};

const PAGE_SIZE = 30;
const PANE_SIZE = 28;
const COLUMN_SIZE = 26;

/** A Settings page's title under its Back on a phone and upright, as the demo's summary page draws it (sc-39471). */
export const PAGE_TITLE = PAGE_SIZE;

export const pageTitle = { letterSpacing: PAGE_SIZE * -0.02 };

/** A Settings page's title in its pane on a tablet on its side (sc-39471). */
export const PANE_TITLE = PANE_SIZE;

export const paneTitle = { letterSpacing: PANE_SIZE * -0.02 };

/** An event area's title at the top of its list column on a tablet on its side, as the demo's Guests draws it (sc-3785). */
export const COLUMN_TITLE = COLUMN_SIZE;

export const columnTitle = { letterSpacing: COLUMN_SIZE * -0.02 };
