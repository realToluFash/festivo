export interface MenuPlace {
  top: number;
  floor: number | null;
}

/** A `y` measured in the window, moved into a statusBarTranslucent Modal's frame, which starts behind the status bar where Android's window starts below it. */
export function inModal(y: number, origin: number): number {
  return y - origin;
}

/** A menu's top and floor, both given in measureInWindow's frame, moved into its Modal's. */
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
  return {
    top: inModal(under, origin) + below,
    floor: floor == null ? null : inModal(floor, origin),
  };
}
