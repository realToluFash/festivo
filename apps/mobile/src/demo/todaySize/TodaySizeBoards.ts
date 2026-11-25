export interface TodaySizeBoard {
  title: string;
  what: string;
  href: string;
}

/** Today's greeting and section headings at the sizes sc-91291 asks for; open each on the iPad upright, on its side, and on the iPhone. */
export const TODAY_SIZE_BOARDS: readonly TodaySizeBoard[] = [
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
