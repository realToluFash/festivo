import { FIRE_STATES, FIRE_STATE_WHAT } from './ServiceFireModel.ts';

export const FIRE_BOARDS = FIRE_STATES.map((state) => ({
  title: `Service · fire · ${state}`,
  what: FIRE_STATE_WHAT[state],
  href: `/demo/service-fire?state=${state}`,
}));
