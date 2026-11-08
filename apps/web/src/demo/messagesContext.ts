import { createContext, useContext } from 'react';

import type { Mesh } from '../mesh.ts';
import { type Change, type Delivery, type Inbox, type Where, whereWord } from './messages.ts';
import type { ToApi } from './messagesTo.ts';
import type { Tell } from '../components/SettingsParts.tsx';

export interface InboxApi {
  inbox: Inbox;
  act: (change: Change) => void;
  tell: Tell;
  say: (words: string) => void;
  focus: (key: string) => void;
  mesh: Mesh;
  keys: boolean;
  /** The id of the sentence under New on an event that can't send: every composer and send control is off and points at it. */
  whyOff: string | undefined;
  bell: { read: boolean; markRead: () => void; takeFirst: () => boolean };
  /** Who gets it's saved audiences and groups (sc-3957), and whether the reader may send. */
  to: ToApi;
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
