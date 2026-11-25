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
];
