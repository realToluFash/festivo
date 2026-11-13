import {
  NEXT_STATES,
  NEXT_STATE_WHAT,
  SERVICE_STATES,
  SERVICE_STATE_WHAT,
  type ServiceStateName,
} from './HowItsGoingModel.ts';

const TITLE: Record<ServiceStateName, string> = {
  populated: 'How it’s going',
  noTeam: 'Before Team lands',
  paused: 'The lead paused a tray',
  giveTo: 'Give to…',
  given: 'Given',
  giveNobody: 'Give to… · nobody else',
  giveTaken: 'Give to… · given first',
  offline: 'No connection',
  notStarted: 'Before service starts',
  noManage: 'Without service.manage',
};

export const SERVICE_BOARDS = SERVICE_STATES.map((state) => ({
  title: `Service · ${TITLE[state]}`,
  what: SERVICE_STATE_WHAT[state],
  href: `/demo/how-its-going?state=${state}`,
}));

export const SERVICE_NEXT_BOARDS = NEXT_STATES.map((state) => ({
  title: NEXT_STATE_WHAT[state][0],
  what: NEXT_STATE_WHAT[state][1],
  href: `/demo/how-its-going-next?state=${state}`,
}));
