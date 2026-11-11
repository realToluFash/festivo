export interface PillFitBoard {
  title: string;
  what: string;
  href: string;
}

/** sc-38149's states: run the header on an upright tablet; the ladder and the answers hold on any device. */
export const PILL_FIT_BOARDS: readonly PillFitBoard[] = [
  {
    title: 'English · QA Organisation · 1 invitation',
    what: 'As on main: tile, name, 1 invitation and the caret where the room holds them',
    href: '/demo/pill-fit',
  },
  {
    title: 'French · QA Organisation · 1 invitation',
    what: 'Where 1 invitation and QA do not fit beside Aujourd’hui and Événements, the tile with its ring',
    href: '/demo/pill-fit?lang=fr',
  },
  {
    title: 'Spanish · 2 invitaciones',
    what: 'The invitation line whole, or the tile; never invitac / ión',
    href: '/demo/pill-fit?lang=es&waiting=2',
  },
  {
    title: 'French · Internationalisation',
    what: 'The word whole on one line, ending in … only where the room holds it, or the tile',
    href: '/demo/pill-fit?lang=fr&org=long',
  },
  {
    title: 'French · Largest text size',
    what: 'As on main: no tile, the name on up to two lines, the tile alone only under 120',
    href: '/demo/pill-fit?lang=fr&size=largest',
  },
  {
    title: 'French · Decline sending',
    what: 'Refus en cours… whole; the two answers already stood on two rows',
    href: '/demo/pill-fit?lang=fr&sending=decline',
  },
  {
    title: 'Spanish · Accept and join sending',
    what: 'Uniéndose… whole, the panel the height it was',
    href: '/demo/pill-fit?lang=es&sending=accept',
  },
  {
    title: 'Portuguese · Decline sending',
    what: 'A recusar… whole, the panel the height it was',
    href: '/demo/pill-fit?lang=pt&sending=decline',
  },
];
