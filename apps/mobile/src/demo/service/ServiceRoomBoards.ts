import { ROOM_STATES, ROOM_STATE_WHAT } from './ServiceRoomModel.ts';

export const ROOM_BOARDS = ROOM_STATES.map((state) => ({
  title: `The whole room · ${state}`,
  what: ROOM_STATE_WHAT[state],
  href: `/demo/service-room?state=${state}`,
}));
