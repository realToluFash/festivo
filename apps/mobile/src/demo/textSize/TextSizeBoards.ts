export interface TextSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** Each state sc-37298 asks for; a label size holds on the width named, and the demo box shows the size on the phone it runs on. */
export const TEXT_SIZE_BOARDS: readonly TextSizeBoard[] = [
  {
    title: 'This phone’s text size',
    what: 'The bar and the card at the size set on this phone',
    href: '/demo/text-size',
  },
  {
    title: 'Default size · English',
    what: 'As on main: labels at 12 on any phone, the tile beside the words',
    href: '/demo/text-size?size=default',
  },
  {
    title: 'Default size · French',
    what: 'As on main: Événements whole at 12 on any phone',
    href: '/demo/text-size?size=default&lang=fr',
  },
  {
    title: 'Android 200% · French · Aujourd’hui',
    what: 'On a 360-wide phone, labels at 12, the widest word whole; no tile',
    href: '/demo/text-size?size=android&lang=fr&tab=Today',
  },
  {
    title: 'Android 200% · Spanish · Ajustes',
    what: 'qa’s state: on a 360-wide phone, labels at 14, Propietario · QA / Organisation whole',
    href: '/demo/text-size?size=android&lang=es&tab=Settings',
  },
  {
    title: 'Android 200% · Spanish · Bold text on · Eventos',
    what: 'The same, measured in the heavier face',
    href: '/demo/text-size?size=android&lang=es&tab=Events&bold=on',
  },
  {
    title: 'Android 200% · French · Bold text on · Calendrier',
    what: 'Propriétaire · QA on one line, Organisation on the next',
    href: '/demo/text-size?size=android&lang=fr&tab=Calendar&bold=on',
  },
  {
    title: 'iPhone ninth step · French · Calendrier',
    what: 'On the 402-wide iPhone, labels at 14',
    href: '/demo/text-size?size=iphone&lang=fr&tab=Calendar',
  },
  {
    title: 'iPhone ninth step · Spanish · Bold text on · Ajustes',
    what: 'On the 402-wide iPhone, labels at 16',
    href: '/demo/text-size?size=iphone&lang=es&tab=Settings&bold=on',
  },
  {
    title: 'Android 200% · French · 100-character organisation',
    what: 'The pill grows, every word whole, no …',
    href: '/demo/text-size?size=android&lang=fr&org=long',
  },
  {
    title: 'Android 200% · Spanish · a long email',
    what: 'It continues after its @',
    href: '/demo/text-size?size=android&lang=es&email=long',
  },
  {
    title: 'Home’s This week · default size · French',
    what: 'As on main: the strip of seven days over the agenda (sc-13281)',
    href: '/demo/text-size?part=week&size=default&lang=fr',
  },
  {
    title: 'Home’s This week · iPhone ninth step · French',
    what: 'qa3’s state: no strip; the agenda alone, each time over its row, every word whole',
    href: '/demo/text-size?part=week&size=iphone&lang=fr',
  },
  {
    title: 'Home’s This week · iPhone twelfth step · French',
    what: 'The same at the largest size',
    href: '/demo/text-size?part=week&size=twelfth&lang=fr',
  },
  {
    title: 'Home’s This week · iPhone ninth step · French · nothing this week',
    what: 'No strip; Rien de prévu cette semaine and Next up, its picture given up',
    href: '/demo/text-size?part=week&size=iphone&lang=fr&week=nothing',
  },
  {
    title: 'Home’s This week · Android 200% · French',
    what: 'No strip, as on the iPhone',
    href: '/demo/text-size?part=week&size=android&lang=fr',
  },
];
