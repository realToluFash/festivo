/** Where a block sits inside the scroll content. */
export interface Placed {
  contentY: number;
  height: number;
}

export type EventField = 'name' | 'number';

export interface EventFields {
  /** The refusal above the fields, while it shows. */
  refusal: Placed | null;
  /** Your name: its label, the field and the line under it. */
  name: Placed;
  /** Country code and Mobile number: the row and the line under it. */
  number: Placed;
  focus: EventField;
}

function span(from: Placed, to: Placed): Placed {
  return { contentY: from.contentY, height: to.contentY + to.height - from.contentY };
}

const fits = (block: Placed, room: number, margin: number) => block.height + 2 * margin <= room;

/** What the keys leave in view above Send code (sc-97734, pm 26 Nov): the refusal and both fields when they fit, else the refusal and the focused field, else the focused field (WCAG 2.2 SC 2.4.11). */
export function keptInView(fields: EventFields, room: number, margin: number): Placed {
  const { refusal, name, number, focus } = fields;
  const field = focus === 'name' ? name : number;
  const tiers = [
    span(refusal ?? name, number),
    ...(refusal == null ? [] : [span(refusal, field)]),
    field,
  ];

  return tiers.find((tier) => fits(tier, room, margin)) ?? field;
}

export interface FieldsInScroll extends EventFields {
  /** The scroll view's height left in sight above Send code and the keys. */
  room: number;
  /** The offset the scroll sits at now. */
  offset: number;
  margin: number;
}

/** The offset that rests what the keys leave in view `margin` above Send code, or null when it already shows. Where only the field fits, it rests there even when it shows, so the other field is never half under Send code; where not even the field fits, its top shows. */
export function offsetAboveSend(at: FieldsInScroll): number | null {
  const { room, offset, margin } = at;
  const kept = keptInView(at, room, margin);
  const top = kept.contentY;
  const end = kept.contentY + kept.height;
  const y = Math.max(0, fits(kept, room, margin) ? end + margin - room : top - margin);
  const reachesNumber = end >= at.number.contentY + at.number.height;
  const shows = top >= offset && end + margin <= offset + room;
  if (y === offset || (shows && reachesNumber)) return null;

  return y;
}
