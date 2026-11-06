import type { Opens, TodayShell } from '../components/todayShell.ts';
import { SAMPLE } from './samples.ts';

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
    search: true,
    open: (opens) =>
      tell(opens.to === 'event' ? `${opens.name} has its own design.` : DEMO_WORDS[opens.to]),
  };
}
