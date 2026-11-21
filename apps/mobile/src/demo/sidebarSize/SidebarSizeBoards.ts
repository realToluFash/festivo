export interface SidebarSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** iPad landscape's sidebar at each size sc-68441, sc-72307 and sc-79559 ask for, in English, French and Spanish. */
export const SIDEBAR_SIZE_BOARDS: readonly SidebarSizeBoard[] = [
  {
    title: 'Sidebar · default size',
    what: 'As on main: 44 rows in the 252 column',
    href: '/demo/sidebar-size?size=default&lang=en&at=members',
  },
  {
    title: 'Sidebar · eighth step (AX1), Today',
    what: 'QA Organisation steps down in its pill to read whole on one line, where main’s size would cut it',
    href: '/demo/sidebar-size?size=eighth&lang=en&at=today&org=qa',
  },
  {
    title: 'Sidebar · eighth step (AX1), Members',
    what: 'The same name in the pill on Settings › Members',
    href: '/demo/sidebar-size?size=eighth&lang=en&at=members&org=qa',
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
  {
    title: 'Sidebar · twelfth step (AX5), two invitations waiting',
    what: '2 invitations whole on one line beside its ring, stepped down on its own; QA Organisation as sc-68441 left it',
    href: '/demo/sidebar-size?size=twelfth&lang=en&at=today&org=qa&waiting=two',
  },
  {
    title: 'Barra lateral · twelfth step (AX5), two invitations waiting',
    what: '2 invitaciones, the longest of the four, whole on one line',
    href: '/demo/sidebar-size?size=twelfth&lang=es&at=today&org=qa&waiting=two',
  },
  {
    title: 'Sidebar · twelfth step (AX5), one invitation waiting',
    what: '1 invitation whole on one line on Today',
    href: '/demo/sidebar-size?size=twelfth&lang=en&at=today&org=qa&waiting=one',
  },
  {
    title: 'Barra lateral · twelfth step (AX5), an event, two waiting',
    what: '2 invitaciones whole on one line inside an event',
    href: '/demo/sidebar-size?size=twelfth&lang=es&at=event&org=qa&waiting=two',
  },
  {
    title: 'Sidebar · ninth step (AX2), two invitations waiting',
    what: 'The line where main draws it, stepped down only if it would not fit',
    href: '/demo/sidebar-size?size=ninth&lang=en&at=members&org=qa&waiting=two',
  },
];
