/** Widths measured on the row as drawn; zero until measured. */
export interface TitleRow {
  room: number;
  title: number;
  extra: number;
  labelled: number;
  gap: number;
}

/** sc-51444: the primary keeps its label only when the title, anything beside it and the labelled primary all fit on one line. */
export function labelFits({ room, title, extra, labelled, gap }: TitleRow): boolean {
  if (unmeasured(room, title, labelled)) return true;
  const beside = extra > 0 ? extra + gap : 0;

  return title + gap + beside + labelled <= room;
}

/** Widths measured on Guests' title row as drawn; zero until measured, and zero for what the row does not draw. */
export interface TitleActions {
  room: number;
  title: number;
  extra: number;
  plus: number;
  bell: number;
  refreshing: number;
  gap: number;
}

/** sc-68417: Export and the + go together to a row under the title only where the title at its default size, they and the bell cannot share one line. Unlike `labelFits`, the bell and a tablet's refresh spinner count: they stay on the title's row and take its room. */
export function actionsUnder({
  room,
  title,
  extra,
  plus,
  bell,
  refreshing,
  gap,
}: TitleActions): boolean {
  if (unmeasured(room, title)) return false;
  const beside = [refreshing, extra, plus, bell]
    .filter((width) => width > 0)
    .reduce((sum, width) => sum + gap + width, 0);

  return title + beside > room;
}

/** sc-68417: a title laid out beside its actions broke inside a word once it could step down no further, so the sum above, from widths measured hidden, left it less room than it needs. A break at its start size is not one: it steps down next. Nor is one in a slot narrower than the title measured: that is the row's first layout, before the primary gives way, and the sum already answers it. Nor is one whose lines together fit the slot: they were laid out in a narrower box than the slot last measured, a frame the row passes through while it loads, and its slot catches up next. */
export function brokeInWord({
  lines,
  drawn,
  start,
  size,
  slot,
  title,
}: {
  lines: readonly { text: string; width: number }[];
  drawn: number;
  start: number;
  size: number;
  slot: number;
  title: number;
}): boolean {
  if (unmeasured(slot, title) || slot + 1 < title) return false;
  if (drawn >= start && drawn > size) return false;
  if (lines.reduce((sum, line) => sum + line.width, 0) <= slot) return false;

  return lines.slice(0, -1).some((line) => !/\s$/.test(line.text));
}

/** The row the title last broke on, once its lines say it broke there; the actions stay under it for as long as the row is that one (sc-68417). */
export function brokeOn({
  broke,
  row,
  under,
  ...laidOut
}: {
  broke: string | null;
  row: string;
  under: boolean;
  lines: readonly { text: string; width: number }[];
  drawn: number;
  start: number;
  size: number;
  slot: number;
  title: number;
}): string | null {
  if (under) return broke;

  return brokeInWord(laidOut) ? row : broke;
}

function unmeasured(...widths: number[]): boolean {
  return widths.some((width) => width <= 0);
}

/** The row's whole width, from the title's slot and whichever primary was drawn beside it, so the room is the same whether the labelled or the round primary took its share. A slot squeezed to nothing is measured, not unmeasured: the title has no room (sc-67708). */
export function rowRoom({
  slot,
  gap,
  drawn,
  labelled,
  round,
}: {
  slot: number | null;
  gap: number;
  drawn: 'labelled' | 'round';
  labelled: number;
  round: number;
}): number {
  if (slot == null) return 0;

  return slot + gap + (drawn === 'labelled' ? labelled : round);
}
