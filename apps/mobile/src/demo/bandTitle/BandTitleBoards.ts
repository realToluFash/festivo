export interface BandTitleBoard {
  title: string;
  what: string;
  href: string;
}

/** Today's scrolled band at the accessibility sizes (sc-92248); open each on an iPhone upright. */
export const BAND_TITLE_BOARDS: readonly BandTitleBoard[] = [
  {
    title: 'Aujourd’hui · AX5',
    what: 'Stepped down until it fits between the tile and Search, 8 clear of each, centred in that room',
    href: '/demo/band-title?size=ax5&lang=fr',
  },
  {
    title: 'Aujourd’hui · AX1',
    what: 'At its chosen size, centred in the room rather than under Search',
    href: '/demo/band-title?size=ax1&lang=fr',
  },
  {
    title: 'Today · AX5',
    what: 'No taller than the row holds, clear of the Dynamic Island, centred on the screen',
    href: '/demo/band-title?size=ax5&lang=en',
  },
  {
    title: 'Today · AX1',
    what: 'At its chosen size, centred on the screen as on main',
    href: '/demo/band-title?size=ax1&lang=en',
  },
  {
    title: 'Aujourd’hui · AX5, during an event’s day',
    what: 'The Now line under the band as on main, the title clear of it',
    href: '/demo/band-title?size=ax5&lang=fr&moment=day',
  },
  {
    title: 'Aujourd’hui · seventh step',
    what: 'As on main: centred on the screen at the default × the scale',
    href: '/demo/band-title?size=seventh&lang=fr',
  },
];
