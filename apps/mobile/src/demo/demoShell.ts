import type { Opens, TodayShell } from '../components/todayShell.ts';
import { DemoOrgOpener } from './OrgSwitcher.tsx';
import { SAMPLE } from './samples.ts';
import { EVENTS, type EventKey } from './today.ts';

const DEMO_WORDS: Record<Exclude<Opens['to'], 'event'>, string> = {
  calendar: 'Calendar has its own design.',
  events: 'Events has its own design.',
  create: 'Create an event has its own design.',
  notifications: 'Notifications have their own design.',
  organisation: 'Switching organisation has its own design.',
  search: 'Search has its own design.',
  account: 'Your account has its own design.',
};

/** What the demo has drawn, opened in place of the toast. */
export interface DemoOpens {
  events?: (() => void) | undefined;
  event?: ((key: EventKey) => void) | undefined;
}

function eventKeyOf(id: string): EventKey | undefined {
  return (Object.keys(EVENTS) as EventKey[]).find((key) => key === id);
}

/** The demo's shell: its sample organisation and person, and a toast for what is not drawn. */
export function demoShell(tell: (words: string) => void, drawn: DemoOpens = {}): TodayShell {
  return {
    organisation: SAMPLE.organisation,
    person: { name: SAMPLE.name, role: 'Owner' },
    unread: 3,
    search: true,
    OrgOpener: DemoOrgOpener,
    open: (opens) => {
      const key = opens.to === 'event' ? eventKeyOf(opens.id) : undefined;

      if (opens.to === 'events' && drawn.events != null) drawn.events();
      else if (key != null && drawn.event != null) drawn.event(key);
      else tell(opens.to === 'event' ? `${opens.name} has its own design.` : DEMO_WORDS[opens.to]);
    },
  };
}
