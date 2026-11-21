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

/** The states sc-75213 asks for: each drilled level at the default size as on main, and at AX1 and AX5 in English and French. */
export const FILTER_DRILLED_BOARDS: readonly FilterSizeBoard[] = [
  {
    title: 'Type · default size · English',
    what: 'As on main: each type on one line',
    href: '/demo/filter-size?size=default&lang=en&level=type',
  },
  {
    title: 'Type · AX1 · English · two types',
    what: 'Every type whole, Gala or fundraiser wrapping between its words',
    href: '/demo/filter-size?size=ax1&lang=en&level=type&picks=twoTypes',
  },
  {
    title: 'Type · AX5 · English · two types',
    what: 'Conference and Anniversary step down to fit whole, never Conferen / ce',
    href: '/demo/filter-size?size=ax5&lang=en&level=type&picks=twoTypes',
  },
  {
    title: 'Type · AX5 · French · two types',
    what: 'Anniversaire and Événement d’entreprise whole, the menu scrolling',
    href: '/demo/filter-size?size=ax5&lang=fr&level=type&picks=twoTypes',
  },
  {
    title: 'When · AX1 · French · between dates',
    what: 'Entre deux dates… whole, Du and Au one above the other',
    href: '/demo/filter-size?size=ax1&lang=fr&level=when&picks=between',
  },
  {
    title: 'When · AX5 · English · between dates',
    what: 'Each choice beside its radio, From and To and their dates whole',
    href: '/demo/filter-size?size=ax5&lang=en&level=when&picks=between',
  },
  {
    title: 'When · AX5 · French · nothing chosen',
    what: 'Toutes les dates to Entre deux dates…, every word whole',
    href: '/demo/filter-size?size=ax5&lang=fr&level=when',
  },
  {
    title: 'Hosted by · AX5 · English · a long host',
    what: 'Funmilayo Adéṣínà- / Ọláolúwa breaks only after its hyphen',
    href: '/demo/filter-size?size=ax5&lang=en&level=hosts&picks=longHost',
  },
  {
    title: 'Hosted by · AX5 · French · a long host',
    what: '‹ Hôtes whole, the long host beside its check',
    href: '/demo/filter-size?size=ax5&lang=fr&level=hosts&picks=longHost',
  },
];
