export interface MenuPlace {
  top: number;
  floor: number | null;
}

/** A menu's top and floor, given in measureInWindow's frame, moved into its Modal's, which starts behind the status bar where Android's window starts below it. */
export function menuInModal({
  under,
  below,
  floor,
  origin,
}: {
  under: number;
  below: number;
  floor: number | null;
  origin: number;
}): MenuPlace {
  return { top: under - origin + below, floor: floor == null ? null : floor - origin };
}
