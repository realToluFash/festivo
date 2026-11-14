import type { QueueStateName } from './QueueModel.ts';

const LEAD: Record<QueueStateName, readonly [string, string]> = {
  populated: ['Queue', 'Up next, Kunle’s tray, Served and owed, numbered 1 to 6'],
  beforeStart: ['Queue before Start service', 'Every table to serve, the queue set now'],
  moved: ['Queue after Bring forward', 'Table 4 first, focus kept on it'],
  oneTable: ['Queue · one table', 'Section C: no Bring forward, Move up or Move down'],
  noTables: ['No tables', 'Section E has no Queue'],
  noManage: ['Without service.manage', 'No Queue at all'],
  buildEmpty: ['Build the queue', 'Nothing placed, Save off'],
  buildPartial: ['Build the queue · four placed', 'The rest after, as they are now'],
  buildAll: ['Build the queue · all placed', 'Every table has its place'],
  offline: ['Offline', 'A press is refused and says why'],
  conflict: ['Saved after another lead', '412: the queue as it is now, and who changed it'],
  rivalMove: ['A move another lead made first', 'Press Bring forward: nothing changes'],
  waiterNotice: ['After Bring forward on Table 5', 'The lead sees no toast of their own change'],
  waiterSame: ['After Move up on Row C', 'Kunle’s next table stays'],
  asWell: ['Two sections, owed first', 'Kunle on Section B as well'],
  asWellTie: ['Two sections, a tie', 'Table 5 and Table 6 both first'],
};

const WAITER: Partial<Record<QueueStateName, readonly [string, string]>> = {
  populated: ['Kunle’s Next · owed first', 'Table 10’s owed plate before the queue'],
  waiterNotice: [
    'Kunle’s Next · told of a change',
    'Ifeoma Nduka changed your queue · Table 5 is next',
  ],
  waiterSame: ['Kunle’s Next · nothing to tell', 'Row C moved up, his next table stays'],
  asWell: ['Kunle’s Next · As well, owed', 'The oldest owed across both sections'],
  asWellTie: ['Kunle’s Next · As well, a tie', 'Placed first in both: his own section'],
};

export const QUEUE_BOARDS = (Object.keys(LEAD) as QueueStateName[]).map((state) => ({
  title: `Queue · ${LEAD[state][0]}`,
  what: LEAD[state][1],
  href: `/demo/queue?state=${state}`,
}));

export const NEXT_BOARDS = (Object.keys(WAITER) as QueueStateName[]).map((state) => ({
  title: WAITER[state]?.[0] ?? '',
  what: WAITER[state]?.[1] ?? '',
  href: `/demo/queue-next?state=${state}`,
}));
