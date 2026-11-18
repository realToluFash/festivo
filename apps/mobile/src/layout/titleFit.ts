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

/** sc-68417: Export and the + go together to a row under the title only where the title at its default size, they and the bell cannot share one line. Unlike `labelFits`, the bell counts: it stays on the title's row and takes its room. */
export function actionsUnder({ room, title, extra, plus, bell, gap }: TitleActions): boolean {
  if (unmeasured(room, title)) return false;
  const beside = [extra, plus, bell]
    .filter((width) => width > 0)
    .reduce((sum, width) => sum + gap + width, 0);

  return title + beside > room;
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
