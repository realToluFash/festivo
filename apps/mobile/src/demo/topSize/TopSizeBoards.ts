export interface TopSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** The phone's organisation pill over Settings, Events and the Calendar at the accessibility sizes (sc-92464); open each on the iPhone upright. */
export const TOP_SIZE_BOARDS: readonly TopSizeBoard[] = [
  {
    title: 'Paramètres · AX5, QA Organisation',
    what: 'QA Organisation whole, or QA / Organisation, stepped down until Organisation fits, never QA / Organ…',
    href: '/demo/top-size?size=ax5&lang=fr&screen=settings&org=qa',
  },
  {
    title: 'Paramètres · AX5, one invitation',
    what: 'The name and 1 invitation each stepped alone, the invitation line never larger than the name',
    href: '/demo/top-size?size=ax5&lang=fr&screen=settings&org=qa&invite=one',
  },
  {
    title: 'Paramètres · AX5, several long words',
    what: 'Atelier Céleste Réceptions et Mariages on as many lines as its words need, Réceptions alone on its line, Paramètres clear below',
    href: '/demo/top-size?size=ax5&lang=fr&screen=settings&org=several',
  },
  {
    title: 'Settings · AX5, one long word',
    what: 'The tile alone, its ring while an invitation waits; one tap opens Where are you working?',
    href: '/demo/top-size?size=ax5&lang=en&screen=settings&org=oneWord&invite=one',
  },
  {
    title: 'Settings · AX1, one invitation',
    what: 'QA Organisation and 1 invitation at AX1, every word whole',
    href: '/demo/top-size?size=ax1&lang=en&screen=settings&org=qa&invite=one',
  },
  {
    title: 'Événements · AX5, one invitation',
    what: 'The same pill over Événements, clear of Search and the bell',
    href: '/demo/top-size?size=ax5&lang=fr&screen=events&org=qa&invite=one',
  },
  {
    title: 'Calendrier · AX5, one invitation',
    what: 'The same pill over Calendrier, clear of Search and the bell',
    href: '/demo/top-size?size=ax5&lang=fr&screen=calendar&org=qa&invite=one',
  },
  {
    title: 'Settings · seventh step',
    what: 'As on main: the tile, the name on one line',
    href: '/demo/top-size?size=seventh&lang=en&screen=settings&org=qa&invite=one',
  },
];
