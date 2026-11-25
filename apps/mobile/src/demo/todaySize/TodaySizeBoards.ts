export interface TodaySizeBoard {
  title: string;
  what: string;
  href: string;
}

/** Today's live cover on its side (sc-92312), its organisation pill on the phone (sc-92247) and beside the upright iPad's tabs (sc-92314), greeting, section headings (sc-91291), Your events rows (sc-92090) and This week's day lines (sc-92250) at the accessibility sizes; open each on the iPad upright, on its side, and on the iPhone. */
export const TODAY_SIZE_BOARDS: readonly TodaySizeBoard[] = [
  {
    title: 'En cours · AX5, on its side',
    what: 'Dîner en direct whole, or Dîner en / direct; En cours and Jour 1 sur 1 each whole in its chip, the second under the first where both do not fit; Ouvrir l’événement under the end line',
    href: '/demo/today-size?size=ax5&lang=fr&live=dinner',
  },
  {
    title: 'En cours · AX5, several long words',
    what: 'Atelier Céleste Réceptions et Mariages on as many lines as its words need, the banner grown to hold it, Vos événements clear below',
    href: '/demo/today-size?size=ax5&lang=fr&live=several',
  },
  {
    title: 'Live now · AX5, one long word',
    what: 'Internationalisationsorganisationsgesellschaft at 48, its default size, breaking inside itself only',
    href: '/demo/today-size?size=ax5&lang=en&live=oneWord',
  },
  {
    title: 'Live now · AX1, English',
    what: 'Live now, Day 1 of 1, Ends today at 23:30 and Open the event, every word whole, the button under the end line',
    href: '/demo/today-size?size=ax1&lang=en&live=dinner',
  },
  {
    title: 'Live now · seventh step',
    what: 'As on main: the chips on one line, Open the event at the banner’s right',
    href: '/demo/today-size?size=seventh&lang=en&live=dinner',
  },
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
    title: 'The pill · AX1, iPad upright',
    what: 'QA / Organisation beside the tabs, stepped down until Organisation fits, never Organi / sation, 12 clear of the tabs',
    href: '/demo/today-size?size=ax1&lang=en&org=qa',
  },
  {
    title: 'The pill · AX1, iPad upright, one invitation',
    what: 'The name and 1 invitation each whole and stepped alone; one tap opens Where are you working?',
    href: '/demo/today-size?size=ax1&lang=en&org=qa&invite=one',
  },
  {
    title: 'The pill · AX1, iPad upright, Lumen Studio',
    what: 'Lumen Studio in words beside the tabs, each word whole, never the tile alone',
    href: '/demo/today-size?size=ax1&lang=en&org=lumen',
  },
  {
    title: 'The pill · AX1, iPad upright, several long words',
    what: 'Atelier Céleste Réceptions et Mariages on as many lines as its words need; the pill grows down, the tabs, Search and the bell stay at the top, the greeting below',
    href: '/demo/today-size?size=ax1&lang=en&org=several',
  },
  {
    title: 'The pill · AX1, iPad upright, one long word',
    what: 'Internationalisationsorganisationsgesellschaft: the tile alone with its ring, never the word broken',
    href: '/demo/today-size?size=ax1&lang=en&org=oneWord&invite=one',
  },
  {
    title: 'La pastille · AX1, iPad upright',
    what: 'Aujourd’hui, Événements, Calendrier, Réglages leave the pill under 120, so it is its tile; Où travaillez-vous ? on a tap',
    href: '/demo/today-size?size=ax1&lang=fr&org=several&invite=one',
  },
  {
    title: 'La pastille · AX5, iPad upright',
    what: 'The tabs step under their own size to fit, so the pill gives way to its tile, the tabs whole',
    href: '/demo/today-size?size=ax5&lang=fr&org=qa',
  },
  {
    title: 'The pill · AX5, iPad upright',
    what: 'In English too the tabs take the row and the pill is its tile, clear of them',
    href: '/demo/today-size?size=ax5&lang=en&org=several',
  },
  {
    title: 'Cette semaine · AX5, upright',
    what: 'Aujourd’hui with mer. 25 nov. on the line under it, no dot; never · mer. 25 nov.',
    href: '/demo/today-size?size=ax5&lang=fr&week=days',
  },
  {
    title: 'Cette semaine · AX1, upright',
    what: 'Aujourd’hui · mer. 25 nov. on one line where it fits, the date alone under it where not',
    href: '/demo/today-size?size=ax1&lang=fr&week=days',
  },
  {
    title: 'This week · AX5, English',
    what: 'Today, then Wed, Nov 25 under it; Thu, Nov 26 then tomorrow under it',
    href: '/demo/today-size?size=ax5&lang=en&week=days',
  },
  {
    title: 'This week · default size',
    what: 'As on main: Today · Wed, Nov 25 on one line, the accent on Today',
    href: '/demo/today-size?size=default&lang=en&week=days',
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
