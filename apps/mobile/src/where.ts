let here: string | null = null;

/** The screen the person is on, null on Today: read by a change heard back in the foreground, which restarts onto it, and by a link that opens the screen already showing. */
export function noteWhere(path: string): void {
  here = path === '/' ? null : path;
}

export function whereNow(): string | null {
  return here;
}
