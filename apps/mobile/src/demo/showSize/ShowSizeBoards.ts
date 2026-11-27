export interface ShowSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** The states sc-78219 asks for: AX1 and AX5, English and French, beside the default size as on main. */
export const SHOW_SIZE_BOARDS: readonly ShowSizeBoard[] = [
  {
    title: 'Show menu · default size · English',
    what: 'As on main: each row on one line',
    href: '/demo/show-size?size=default&lang=en',
  },
  {
    title: 'Show menu · default size · French',
    what: 'As on main',
    href: '/demo/show-size?size=default&lang=fr',
  },
  {
    title: 'Show menu · AX1 · English',
    what: 'Events and milestones wraps between its words, the tick beside it',
    href: '/demo/show-size?size=ax1&lang=en',
  },
  {
    title: 'Show menu · AX1 · French',
    what: 'Événements / et jalons, never Événeme / nts',
    href: '/demo/show-size?size=ax1&lang=fr',
  },
  {
    title: 'Show menu · AX5 · English',
    what: 'No larger than the Calendar title, every word whole',
    href: '/demo/show-size?size=ax5&lang=en',
  },
  {
    title: 'Show menu · AX5 · French',
    what: 'Événements steps down to fit its line whole',
    href: '/demo/show-size?size=ax5&lang=fr',
  },
  {
    title: 'Show menu · AX5 · French · Events only chosen',
    what: 'Événements seulement whole, the tick beside the chosen row',
    href: '/demo/show-size?size=ax5&lang=fr&chosen=events',
  },
  {
    title: 'Show menu · AX5 · English · with Only what needs you',
    what: 'Three rows, the menu scrolling where it is taller than its room',
    href: '/demo/show-size?size=ax5&lang=en&rows=needs&chosen=needs',
  },
];
