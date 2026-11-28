let here: string | null = null;
let hereWithQuery: string | null = null;

/** The screen the person is on, null on Today: read by a change heard back in the foreground, which restarts onto it. The query rides along for a link that opens the place already showing. */
export function noteWhere(path: string, query = ''): void {
  here = path === '/' ? null : path;
  hereWithQuery = query === '' ? here : `${path}?${query}`;
}

export function whereNow(): string | null {
  return here;
}

export function wherePlaceNow(): string | null {
  return hereWithQuery;
}
