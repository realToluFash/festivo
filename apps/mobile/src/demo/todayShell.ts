import { createContext, useContext } from 'react';

import { SAMPLE } from './samples.ts';

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
  open: (opens: Opens) => void;
}

const Shell = createContext<TodayShell | null>(null);

export const TodayShellProvider = Shell.Provider;

export function useTodayShell(): TodayShell {
  const shell = useContext(Shell);
  if (shell == null) throw new Error('Today is drawn inside a TodayShellProvider.');

  return shell;
}

const DEMO_WORDS: Record<Exclude<Opens['to'], 'event'>, string> = {
  calendar: 'Calendar has its own design.',
  events: 'Events has its own design.',
  create: 'Create an event has its own design.',
  notifications: 'Notifications have their own design.',
  organisation: 'Switching organisation has its own design.',
  search: 'Search has its own design.',
  account: 'Your account has its own design.',
};

/** The demo's shell: its sample organisation and person, and a toast for what is not drawn. */
export function demoShell(tell: (words: string) => void): TodayShell {
  return {
    organisation: SAMPLE.organisation,
    person: { name: SAMPLE.name, role: 'Owner' },
    unread: 3,
    open: (opens) =>
      tell(opens.to === 'event' ? `${opens.name} has its own design.` : DEMO_WORDS[opens.to]),
  };
}

/** `Ire Events` is IE, `Folake Adeyemi` is FA. */
export function initials(name: string): string {
  return name
    .split(/\s+/u)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => [...word][0]?.toLocaleUpperCase() ?? '')
    .join('');
}
