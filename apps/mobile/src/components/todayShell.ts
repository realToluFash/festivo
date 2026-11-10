import { createContext, type RefObject, useContext } from 'react';
import type { ViewInstance } from 'react-native';

/** Where a tap on Today goes: the demo names it in a toast, the signed-in app opens it. */
export type Opens =
  | { to: 'event'; id: string; name: string }
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
  /** The sidebar's Search, which the app does not have yet. */
  search: boolean;
  open: (opens: Opens) => void;
  /** A hook: the switcher as the opener at `ref` opens it; `primary` is the one an opening on load drops from. */
  useOrgOpener: (ref: OpenerRef, primary: boolean) => OrgOpening;
}

const Shell = createContext<TodayShell | null>(null);

export const TodayShellProvider = Shell.Provider;

export function useTodayShell(): TodayShell {
  const shell = useContext(Shell);
  if (shell == null) throw new Error('Today is drawn inside a TodayShellProvider.');

  return shell;
}
