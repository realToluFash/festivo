import type { LayoutKind } from '../layout/classify.ts';

export type FormTitles = { bar: string; heading: string | null };

/** A form's title in the pinned header and at the top of the form. A phone header keeps `short` when one is given, so a long title scrolls with the form rather than growing the header (sc-22869). */
export function formTitles(
  kind: LayoutKind,
  title: string,
  short: string | undefined,
  events: string,
): FormTitles {
  if (kind !== 'phone') return { bar: events, heading: title };
  if (short == null) return { bar: title, heading: null };

  return { bar: short, heading: title === short ? null : title };
}
