import { createContext } from 'react';

/** Where a page's skip link goes, before the release band, so it stays first in the tab order. */
export const SkipLinkSlot = createContext<HTMLElement | null>(null);
