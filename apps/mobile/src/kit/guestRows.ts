import type { ReplyWord } from '@soirely/domain';

import type { ReplyKind } from '../components/ReplyMark.tsx';

const MARK: Record<ReplyWord, ReplyKind> = {
  coming: 'coming',
  maybe: 'maybe',
  notComing: 'notcoming',
  noReply: 'noreply',
  held: 'held',
};

export function markOf(reply: ReplyWord): ReplyKind {
  return MARK[reply];
}
