import { type SampleEvent } from './events.ts';

export function SharePage({ event, state }: { event: SampleEvent; state: string }) {
  return event.id === '' || state === '' ? null : null;
}
