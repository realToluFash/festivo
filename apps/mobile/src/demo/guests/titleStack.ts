/** Widths measured on Guests' title row as drawn; zero until measured. */
export interface TitleActions {
  room: number;
  title: number;
  extra: number;
  plus: number;
  bell: number;
  gap: number;
}

/** sc-68417: Export and the + go together to a row under the title only where the title, they and the bell cannot share one line. */
export function actionsUnder({ room, title, extra, plus, bell, gap }: TitleActions): boolean {
  if (room <= 0 || title <= 0) return false;
  const ends = [extra, plus, bell].filter((width) => width > 0);
  const beside = ends.reduce((sum, width) => sum + gap + width, 0);

  return title + beside > room;
}
