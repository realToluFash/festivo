import { type SampleEvent } from './events.ts';

export function DecidePage({ event, state }: { event: SampleEvent; state: string }) {
  return event.id === '' || state === '' ? null : null;
}
