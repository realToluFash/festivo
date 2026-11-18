export interface SidebarSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** iPad landscape's sidebar at each size sc-68441 asks for, in English and in French. */
export const SIDEBAR_SIZE_BOARDS: readonly SidebarSizeBoard[] = [
  {
    title: 'Sidebar · default size',
    what: 'As on main: 44 rows in the 252 column',
    href: '/demo/sidebar-size?size=default&lang=en&at=members',
  },
  {
    title: 'Barre latérale · ninth step (AX2)',
    what: 'Événements steps down alone; rows, glyphs and names as on main',
    href: '/demo/sidebar-size?size=ninth&lang=fr&at=members',
  },
  {
    title: 'Sidebar · tenth step (AX3)',
    what: 'Rows grow to hold their words',
    href: '/demo/sidebar-size?size=tenth&lang=en&at=today',
  },
  {
    title: 'Barre latérale · eleventh step (AX4)',
    what: 'Each label steps down only where its word would break',
    href: '/demo/sidebar-size?size=eleventh&lang=fr&at=events',
  },
  {
    title: 'Sidebar · twelfth step (AX5), Members',
    what: 'Every word whole; past its height the sidebar scrolls',
    href: '/demo/sidebar-size?size=twelfth&lang=en&at=members',
  },
  {
    title: 'Barre latérale · twelfth step (AX5), Paramètres',
    what: 'Paramètres, Calendrier and Vos événements whole',
    href: '/demo/sidebar-size?size=twelfth&lang=fr&at=members',
  },
  {
    title: 'Barre latérale · twelfth step (AX5), an event',
    what: '‹ Événements, the card and the ten areas whole',
    href: '/demo/sidebar-size?size=twelfth&lang=fr&at=event',
  },
];
