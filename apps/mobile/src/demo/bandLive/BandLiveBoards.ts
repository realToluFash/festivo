export interface BandLiveBoard {
  title: string;
  what: string;
  href: string;
}

/** Today's scrolled band upright on an iPad at the accessibility sizes, with an event live (sc-92315); open each on an iPad upright. */
export const BAND_LIVE_BOARDS: readonly BandLiveBoard[] = [
  {
    title: 'En cours · Dîner en direct · AX5',
    what: 'Whole on one line, 10 under the tab capsule, the band grown down to hold it',
    href: '/demo/band-live?size=ax5&lang=fr&event=diner',
  },
  {
    title: 'Atelier Céleste Réceptions et Mariages · AX5',
    what: 'Wraps only between words, every line inside the band',
    href: '/demo/band-live?size=ax5&lang=fr&event=long',
  },
  {
    title: 'Internationalisationsorganisationsgesellschaft · AX5',
    what: 'The whole line stepped down until the word fits whole, never under 13.5',
    href: '/demo/band-live?size=ax5&lang=fr&event=word',
  },
  {
    title: '120 W with no space · AX5',
    what: 'At 13.5, the word broken at the line’s end and carried on below, the whole name shown',
    href: '/demo/band-live?size=ax5&lang=fr&event=wide',
  },
  {
    title: 'Live · Dîner en direct · AX5',
    what: 'English, the same rule',
    href: '/demo/band-live?size=ax5&lang=en&event=diner',
  },
  {
    title: 'En cours · Dîner en direct · AX1',
    what: 'The first accessibility size: at its chosen size, under the tabs',
    href: '/demo/band-live?size=ax1&lang=fr&event=diner',
  },
  {
    title: 'En cours · Dîner en direct · seventh step',
    what: 'As on main: one line in main’s 92',
    href: '/demo/band-live?size=seventh&lang=fr&event=diner',
  },
  {
    title: 'En cours · Dîner en direct · default size',
    what: 'As on main: one line in main’s 92',
    href: '/demo/band-live?size=default&lang=fr&event=diner',
  },
  {
    title: 'No event live · AX5',
    what: 'As on main: no live line',
    href: '/demo/band-live?size=ax5&lang=fr&event=none',
  },
];
