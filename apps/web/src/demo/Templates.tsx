import { type SampleEvent } from './events.ts';

export function TemplatesPage({ event, state }: { event: SampleEvent; state: string }) {
  return event.id === '' || state === '' ? null : null;
}
