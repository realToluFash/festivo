export interface FilterSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** The states sc-73933 asks for: AX1 and AX5, English and French, nothing chosen, two types, a long host; and the default size as on main. */
export const FILTER_SIZE_BOARDS: readonly FilterSizeBoard[] = [
  {
    title: 'Filter menu · default size · English',
    what: 'As on main: each row on one line',
    href: '/demo/filter-size?size=default&lang=en',
  },
  {
    title: 'Filter menu · AX1 · English · nothing chosen',
    what: 'A value that fits beside its title stays beside it',
    href: '/demo/filter-size?size=ax1&lang=en',
  },
  {
    title: 'Filter menu · AX1 · French · nothing chosen',
    what: 'Tous les types and Toutes les dates under their titles',
    href: '/demo/filter-size?size=ax1&lang=fr',
  },
  {
    title: 'Filter menu · AX5 · English · nothing chosen',
    what: 'Any type, Any time and Anyone whole, never An…',
    href: '/demo/filter-size?size=ax5&lang=en',
  },
  {
    title: 'Filter menu · AX5 · French · nothing chosen',
    what: 'Every value wraps between its words',
    href: '/demo/filter-size?size=ax5&lang=fr',
  },
  {
    title: 'Filter menu · AX5 · French · two types',
    what: 'Anniversaire de mariage +1 autre, never Anniversai…',
    href: '/demo/filter-size?size=ax5&lang=fr&picks=twoTypes',
  },
  {
    title: 'Filter menu · AX1 · English · two types',
    what: 'As many whole picks as fit, then +N more',
    href: '/demo/filter-size?size=ax1&lang=en&picks=twoTypes',
  },
  {
    title: 'Filter menu · AX5 · English · a long host',
    what: 'The name breaks only after its hyphen, Clear filters whole',
    href: '/demo/filter-size?size=ax5&lang=en&picks=longHost',
  },
  {
    title: 'Filter menu · AX5 · French · a long host',
    what: 'Tous les types above, the host under Hôtes',
    href: '/demo/filter-size?size=ax5&lang=fr&picks=longHost',
  },
];
