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
  runOutAlert: 'Chicken has run out',
  runOutPanel: 'Run out · the choice panel',
  runOutConfirm: 'Run out · Serve Beef to 4 guests?',
  runOutConfirmLater: 'Run out · for guests still to come',
  runOutStands: 'Run out · Serve Beef stands',
  runOutWithout: 'Run out · Serve without Chicken',
  runOutChooseFor: 'Run out · Choose for Funke Adeyemi',
  runOutChanged: 'Run out · already changed',
  runOutAvailable: 'Run out · available again',
  runOutNoManage: 'Run out · without service.manage',
  runOutOffline: 'Run out · no connection',
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
