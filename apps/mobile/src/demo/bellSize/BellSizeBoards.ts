export interface BellSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** The iPad bell's panel at the accessibility sizes (sc-92580); open each on the iPad Pro 13-inch, upright unless it says on its side. */
export const BELL_SIZE_BOARDS: readonly BellSizeBoard[] = [
  {
    title: 'Notifications · AX2, English',
    what: 'Notifications whole on one line at its full size, Mark all read on its own line under it, at its start',
    href: '/demo/bell-size?size=ax2&lang=en',
  },
  {
    title: 'Notificaciones · AX2, Spanish',
    what: 'The longest heading whole, Marcar todas como leídas under it, breaking only between its words',
    href: '/demo/bell-size?size=ax2&lang=es',
  },
  {
    title: 'Notifications · AX2, French',
    what: 'The heading shows, above Tout marquer comme lu',
    href: '/demo/bell-size?size=ax2&lang=fr',
  },
  {
    title: 'Notifications · AX5, English',
    what: 'The heading stepped down only until its word fits, Mark all read under it; one tap marks all read',
    href: '/demo/bell-size?size=ax5&lang=en',
  },
  {
    title: 'Notificaciones · AX5, Spanish',
    what: 'The heading stepped down for its own word, Marcar todas como leídas whole on its lines under it. Turn the iPad on its side: the same',
    href: '/demo/bell-size?size=ax5&lang=es',
  },
  {
    title: 'Notificaciones · AX5, nothing unread',
    what: 'Marcar todas como leídas greyed under the heading; a tap does nothing',
    href: '/demo/bell-size?size=ax5&lang=es&read=all',
  },
  {
    title: 'Notifications · AX5, refreshing',
    what: 'The refreshing mark beside or under the heading, as on main, the list below both',
    href: '/demo/bell-size?size=ax5&lang=en&refreshing=on',
  },
  {
    title: 'Notificaciones · seventh step',
    what: 'Below AX1: beside each other where both are whole on one row, as on main, Marcar todas como leídas under the heading where they are not',
    href: '/demo/bell-size?size=seventh&lang=es',
  },
  {
    title: 'Notifications · default size',
    what: 'As on main: the heading at the start, Mark all read at the end of one row',
    href: '/demo/bell-size?size=default&lang=en',
  },
  {
    title: 'Nothing yet · AX5, French',
    what: 'The empty sentence whole: modifications, événements and s’afficheront never broken, stepped down only for its widest word, the bell tile on its own line above it; Marquer greyed. Turn the iPad on its side: the same',
    href: '/demo/bell-size?size=ax5&lang=fr&read=none',
  },
  {
    title: 'Nothing yet · AX5, Spanish',
    what: 'The empty sentence whole, the tile above it, the panel scrolling to Notification settings at its foot. Turn the iPad on its side: the same',
    href: '/demo/bell-size?size=ax5&lang=es&read=none',
  },
  {
    title: 'Nothing yet · AX1, English',
    what: 'The empty sentence grown and whole, the tile beside it while its widest word fits beside it',
    href: '/demo/bell-size?size=ax1&lang=en&read=none',
  },
  {
    title: 'Nothing yet · AX5, Portuguese',
    what: 'The empty sentence whole at the largest size its widest word allows',
    href: '/demo/bell-size?size=ax5&lang=pt&read=none',
  },
  {
    title: 'Nothing yet · default size',
    what: 'As on main: the tile beside the sentence, at 15',
    href: '/demo/bell-size?size=default&lang=en&read=none',
  },
];

/** The phone's own bell screen at the accessibility sizes (sc-92959); open each on the iPhone 17 Pro, upright. */
export const PHONE_BELL_SIZE_BOARDS: readonly BellSizeBoard[] = [
  {
    title: 'Notifications · AX2, English',
    what: 'The title whole on one line, Notifications and never Notification / s, stepped down only until its word fits; the list below it',
    href: '/demo/bell-size?size=ax2&lang=en',
  },
  {
    title: 'Notificaciones · AX2, Spanish',
    what: 'The longest title whole on one line, stepped down only for its own word',
    href: '/demo/bell-size?size=ax2&lang=es',
  },
  {
    title: 'Notifications · AX5, English',
    what: 'The title whole on one line at the largest size, the list below it and the page scrolling as on main',
    href: '/demo/bell-size?size=ax5&lang=en',
  },
  {
    title: 'Notificaciones · AX5, Spanish',
    what: 'The title whole on one line at the largest size',
    href: '/demo/bell-size?size=ax5&lang=es',
  },
  {
    title: 'Notifications · AX5, refreshing',
    what: 'The refreshing mark on the line under the title, which keeps its size',
    href: '/demo/bell-size?size=ax5&lang=en&refreshing=on',
  },
  {
    title: 'Notifications · default size',
    what: 'As on main: the title at 30, the refreshing mark beside it when shown',
    href: '/demo/bell-size?size=default&lang=en',
  },
  {
    title: 'Nothing yet · AX5, French',
    what: 'The empty sentence whole by the panel’s rule, the bell tile above it',
    href: '/demo/bell-size?size=ax5&lang=fr&read=none',
  },
  {
    title: 'Nothing yet · AX5, Spanish',
    what: 'The empty sentence whole by the panel’s rule, the bell tile above it',
    href: '/demo/bell-size?size=ax5&lang=es&read=none',
  },
];

/** The bell's rows at the accessibility sizes (sc-102956), in the iPad's panel; open each on the iPad Pro 13-inch, upright. */
export const BELL_ROWS_BOARDS: readonly BellSizeBoard[] = [
  {
    title: 'QA notification 1 · AX5',
    what: 'notification whole, never notificatio / n: each title stepped down only as far as its widest word needs',
    href: '/demo/bell-size?size=ax5&lang=en&rows=qa',
  },
  {
    title: 'Mixed rows · AX5',
    what: 'The account row steps down for Oluwaseyifunmi between two rows whose words all fit and draw as on main',
    href: '/demo/bell-size?size=ax5&lang=en&rows=mixed',
  },
  {
    title: 'Title steps down · AX5',
    what: 'Chukwuemeka steps the title down; its line and its event and time draw no larger than it, never under 13.5',
    href: '/demo/bell-size?size=ax5&lang=en&rows=steps',
  },
  {
    title: 'A 40-letter name · AX5',
    what: 'The event’s one long word at 13.5, breaking at the line’s end, every letter drawn and nothing ending in …; the row grows',
    href: '/demo/bell-size?size=ax5&lang=en&rows=word40',
  },
  {
    title: 'Mixed rows · AX5, French',
    what: 'l’événement and Oluwaseyifunmi whole, each row stepped down for its own words; the panel scrolls to Show more and Paramètres de notification',
    href: '/demo/bell-size?size=ax5&lang=fr&rows=mixed',
  },
  {
    title: 'Title steps down · AX5, French',
    what: 'Chukwuemeka and Organisation whole, the lines under each title no larger than it',
    href: '/demo/bell-size?size=ax5&lang=fr&rows=steps',
  },
  {
    title: 'A 40-letter name · AX5, French',
    what: 'The long name breaks at 13.5; the title over it at 45',
    href: '/demo/bell-size?size=ax5&lang=fr&rows=word40',
  },
  {
    title: 'Mixed rows · default size',
    what: 'As on main: every text at its default size',
    href: '/demo/bell-size?size=default&lang=en&rows=mixed',
  },
  {
    title: 'A 40-letter name · default size',
    what: 'As on main: the one long word breaks at the line’s end, the only word that does',
    href: '/demo/bell-size?size=default&lang=en&rows=word40',
  },
];

/** The same rows on the phone's own bell screen (sc-102956); open each on the iPhone 17 Pro, upright. */
export const PHONE_BELL_ROWS_BOARDS: readonly BellSizeBoard[] = [
  {
    title: 'QA notification 1 · AX5',
    what: 'notification whole at 56, never notificatio / n; QA notification 3, read, fits at its full 57.1',
    href: '/demo/bell-size?size=ax5&lang=en&rows=qa',
  },
  {
    title: 'Mixed rows · AX5',
    what: 'The account row at 40 for Oluwaseyifunmi, the rows over and under it at their full size, as on main',
    href: '/demo/bell-size?size=ax5&lang=en&rows=mixed',
  },
  {
    title: 'Title steps down · AX5',
    what: 'The title at 38 for Chukwuemeka, its line and its event and time at 38 under it',
    href: '/demo/bell-size?size=ax5&lang=en&rows=steps',
  },
  {
    title: 'A 40-letter name · AX5',
    what: 'The event and time at 13.5, the long word breaking at the line’s end, the row growing; scroll to Show more and Notification settings',
    href: '/demo/bell-size?size=ax5&lang=en&rows=word40',
  },
  {
    title: 'Mixed rows · default size',
    what: 'As on main',
    href: '/demo/bell-size?size=default&lang=en&rows=mixed',
  },
  {
    title: 'A 40-letter name · default size',
    what: 'As on main: the one long word breaks at the line’s end, the only word that does',
    href: '/demo/bell-size?size=default&lang=en&rows=word40',
  },
];
