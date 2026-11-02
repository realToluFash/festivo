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
