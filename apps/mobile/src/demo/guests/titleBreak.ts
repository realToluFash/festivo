/** A title laid out beside its actions that broke inside its word at the smallest size it may take: the widths the fit sum was given were narrower than the ones the device laid out (sc-68417). A break at its start size is not one, since it steps down next. */
export function brokeInWord({
  lines,
  drawn,
  start,
  size,
}: {
  lines: readonly { text: string }[];
  drawn: number;
  start: number;
  size: number;
}): boolean {
  if (drawn >= start && drawn > size) return false;

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
  lines: readonly { text: string }[];
  drawn: number;
  start: number;
  size: number;
}): string | null {
  if (under) return broke;

  return brokeInWord(laidOut) ? row : broke;
}
