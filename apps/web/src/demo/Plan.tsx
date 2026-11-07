import { type SampleEvent } from './events.ts';

export function PlanPage({ event, state }: { event: SampleEvent; state: string }) {
  return event.id === '' || state === '' ? null : null;
}
