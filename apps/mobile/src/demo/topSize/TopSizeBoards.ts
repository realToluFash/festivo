export interface TopSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** The phone's organisation pill over Settings, Events and the Calendar at the accessibility sizes (sc-92464); open each on the iPhone upright. The upright iPad's beside the tabs over Settings (sc-92728) follow; open those on the iPad Pro 13-inch upright. */
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
  {
    title: 'iPad upright · Settings · AX2, one invitation',
    what: 'QA Organisation whole beside the tabs, 1 invitation on one line or 1 / invitation, never invita / tion; the tabs, Search and the bell at the top',
    href: '/demo/top-size?size=ax2&lang=en&screen=settings&org=qa&invite=one',
  },
  {
    title: 'iPad upright · Paramètres · AX2, une invitation',
    what: 'QA Organisation and 1 invitation in French, every word whole, clear of the tabs',
    href: '/demo/top-size?size=ax2&lang=fr&screen=settings&org=qa&invite=one',
  },
  {
    title: 'iPad upright · Settings · AX1, none waiting',
    what: 'The name alone, whole, no "…"; Settings starts under the pill',
    href: '/demo/top-size?size=ax1&lang=en&screen=settings&org=qa',
  },
  {
    title: 'iPad upright · Paramètres · AX5, one invitation',
    what: 'The pill grows down, its name stepped only as far as Organisation needs; the tabs, Search and the bell stay at the top; Paramètres clear below',
    href: '/demo/top-size?size=ax5&lang=fr&screen=settings&org=qa&invite=one',
  },
  {
    title: 'iPad upright · Paramètres · AX5, several long words',
    what: 'Atelier Céleste Réceptions et Mariages on as many lines as its words need, every line one size',
    href: '/demo/top-size?size=ax5&lang=fr&screen=settings&org=several&invite=one',
  },
  {
    title: 'iPad upright · Settings · AX5, one long word',
    what: 'The tile alone with its ring; one tap opens Where are you working?',
    href: '/demo/top-size?size=ax5&lang=en&screen=settings&org=oneWord&invite=one',
  },
  {
    title: 'iPad upright · Settings · seventh step',
    what: 'As on main beside the tabs',
    href: '/demo/top-size?size=seventh&lang=en&screen=settings&org=qa&invite=one',
  },
];
