import { STATION_STATES, STATION_STATE_WHAT } from './stationModel.ts';

export const STATION_BOARDS = STATION_STATES.map((state) => ({
  title: `Kitchen station · ${STATION_STATE_WHAT[state][0]}`,
  what: STATION_STATE_WHAT[state][1],
  href: `/demo/kitchen-station?state=${state}`,
}));
