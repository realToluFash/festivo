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
  gap: number;
}

/** sc-68417: Export and the + go together to a row under the title only where the title at its default size, they and the bell cannot share one line. Unlike `labelFits`, the bell counts: it stays on the title's row and takes its room. Refreshing… never counts: it gives way to them (sc-71821). */
export function actionsUnder({ room, title, extra, plus, bell, gap }: TitleActions): boolean {
  if (unmeasured(room, title)) return false;
  const beside = [extra, plus, bell]
    .filter((width) => width > 0)
    .reduce((sum, width) => sum + gap + width, 0);

  return title + beside > room;
}

/** sc-71821: the room the title steps down in beside Export, as if Export were at its widest, the size it draws under the title's start. Export is capped by the size the title draws, so a title sized from Export as drawn would grow, Export with it, and break or step down again: sized from its widest, the title takes one size and Export only ever has room to spare. */
export function titleRoomBeside({
  slot,
  extra,
  widest,
}: {
  /** The title's slot as laid out. */
  slot: number;
  /** Export as drawn beside it; zero where it is not on the row. */
  extra: number;
  /** Export under the title's start; zero until measured, when the slot is taken as it is. */
  widest: number;
}): number {
  if (unmeasured(slot, extra, widest)) return slot;

  return Math.max(0, slot - Math.max(0, widest - extra));
}

/** sc-72136: a dialog's Cancel stays beside its title only where the title's longest word, at the size the title draws alone, the gap and Cancel fit the row; the title's size never depends on Cancel. */
export function cancelUnder({
  room,
  widest,
  cancel,
  gap,
}: {
  room: number;
  widest: number;
  cancel: number;
  gap: number;
}): boolean {
  if (unmeasured(room, widest, cancel)) return false;

  return widest + gap + cancel > room;
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

/** The row a break latches on: its width, the title and the text size. Refreshing… is not in it, so a status coming or going never latches a break (sc-68417, sc-71821). */
export function titleRowKey({
  room,
  title,
  fontScale,
}: {
  room: number;
  title: string;
  fontScale: number;
}): string {
  return `${room}|${title}|${fontScale}`;
}

/** Widths measured on a row as drawn without Refreshing…; zero until measured. */
export interface StatusRow {
  room: number;
  /** What leads the row as drawn without the status: the title at the size it draws, or the Back pill whole. */
  lead: number;
  /** The controls after it, only those the row draws: Export, the +, the bell. */
  ends: readonly number[];
  status: number;
  gap: number;
}

/** sc-71821: Refreshing… keeps its place on a row only in the room left once the row's lead and its controls are placed as if it were not there; until every width is measured it takes its own line, so it never takes room from them. */
export function statusFits({ room, lead, ends, status, gap }: StatusRow): boolean {
  if (unmeasured(room, lead, status, ...ends)) return false;

  return lead + ends.reduce((sum, width) => sum + gap + width, 0) + gap + status <= room;
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
