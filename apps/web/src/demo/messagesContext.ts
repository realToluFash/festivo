import { createContext, useContext } from 'react';

import type { Mesh } from './events.ts';
import { type Change, type Delivery, type Inbox, type Where, whereWord } from './messages.ts';
import type { Tell } from './TodayParts.tsx';

export interface InboxApi {
  inbox: Inbox;
  act: (change: Change) => void;
  tell: Tell;
  say: (words: string) => void;
  focus: (key: string) => void;
  mesh: Mesh;
  keys: boolean;
  bell: { read: boolean; markRead: () => void; takeFirst: () => boolean };
}

export const InboxContext = createContext<InboxApi | null>(null);

export function useInbox(): InboxApi {
  const api = useContext(InboxContext);

  if (api == null) throw new Error('Messages outside its page');

  return api;
}

export interface Bit {
  words: string;
  where?: Where;
  mark?: Delivery;
}

export function whereBits(where: Where, at: string): Bit[] {
  return [{ words: whereWord(where), where }, { words: at }];
}
