import { ApiError } from '@soirely/api-client';

/** A refusal shows the problem's title, as the web does; anything else gets the screen's own words. */
export function refusalTitle(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.title : fallback;
}

/** The violation on the field the screen asked about says why; without one, the title does. */
export function refusalFor(error: unknown, field: string, fallback: string): string {
  const violation =
    error instanceof ApiError
      ? error.problem.violations?.find((one) => one.propertyPath === field)
      : undefined;

  return violation?.message ?? refusalTitle(error, fallback);
}

/** The first violation, then the detail, then the title; the screen's own words when the API never answered or failed itself. */
export function refusalSaid(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) return fallback;
  const { violations, detail, title } = error.problem;

  return violations?.[0]?.message ?? detail ?? title;
}
