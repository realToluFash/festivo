export interface RowsSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** Each size sc-69816 asks for, in English and in French, and the one word too wide for the row. */
export const ROWS_SIZE_BOARDS: readonly RowsSizeBoard[] = [
  {
    title: 'Settings rows · default size · English',
    what: 'As on main',
    href: '/demo/rows-size?size=default&lang=en',
  },
  {
    title: 'Settings rows · ninth step (AX2) · French',
    what: 'Only a word that would break steps down',
    href: '/demo/rows-size?size=ninth&lang=fr',
  },
  {
    title: 'Settings rows · tenth step (AX3) · English',
    what: 'Notifications and QA Organisation whole',
    href: '/demo/rows-size?size=tenth&lang=en',
  },
  {
    title: 'Settings rows · eleventh step (AX4) · French',
    what: 'Personnalisation stepped down alone',
    href: '/demo/rows-size?size=eleventh&lang=fr',
  },
  {
    title: 'Settings rows · twelfth step (AX5) · English',
    what: 'Each label at the cap, or as far down as its widest word needs',
    href: '/demo/rows-size?size=twelfth&lang=en',
  },
  {
    title: 'Settings rows · twelfth step (AX5) · French',
    what: 'Règles de connexion and double authentification whole',
    href: '/demo/rows-size?size=twelfth&lang=fr',
  },
  {
    title: 'Settings rows · twelfth step (AX5) · one long word',
    what: 'At its default size, that word alone breaks, read in full',
    href: '/demo/rows-size?size=twelfth&lang=en&name=long',
  },
];
