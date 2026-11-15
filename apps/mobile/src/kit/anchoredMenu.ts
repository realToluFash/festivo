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

/** The most a menu may grow, in its Modal's frame: from its top to its floor, or to `foot` with no floor; never past either, however little room that leaves. */
export function menuMost({ top, floor }: MenuPlace, foot: number): number {
  return Math.max((floor ?? foot) - top, 0);
}

export interface MenuSide {
  top: number;
  /** The most it may grow from `top`. */
  most: number;
  above: boolean;
}

/** `under`, `over` and `floor` in measureInWindow's frame, `ceiling` and `foot` in the Modal's; with `tall` unknown it goes below. */
export function menuSide({
  under,
  over,
  gap,
  floor,
  origin,
  ceiling,
  foot,
  tall,
  above,
}: {
  under: number;
  over: number;
  gap: number;
  floor: number | null;
  origin: number;
  ceiling: number;
  foot: number;
  tall: number | null;
  /** A side already taken for this button, kept while the menu stays open. */
  above?: boolean | undefined;
}): MenuSide {
  const place = menuInModal({ under, below: gap, floor, origin });
  const roomBelow = menuMost(place, foot);
  const below = { top: place.top, most: roomBelow, above: false };
  if (tall == null) return below;
  const edge = inModal(over, origin) - gap;
  const roomAbove = Math.max(edge - ceiling, 0);
  const goesAbove = above ?? (tall > roomBelow && roomAbove > roomBelow);
  if (!goesAbove) return below;

  return { top: edge - Math.min(tall, roomAbove), most: roomAbove, above: true };
}

/** Its head, its rows and its border above and below, uncapped; unknown until its rows are measured. */
export function menuTall(
  { head, content }: { head: number; content: number },
  edge: number,
): number | null {
  return content > 0 ? head + content + edge * 2 : null;
}

export interface HeldSide {
  /** Where its button was: a turn of the phone moves it, and a moved button is a new opening. */
  button: string;
  above: boolean;
}

export function menuButton(at: { x: number; top: number; y: number } | null): string | null {
  return at == null ? null : `${at.x},${at.top},${at.y}`;
}

export function keptSide(held: HeldSide | null, button: string | null): boolean | undefined {
  return held != null && held.button === button ? held.above : undefined;
}

/** Nothing once closed; the side taken, once it is measured at a button it was not held at; otherwise `held` itself. */
export function nextHeld(
  held: HeldSide | null,
  button: string | null,
  side: MenuSide,
  measured: boolean,
): HeldSide | null {
  if (button == null) return null;
  if (!measured || held?.button === button) return held;

  return { button, above: side.above };
}
