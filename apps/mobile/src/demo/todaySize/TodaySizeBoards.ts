export interface TodaySizeBoard {
  title: string;
  what: string;
  href: string;
}

/** Today's live cover on its side (sc-92312), upright (its chips sc-93211; its name, end line and Open the event sc-93578) and on the iPhone (its chips sc-93855), its organisation pill on the phone (sc-92247) and the switcher it opens there (sc-92465) and beside the upright iPad's tabs (sc-92314), greeting, section headings (sc-91291), Your events rows (sc-92090) and This week's day lines (sc-92250) at the accessibility sizes; open each on the iPad upright, on its side, and on the iPhone. */
export const TODAY_SIZE_BOARDS: readonly TodaySizeBoard[] = [
  {
    title: 'Live now · AX5, iPhone',
    what: 'Live now with its dot and Day 1 of 1 at their full size, each chip grown to hold its words, Day 1 of 1 under Live now from the same left edge where both do not fit, both clear of the pill row above and the name below; never Day cut through its y',
    href: '/demo/today-size?size=ax5&lang=en&live=dinner',
  },
  {
    title: 'En cours · AX5, iPhone',
    what: 'En cours and Jour 1 sur 1 whole, each in its chip, no chip wider than the screen; scroll Today to Ouvrir l’événement, one tap opens Dîner en direct (a toast here)',
    href: '/demo/today-size?size=ax5&lang=fr&live=dinner',
  },
  {
    title: 'Live now · AX1, iPhone',
    what: 'Live now and Day 1 of 1 whole at AX1, side by side where they fit; step through AX2 to AX4 with Text size',
    href: '/demo/today-size?size=ax1&lang=en&live=dinner',
  },
  {
    title: 'Jour 1 sur 1 · AX5, iPhone, a venue',
    what: 'Jour 1 sur 1 · Salle des fêtes du Château de Chantilly in full on as many lines as it needs, each ending between words, no line starting with ·, the cover grown down and the name below it',
    href: '/demo/today-size?size=ax5&lang=fr&live=dinner&venue=chantilly',
  },
  {
    title: 'Live now · default size, iPhone',
    what: 'The chips as on main, 28 tall on one line, Day 1 of 1 on one line, and Open the event under the hair as on main; the cover’s height and foot are the demo’s, so compare the chips and the button, not the cover, with main',
    href: '/demo/today-size?size=default&lang=en&live=dinner',
  },
  {
    title: 'Dîner en direct · AX5, upright',
    what: 'Dîner en direct whole across the cover, or Dîner en / direct, never Dîn / er or dire / ct; Ouvrir l’événement on its own line under the end line, at the name’s left edge, every word whole; one tap opens Dîner en direct (a toast here)',
    href: '/demo/today-size?size=ax5&lang=fr&live=dinner',
  },
  {
    title: 'Live now · AX5, upright, English',
    what: 'Dîner en direct whole, never Dîner / en / direc / t; Ends today at 23:30 and Open the event each whole, the button under the end line',
    href: '/demo/today-size?size=ax5&lang=en&live=dinner',
  },
  {
    title: 'En cours · AX5, upright, several long words',
    what: 'Atelier Céleste Réceptions et Mariages on as many lines as its words need, each line one size, the cover grown down to hold it, Vos événements clear below',
    href: '/demo/today-size?size=ax5&lang=fr&live=several',
  },
  {
    title: 'Live now · AX5, upright, one long word',
    what: 'Internationalisationsorganisationsgesellschaft at 48, its default size, breaking inside itself only, read in full; nothing ends in …',
    href: '/demo/today-size?size=ax5&lang=en&live=oneWord',
  },
  {
    title: 'Live now · seventh step, upright',
    what: 'As on main: the chips on one line, Open the event at the right of the words',
    href: '/demo/today-size?size=seventh&lang=en&live=dinner',
  },
  {
    title: 'En cours · AX5, upright',
    what: 'En cours and Jour 1 sur 1 at their full size, each chip grown to hold its words, the second under the first where both do not fit, both clear of the tabs above and the name below',
    href: '/demo/today-size?size=ax5&lang=fr&live=dinner',
  },
  {
    title: 'Live now · AX1, upright',
    what: 'Live now with its dot and Day 1 of 1, each whole in its chip at the size chosen, nothing in “…”; from AX1 Open the event on its own line under the end line',
    href: '/demo/today-size?size=ax1&lang=en&live=dinner',
  },
  {
    title: 'Jour 1 sur 1 · AX5, upright, a venue',
    what: 'Jour 1 sur 1 · Salle des fêtes du Château de Chantilly in full on as many lines as it needs, each ending between words, the dot on the word before it, the cover grown down; scroll Today to bring Ouvrir l’événement whole into view, one tap opens Dîner en direct',
    href: '/demo/today-size?size=ax5&lang=fr&live=dinner&venue=chantilly',
  },
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
    title: 'Où travaillez-vous ? · AX5, QA Organisation',
    what: 'QA / Organisation whole in its row, stepped down until Organisation fits; Votre rôle · / Owner and Actuelle never larger than the name, no line starting with ·',
    href: '/demo/today-size?size=ax5&lang=fr&org=qa&switcher=open',
  },
  {
    title: 'Où travaillez-vous ? · AX5, several long words',
    what: 'Atelier Céleste Réceptions et Mariages whole, Réceptions alone on its line, the row grown down; scroll to Créer une organisation',
    href: '/demo/today-size?size=ax5&lang=fr&org=several&switcher=open',
  },
  {
    title: 'Where are you working? · AX5, one long word',
    what: 'Internationalisationsorganisationsgesellschaft at 15, its default size, every letter shown, breaking only where a line is full; nothing ends in …',
    href: '/demo/today-size?size=ax5&lang=en&org=oneWord&switcher=open',
  },
  {
    title: 'Où travaillez-vous ? · AX5, one long word',
    what: 'The same in French: every letter of the name, Actuelle whole under Votre rôle · Owner',
    href: '/demo/today-size?size=ax5&lang=fr&org=oneWord&switcher=open',
  },
  {
    title: 'Where are you working? · AX1, iPhone',
    what: 'QA Organisation, Your role · Owner and Current, every word whole; one tap on Lumen Studio switches to it',
    href: '/demo/today-size?size=ax1&lang=en&org=qa&switcher=open',
  },
  {
    title: 'Where are you working? · default size',
    what: 'As on main: one tap on the pill opens main’s switcher, a name held to two lines',
    href: '/demo/today-size?size=default&lang=en&org=qa',
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
