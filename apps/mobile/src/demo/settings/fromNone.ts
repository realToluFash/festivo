import { createContext, useContext } from 'react';

/** Settings' own list for no organisation, as You are not in an organisation's Your account opens it (sc-75471). */
export const NO_ORG_SETTINGS = '/demo/settings?as=noOrg&from=none';

/** The web's words for the way back to the no-organisation page (`noOrganisation.wayBack`). */
export const WAY_BACK = 'Join or start an organisation';

/** Back to the no-organisation page while Settings was opened from it: no tab bar, sidebar or bell then, as that page has none. Null anywhere else. */
export const FromNone = createContext<(() => void) | null>(null);

export function useFromNone(): (() => void) | null {
  return useContext(FromNone);
}
