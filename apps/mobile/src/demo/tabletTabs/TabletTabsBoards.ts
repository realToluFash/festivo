export interface TabletTabsBoard {
  title: string;
  what: string;
  href: string;
}

/** sc-40401's states; run them on a tablet held upright. The sizes named hold on an 800-wide Android tablet, and the demo's line shows the size on the device it runs on. */
export const TABLET_TABS_BOARDS: readonly TabletTabsBoard[] = [
  {
    title: 'This device’s text size',
    what: 'The row at the Font size set on this tablet',
    href: '/demo/tablet-tabs',
  },
  {
    title: 'Default size · French · 1 invitation',
    what: 'As on main: labels at 15, the pill’s words where the room holds them',
    href: '/demo/tablet-tabs?size=default&lang=fr',
  },
  {
    title: 'Android 200% · French · Aujourd’hui',
    what: 'Labels at about 17, every word whole; the pill its tile with its ring, clear of the capsule',
    href: '/demo/tablet-tabs?size=android&lang=fr&tab=Today',
  },
  {
    title: 'Android 200% · French · Paramètres',
    what: 'The same size and width with another tab chosen; the bell clear',
    href: '/demo/tablet-tabs?size=android&lang=fr&tab=Settings',
  },
  {
    title: 'Android 200% · French · no invitation',
    what: 'The tile alone, no ring',
    href: '/demo/tablet-tabs?size=android&lang=fr&waiting=none',
  },
  {
    title: 'Android 200% · English',
    what: 'Today, Events, Calendar, Settings whole at about 27, under their own 30; the pill its tile with its ring, clear of the capsule',
    href: '/demo/tablet-tabs?size=android&lang=en',
  },
  {
    title: 'Android 200% · Spanish · Ajustes',
    what: 'Hoy, Eventos, Calendario, Ajustes at one size',
    href: '/demo/tablet-tabs?size=android&lang=es&tab=Settings',
  },
  {
    title: 'iPad ninth step · French',
    what: 'The same rule on the 834-wide iPad: about 29 under its own 32, the pill its tile',
    href: '/demo/tablet-tabs?size=iphone&lang=fr',
  },
];
