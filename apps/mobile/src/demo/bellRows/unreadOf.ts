import { unreadAt } from '../bellSize/BellSamples.tsx';
import type { BellRead } from '../bellSize/bellSizeRules.ts';
import { rowsUnreadAt } from './bellRowSamples.ts';
import type { BellRows } from './bellRowsRules.ts';

/** The unread rows of the list chosen: main's samples, or a set of sc-102956's rows. */
export function unreadOf(read: BellRead, rows: BellRows): ReadonlySet<string> {
  return rows === 'main' ? unreadAt(read) : rowsUnreadAt(read, rows);
}
