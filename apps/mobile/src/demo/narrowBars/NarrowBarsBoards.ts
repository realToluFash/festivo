export interface NarrowBarsBoard {
  title: string;
  what: string;
  href: string;
}

/** sc-99214's states: each bar's sizes hold on the width named, whatever phone runs the demo. */
export const NARROW_BARS_BOARDS: readonly NarrowBarsBoard[] = [
  {
    title: '320dp · French · default size',
    what: 'Both bars 8 from each side, 3 padding, no gap: Aujourd’hui and Événements whole at 12',
    href: '/demo/narrow-bars?lang=fr',
  },
  {
    title: '320dp · French · Android 200%',
    what: 'Today steps from 20 to 12 and every word stays whole',
    href: '/demo/narrow-bars?lang=fr&size=android',
  },
  {
    title: '320dp · Portuguese · default size',
    what: 'The event’s tabs 59.2 wide: Convidados and Mensagens whole at 10',
    href: '/demo/narrow-bars?lang=pt',
  },
  {
    title: '320dp · Portuguese · Android 200%',
    what: 'The event’s labels step from 20 to 10, every word whole',
    href: '/demo/narrow-bars?lang=pt&size=android',
  },
  {
    title: '320dp · Spanish · Android 200%',
    what: 'Invitados and Calendario whole',
    href: '/demo/narrow-bars?lang=es&size=android',
  },
  {
    title: '320dp · English · Android 200%',
    what: 'Overview, Messages and Settings whole',
    href: '/demo/narrow-bars?lang=en&size=android',
  },
  {
    title: '320dp · Portuguese · an outsider’s bar',
    what: 'Vista geral, Convidados, Mais, sitting as the event’s bar does (sc-68438)',
    href: '/demo/narrow-bars?lang=pt&bar=outsider&size=android',
  },
  {
    title: '360dp · French · Android 200%, as on main',
    what: 'Regression: 18 from each side; Today at 12',
    href: '/demo/narrow-bars?lang=fr&size=android&width=main',
  },
  {
    title: '360dp · Portuguese · default size, as on main',
    what: 'Regression: 18 from each side; the event’s labels at 10 (sc-71148)',
    href: '/demo/narrow-bars?lang=pt&width=main',
  },
  {
    title: 'This phone · its own Font size',
    what: 'The bars at this phone’s width and text size; on a 320dp emulator, the AC’s phone',
    href: '/demo/narrow-bars?width=phone&size=phone',
  },
];
