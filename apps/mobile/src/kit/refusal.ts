import { ApiError } from '@soirely/api-client';

/** A refusal shows the problem's title, as the web does; anything else gets the screen's own words. */
export function refusalTitle(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.title : fallback;
}
