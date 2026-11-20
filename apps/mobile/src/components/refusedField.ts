import type { EventFormField } from '@soirely/domain';

const TYPED_IN = ['name', 'venueName', 'venueAddress', 'arrivalNote'] as const;

/** A field typed in, which takes input focus, where the rest are pickers the screen reader is moved to. */
export function typedIn(field: EventFormField): field is (typeof TYPED_IN)[number] {
  return (TYPED_IN as readonly string[]).includes(field);
}

/** Whether the keys go down as a refusal focuses `field`: a typed field keeps them up, a picker puts them down, and no field leaves them be. */
export function keysGoDownFor(field: EventFormField | null): boolean {
  return field != null && !typedIn(field);
}

const FORM_ORDER = [
  'type',
  'hosts',
  'cover',
  'startsAt',
  'endsAt',
  'venueName',
  'timeZone',
  'currency',
] as const;

export type FormSection = (typeof FORM_ORDER)[number];

/** Whether `section` is out of TalkBack's reach while focus moves to the `refused` picker: every section after it is (sc-43907). */
export function sectionQuiet(refused: EventFormField | null, section: FormSection): boolean {
  const order: readonly string[] = FORM_ORDER;

  return refused != null && order.indexOf(section) > order.indexOf(refused);
}
