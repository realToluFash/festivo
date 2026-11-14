import { CHOICES, type Choice, type ReplyWord } from '@soirely/domain';

import type { ReplyKind } from '../components/ReplyMark.tsx';

const MARK: Record<ReplyWord, ReplyKind> = {
  coming: 'coming',
  maybe: 'maybe',
  notComing: 'notcoming',
  noReply: 'noreply',
  held: 'held',
  notYetInvited: 'notyet',
};

export function markOf(reply: ReplyWord): ReplyKind {
  return MARK[reply];
}

/** Not yet invited is offered while anyone is, and stays while chosen so the list under the host's finger does not move (sc-46879). */
export function filterChoices(
  counts: Readonly<Record<Choice, number>>,
  chosen: Choice,
): readonly Choice[] {
  return CHOICES.filter((key) => key !== 'notYetInvited' || counts[key] > 0 || key === chosen);
}
