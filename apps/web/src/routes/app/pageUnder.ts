import { createContext, type ReactNode, use } from 'react';
import { type Location } from 'react-router';

const DUE_NOW = '/app/due/';

export const PageUnderContext = createContext<ReactNode>(null);

/** Opening Due now from inside the desk keeps the page that was open under its dialog (sc-1331). */
export function stateFor(place: string, from: Location): { under: Location } | undefined {
  if (!place.startsWith(DUE_NOW)) return undefined;

  const under = underOf(from);
  if (under != null) return { under };

  return from.pathname.startsWith(DUE_NOW) ? undefined : { under: from };
}

export function underOf(location: Location): Location | null {
  if (!location.pathname.startsWith(DUE_NOW)) return null;

  const state: unknown = location.state;
  if (typeof state !== 'object' || state == null || !('under' in state)) return null;

  const { under } = state as { under: unknown };
  if (typeof under !== 'object' || under == null || !('pathname' in under)) return null;

  const { pathname } = under as { pathname: unknown };
  if (typeof pathname !== 'string' || !pathname.startsWith('/app') || pathname.startsWith(DUE_NOW))
    return null;

  return under as Location;
}

/** The page a person sees: under Due now, the page it opened over, or Today when it opened the desk. */
export function pathShown(location: Location): string {
  if (!location.pathname.startsWith(DUE_NOW)) return location.pathname;

  return underOf(location)?.pathname ?? '/app';
}

export function usePageUnder(): ReactNode {
  return use(PageUnderContext);
}
