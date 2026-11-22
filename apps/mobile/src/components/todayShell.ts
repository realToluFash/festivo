import { type ReactNode, createContext, type RefObject, useContext, useRef } from 'react';
import type { ViewInstance } from 'react-native';

/** Where a tap on Today goes: the demo names it in a toast, the signed-in app opens it. */
export type Opens =
  | { to: 'event'; id: string; name: string }
  | { to: 'runOfShow'; id: string; name: string; track: string | null }
  | { to: 'calendar' | 'events' | 'create' | 'notifications' | 'search' | 'account' };

/** What the switcher's opener names, and what a tap on it does. */
export interface OrgOpening {
  id: string;
  name: string;
  /** How many invitations wait, in words, or null when none do. */
  waiting: string | null;
  label: string;
  expanded: boolean;
  onPress: () => void;
}

export type OpenerRef = RefObject<ViewInstance | null>;

/** Who Today is for and where its taps go, so one set of parts draws the demo and the app. */
export interface TodayShell {
  organisation: string;
  person: { name: string; role: string | null };
  unread: number;
  /** The role holds Create events: the first run offers Start your first event, or tells it to ask an owner. */
  creates: boolean;
  /** Search: the sidebar's row held sideways, and the glass beside the bell on the cover and the band. */
  search: boolean;
  open: (opens: Opens) => void;
  /** A hook: the switcher as the opener at `ref` opens it; `primary` is the one an opening on load drops from. */
  useOrgOpener: (ref: OpenerRef, primary: boolean) => OrgOpening;
  /** A hook: what the bell opens, given what it does on a phone; with none, the bell only opens. */
  useBell?: (onPhone: () => void) => BellOpening;
}

/** The bell's opener, its tap, and the popover it opens on a tablet (sc-83081). */
export interface BellOpening {
  ref: OpenerRef;
  open: () => void;
  popover: ReactNode;
}

const Shell = createContext<TodayShell | null>(null);

export const TodayShellProvider = Shell.Provider;

export function useTodayShell(): TodayShell {
  const shell = useContext(Shell);
  if (shell == null) throw new Error('Today is drawn inside a TodayShellProvider.');

  return shell;
}

/** The bell that only opens, for a shell with no popover of its own: the demo's. */
export function usePlainBell(onPhone: () => void): BellOpening {
  return { ref: useRef<ViewInstance>(null), open: onPhone, popover: null };
}
