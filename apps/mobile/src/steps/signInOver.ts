/** Whether each Sign in has something under it, said by whatever opens it: a screen's options read the stack as it was before the push, so a Sign in pushed over a lone welcome would read as alone (sc-67606). */
let nextIsOver = false;
const decided = new Map<string, boolean>();

/** The next Sign in opens over the screen under it, or alone. */
export function signInOver(isOver: boolean): void {
  nextIsOver = isOver;
}

/** Whether the Sign in on this route opened over something: its opener's word, kept from the first time it is asked. */
export function opensOver(routeKey: string): boolean {
  const known = decided.get(routeKey);
  if (known != null) return known;

  const isOver = nextIsOver;
  nextIsOver = false;
  decided.set(routeKey, isOver);

  return isOver;
}
