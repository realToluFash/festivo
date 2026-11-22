import { createContext, type ReactNode, useContext, useLayoutEffect, useMemo } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Notice } from './Notice.tsx';
import { SETTLED_MS } from './Screen.tsx';

export interface Switched {
  words: string;
  /** Said after Create, which has moved to another screen: the notice takes focus. */
  focus?: boolean;
}

/** Where "Now working in …" is said: `slot` marks a page that has a notice of its own, so the switcher says it there rather than in a toast. */
export interface SwitchedSay {
  slot: () => () => void;
  switched: Switched | null;
}

const Say = createContext<SwitchedSay | null>(null);

export function SwitchedProvider({
  slot,
  switched,
  children,
}: SwitchedSay & { children: ReactNode }) {
  const value = useMemo(() => ({ slot, switched }), [slot, switched]);

  return <Say.Provider value={value}>{children}</Say.Provider>;
}

/** Given `said`, a page that made the move itself says it here, outside the switcher. */
export function SwitchedNotice({
  style,
  said,
}: {
  style?: StyleProp<ViewStyle>;
  said?: Switched | null;
}) {
  const say = useContext(Say);
  if (said === undefined && say == null)
    throw new Error('A switched notice is drawn inside a SwitchedProvider.');
  const slot = said === undefined ? say?.slot : undefined;
  const switched = said === undefined ? (say?.switched ?? null) : said;

  useLayoutEffect(() => slot?.(), [slot]);

  if (switched == null) return null;

  return (
    <View style={style}>
      <Notice
        tone="done"
        mark={tokens.marks.done.glyph}
        body={switched.words}
        answer={switched}
        takesFocus={switched.focus ?? false}
        {...(switched.focus === true ? { readMs: SETTLED_MS * 2 } : {})}
      />
    </View>
  );
}
