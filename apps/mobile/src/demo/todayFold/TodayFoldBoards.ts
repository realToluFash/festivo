import type { TodaySizeBoard } from '../todaySize/TodaySizeBoards.ts';

/** sc-95084: Today on the iPhone with an event live, resting with Open the event whole above the tabs where the cover is taller than the screen; open each on the iPhone 17 Pro and the iPhone SE. */
export const TODAY_FOLD_BOARDS: readonly TodaySizeBoard[] = [
  {
    title: 'Ouvrir l’événement in reach · AX5, iPhone',
    what: 'Scroll Today down a little and let go: it rests with Ouvrir l’événement whole, its foot at the top of the tabs’ fade, clear of the band; one tap opens Dîner en direct (a toast here). Scroll on and it folds; scroll on again to Cette semaine and Vos événements; scroll back up to En cours and Jour 1 sur 1',
    href: '/demo/today-fold?size=ax5&lang=fr',
  },
  {
    title: 'Open the event in reach · AX5, iPhone',
    what: 'The same in English; on the iPhone SE the cover is taller and the resting place lower, the button still whole above the tabs',
    href: '/demo/today-fold?size=ax5&lang=en',
  },
  {
    title: 'Ouvrir l’événement in reach · AX1, iPhone',
    what: 'Wherever the cover runs past the tabs, the third resting place holds the button; step through AX2 to AX4 with Text size',
    href: '/demo/today-fold?size=ax1&lang=fr',
  },
  {
    title: 'Live now · default size, iPhone',
    what: 'The cover fits: Today rests open or folded only, as on main',
    href: '/demo/today-fold?size=default&lang=en',
  },
];
