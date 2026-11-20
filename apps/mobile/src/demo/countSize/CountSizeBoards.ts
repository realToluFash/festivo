export interface CountSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** The states sc-75214 asks for: the default size and AX1 to AX5, English and French, one and five found, stacked and side by side. */
export const COUNT_SIZE_BOARDS: readonly CountSizeBoard[] = [
  {
    title: 'Count line · default size · English',
    what: 'As on main: 5 events and Clear filters on one line',
    href: '/demo/count-size?size=default&lang=en',
  },
  {
    title: 'Count line · default size · French',
    what: 'As on main: 5 événements and Effacer les filtres on one line',
    href: '/demo/count-size?size=default&lang=fr',
  },
  {
    title: 'Count line · AX1 · English',
    what: 'Side by side while both fit whole, stacked once they cannot',
    href: '/demo/count-size?size=ax1&lang=en',
  },
  {
    title: 'Count line · AX1 · French',
    what: 'Effacer les filtres under 5 événements once they cannot share a line',
    href: '/demo/count-size?size=ax1&lang=fr',
  },
  {
    title: 'Count line · AX3 · French · 1 found',
    what: '1 événement whole, Clear filters under it',
    href: '/demo/count-size?size=ax3&lang=fr&found=one',
  },
  {
    title: 'Count line · AX5 · English',
    what: 'Stacked, both at the Events title’s size, never one letter a line',
    href: '/demo/count-size?size=ax5&lang=en',
  },
  {
    title: 'Count line · AX5 · French',
    what: 'Effacer les filtres wraps between its words under 5 événements',
    href: '/demo/count-size?size=ax5&lang=fr',
  },
  {
    title: 'Count line · AX5 · French · no filter',
    what: 'The count alone, as on main',
    href: '/demo/count-size?size=ax5&lang=fr&found=unfiltered',
  },
  {
    title: 'Count line · nothing found · French',
    what: 'As on main: Aucun événement ne correspond, with Effacer les filtres under it',
    href: '/demo/count-size?lang=fr&found=none',
  },
];
