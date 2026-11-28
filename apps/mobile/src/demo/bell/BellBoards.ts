export interface BellBoard {
  title: string;
  what: string;
  href: string;
}

export const BELL_BOARDS: readonly BellBoard[] = [
  {
    title: 'Notifications · top of the list',
    what: 'Turn the phone: on its side the B frame as upright, past the bars',
    href: '/demo/bell',
  },
  {
    title: 'Notifications · push ask showing',
    what: 'Turn on push? above the first notification',
    href: '/demo/bell?ask=shown',
  },
  {
    title: 'Notifications · scrolled',
    what: 'The title gone, Back and Mark all read still above the list',
    href: '/demo/bell?at=scrolled',
  },
  {
    title: 'Notifications · push ask, scrolled',
    what: 'The ask scrolled away with the title',
    href: '/demo/bell?ask=shown&at=scrolled',
  },
];
