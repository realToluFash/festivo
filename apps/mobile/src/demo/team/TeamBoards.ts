import type { TeamStateName } from './TeamModel.ts';

const LEAD: Record<TeamStateName, readonly [string, string]> = {
  populated: ['Team', 'Every section, the Pass and each kitchen station, with who is on it'],
  sheetSection: ['Move someone to Section C', 'Only people in Here who can work the floor'],
  sheetChosen: ['Kunle chosen · As well', 'As well is chosen until the lead picks Instead'],
  sheetInstead: [
    'Kunle chosen · Instead',
    'Leaves Section A with nobody; his started tray stays his',
  ],
  sheetKitchen: ['Move someone to the Fryer', 'Only people in Here who can work the pass'],
  sheetTwo: ['Bisi on two stations', 'Instead only, and what it leaves with nobody'],
  sheetBlank: ['Put with nobody chosen', 'Choose who to move.'],
  movedAsWell: ['Kunle moved · As well', 'Kunle Ajayi is on Section C.'],
  movedInstead: ['Kunle moved · Instead', 'Kunle Ajayi is on Section C. Nobody on Section A.'],
  movedKitchen: ['Tayo moved · As well', 'Tayo Bamidele is on Fryer.'],
  offline: ['No connection', 'Every Move control dashed, nothing made or queued'],
  offlineTried: ['No connection · a Move pressed', 'Needs a connection to move anyone.'],
  conflict: ['A beaten move', '409: Tobi Adeyemi put Grace Udo on Section D first'],
  fromAlert: ['Opened from the alert', 'Team on Section A, left with nobody, focus on its Move'],
  empty: ['No places', 'One line and nothing else'],
  noManage: ['Without service.manage', 'No Team tab at all'],
};

const MOVED: Partial<Record<TeamStateName, readonly [string, string]>> = {
  movedAsWell: ['Kunle’s Next · on two sections', 'Owed first, then both queues mixed'],
  movedInstead: ['Kunle’s Next · Instead', 'His started tray at Table 4 stays his'],
  movedKitchen: ['Tayo’s station · Grill and Fryer', 'Each tray names its station'],
};

export const TEAM_BOARDS = (Object.keys(LEAD) as TeamStateName[]).map((state) => ({
  title: `Team · ${LEAD[state][0]}`,
  what: LEAD[state][1],
  href: `/demo/team?state=${state}`,
}));

export const MOVED_BOARDS = (Object.keys(MOVED) as TeamStateName[]).map((state) => ({
  title: MOVED[state]?.[0] ?? '',
  what: MOVED[state]?.[1] ?? '',
  href: `/demo/team-moved?state=${state}`,
}));
