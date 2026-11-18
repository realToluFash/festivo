export interface BellBoard {
  title: string;
  what: string;
  href: string;
}

export const BELL_BOARDS: readonly BellBoard[] = [
  {
    title: 'Notifications · top of the list',
    what: 'Turn the phone: on its side the top scrolls away with the list',
    href: '/demo/bell',
  },
  {
    title: 'Notifications · push ask showing',
    what: 'Turn on push? above the first notification',
    href: '/demo/bell?ask=shown',
  },
  {
    title: 'Notifications · scrolled',
    what: 'The top gone, the first notification at the top',
    href: '/demo/bell?at=scrolled',
  },
  {
    title: 'Notifications · push ask, scrolled',
    what: 'The ask scrolled away with the top',
    href: '/demo/bell?ask=shown&at=scrolled',
  },
];
