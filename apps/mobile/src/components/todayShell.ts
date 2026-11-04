import { createContext, useContext } from 'react';

/** Where a tap on Today goes: the demo names it in a toast, the signed-in app opens it. */
export type Opens =
  | { to: 'event'; id: string; name: string }
  | {
      to:
        'calendar' | 'events' | 'create' | 'notifications' | 'organisation' | 'search' | 'account';
    };

/** Who Today is for and where its taps go, so one set of parts draws the demo and the app. */
export interface TodayShell {
  organisation: string;
  person: { name: string; role: string };
  unread: number;
  /** The sidebar's Search, which the app does not have yet. */
  search: boolean;
  open: (opens: Opens) => void;
}

const Shell = createContext<TodayShell | null>(null);

export const TodayShellProvider = Shell.Provider;

export function useTodayShell(): TodayShell {
  const shell = useContext(Shell);
  if (shell == null) throw new Error('Today is drawn inside a TodayShellProvider.');

  return shell;
}
