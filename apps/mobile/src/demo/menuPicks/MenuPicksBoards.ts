import { MENU_STATES, menuStart } from './menuPicksModel.ts';

export const MENU_PICKS_BOARDS = MENU_STATES.map((state) => ({
  title: `Menu · ${menuStart(state).name}`,
  what: menuStart(state).note,
  href: `/demo/menu-picks?state=${state}`,
}));
