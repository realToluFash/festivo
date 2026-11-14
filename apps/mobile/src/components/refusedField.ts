import type { EventFormField } from '@soirely/domain';

const TYPED_IN = ['name', 'venueName', 'venueAddress'] as const;

/** A field typed in, which takes input focus, where the rest are pickers the screen reader is moved to. */
export function typedIn(field: EventFormField): field is (typeof TYPED_IN)[number] {
  return (TYPED_IN as readonly string[]).includes(field);
}

/** Whether the keys go down as a refusal focuses `field`: a typed field keeps them up, a picker puts them down, and no field leaves them be. */
export function keysGoDownFor(field: EventFormField | null): boolean {
  return field != null && !typedIn(field);
}
