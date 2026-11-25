export interface TodaySizeBoard {
  title: string;
  what: string;
  href: string;
}

/** Today's organisation pill on the phone (sc-92247), greeting, section headings (sc-91291) and Your events rows (sc-92090) at the accessibility sizes; open each on the iPad upright, on its side, and on the iPhone. */
export const TODAY_SIZE_BOARDS: readonly TodaySizeBoard[] = [
  {
    title: 'La pastille · AX5, iPhone',
    what: 'QA / Organisation whole, stepped down until Organisation fits, never Organi / sation',
    href: '/demo/today-size?size=ax5&lang=fr&org=qa',
  },
  {
    title: 'La pastille · AX5, one invitation',
    what: 'The name and 1 invitation each stepped alone, every word whole',
    href: '/demo/today-size?size=ax5&lang=fr&org=qa&invite=one',
  },
  {
    title: 'La pastille · AX5, several long words',
    what: 'Atelier Céleste Réceptions et Mariages on as many lines as its words need, Réceptions alone on its line, the greeting below',
    href: '/demo/today-size?size=ax5&lang=fr&org=several',
  },
  {
    title: 'The pill · AX5, one long word',
    what: 'The tile alone, its ring while an invitation waits; one tap opens Where are you working?',
    href: '/demo/today-size?size=ax5&lang=en&org=oneWord&invite=one',
  },
  {
    title: 'The pill · AX1, iPhone',
    what: 'QA Organisation at AX1, every word whole',
    href: '/demo/today-size?size=ax1&lang=en&org=qa&invite=one',
  },
  {
    title: 'Vos événements · AX5, on its side',
    what: 'dimanche 29 nov. whole in the 316 column, the thumbnail above the words',
    href: '/demo/today-size?size=ax5&lang=fr&greeting=evening',
  },
  {
    title: 'Vos événements · AX5, one long word',
    what: 'Internationalisationsorganisationsgesellschaft at its default size, breaking inside itself only',
    href: '/demo/today-size?size=ax5&lang=fr&event=oneWord',
  },
  {
    title: 'Your events · AX1, upright',
    what: 'Beside This week, every word whole, the name never smaller than its dates',
    href: '/demo/today-size?size=ax1&lang=en',
  },
  {
    title: 'Aujourd’hui · AX5, on its side',
    what: 'Vos événements whole in its column, stepped down or Vos / événements; Tout voir under it',
    href: '/demo/today-size?size=ax5&lang=fr',
  },
  {
    title: 'Aujourd’hui · AX5, upright',
    what: 'Bonjour, / QA breaks after its comma, never before it',
    href: '/demo/today-size?size=ax5&lang=fr&greeting=morning',
  },
  {
    title: 'Aujourd’hui · AX5, evening',
    what: 'Bonsoir, QA, and every heading whole: À traiter, Cette semaine, Prochain événement',
    href: '/demo/today-size?size=ax5&lang=fr&greeting=evening',
  },
  {
    title: 'Today · AX5, a long first name',
    what: 'Maximiliano-Bartholomew whole on its own line, or broken only after its hyphen',
    href: '/demo/today-size?size=ax5&lang=en&name=long',
  },
  {
    title: 'Today · AX1, first run',
    what: 'Welcome, QA; See all and Calendar under their headings from AX1',
    href: '/demo/today-size?size=ax1&lang=en&greeting=welcome',
  },
  {
    title: 'Today · seventh step',
    what: 'As on main: the links beside their headings, nothing stepped',
    href: '/demo/today-size?size=seventh&lang=en',
  },
];
