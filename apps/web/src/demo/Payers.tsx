import { type SampleEvent } from './events.ts';

export function PayersPage({ event, state }: { event: SampleEvent; state: string }) {
  return event.id === '' || state === '' ? null : null;
}
