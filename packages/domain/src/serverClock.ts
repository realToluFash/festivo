/** The server's time, from each response's `Date` header (RFC 9110 §6.6.1): the device clock is never trusted (sc-3585). */
export interface ServerClock {
  /** Re-measures the offset; a missing or unreadable header keeps the last one. */
  observe(date: string | null): void;
  now(): Date;
}

export function createServerClock(device: () => number = () => Date.now()): ServerClock {
  let offset = 0;

  return {
    observe(date) {
      const server = date == null ? Number.NaN : Date.parse(date);

      if (!Number.isNaN(server)) offset = server - device();
    },
    now: () => new Date(device() + offset),
  };
}

/** The one both clients read, fed by the API client on every response. */
export const serverClock = createServerClock();
