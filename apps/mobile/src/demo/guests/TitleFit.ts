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
  if (room <= 0 || title <= 0 || labelled <= 0) return true;
  const beside = extra > 0 ? extra + gap : 0;

  return title + gap + beside + labelled <= room;
}
