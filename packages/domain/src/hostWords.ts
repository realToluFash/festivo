import { EVENT_FORM_FIELDS, type EventFormField } from './events.ts';
import { type Translate } from './eventWords.ts';
import { HOST_NAME_MAXIMUM, hostNameOf, hostProblems } from './hosts.ts';

/** `key` follows a row through a move, so its field and its message move with it. */
export interface HostRow {
  key: number;
  name: string;
}

export type HostErrors = Partial<Record<number, string>>;

export type HostFocus = { key: number; control: 'name' | 'up' | 'down' } | 'add';

export interface HostsChange {
  rows: HostRow[];
  focus: HostFocus;
  said: string;
}

/** sc-6713's rules in the words both clients show, keyed by row. */
export function hostErrorsOf(rows: readonly HostRow[], t: Translate): HostErrors {
  const found: HostErrors = {};

  hostProblems(rows.map((row) => row.name)).forEach((problem, index) => {
    const row = rows[index];

    if (problem == null || row == null) return;

    found[row.key] =
      problem.problem === 'hostBlank'
        ? t('eventHosts.blank')
        : problem.problem === 'hostTooLong'
          ? t('eventHosts.tooLong', { most: HOST_NAME_MAXIMUM, length: problem.length })
          : t('eventHosts.duplicate', { name: problem.name });
  });

  return found;
}

const HOST_PATH = /^hosts\[(\d+)\]$/;

/** The server's refusals of the hosts, each under its row; one of the whole list goes under the last. */
export function hostRefusalsOf(
  refused: Record<string, string>,
  rows: readonly HostRow[],
): HostErrors {
  const found: HostErrors = {};

  for (const [path, message] of Object.entries(refused)) {
    const index = path === 'hosts' ? rows.length - 1 : Number(HOST_PATH.exec(path)?.[1]);
    const row = rows[index];
    if (row != null) found[row.key] ??= message;
  }

  return found;
}

export function hostRequiredOf(rows: readonly HostRow[], t: Translate): HostErrors | null {
  const first = rows[0];

  return first == null ? null : { [first.key]: t('eventHosts.lastHostRefused') };
}

/** The form's order: the name and type, then the hosts top to bottom, then the rest. */
export function firstRefusedOf(
  errors: Partial<Record<EventFormField, string | undefined>>,
  hostErrors: HostErrors,
  rows: readonly HostRow[],
): { field: EventFormField } | { host: number } | null {
  const field = EVENT_FORM_FIELDS.find((one) => errors[one] != null) ?? null;
  const host = rows.find((row) => hostErrors[row.key] != null);

  if (field != null && (field === 'name' || field === 'type' || host == null)) return { field };

  return host == null ? null : { host: host.key };
}

/** What a screen reader calls a row: its name, or "Host n" while it is empty. */
export function hostCalled(row: HostRow, index: number, t: Translate): string {
  const name = hostNameOf(row.name);

  return name === '' ? t('eventHosts.label', { position: index + 1 }) : name;
}

/** Focus stays on the button pressed, or on the other arrow once the row reaches the top or the bottom. */
export function movedHost(
  rows: readonly HostRow[],
  index: number,
  by: -1 | 1,
  t: Translate,
): HostsChange | null {
  const row = rows[index];
  const to = index + by;

  if (row == null || to < 0 || to >= rows.length) return null;

  const moved = [...rows];
  moved.splice(index, 1);
  moved.splice(to, 0, row);

  const pressed = by < 0 ? 'up' : 'down';
  const atEnd = to === 0 || to === rows.length - 1;

  return {
    rows: moved,
    focus: { key: row.key, control: atEnd ? (pressed === 'up' ? 'down' : 'up') : pressed },
    said: t('eventHosts.moved', {
      name: hostCalled(row, index, t),
      position: to + 1,
      count: rows.length,
    }),
  };
}

/** Focus goes to the next row's name, else Add a host. */
export function removedHost(
  rows: readonly HostRow[],
  index: number,
  t: Translate,
): HostsChange | null {
  const row = rows[index];

  if (row == null) return null;

  const left = rows.filter((one) => one.key !== row.key);
  const next = left[index];

  return {
    rows: left,
    focus: next == null ? 'add' : { key: next.key, control: 'name' },
    said: t('eventHosts.removed', { name: hostCalled(row, index, t) }),
  };
}

/** Arriving from Make live's Add who is hosting: the first host's name, else Add a host. */
export function hostsArrival(rows: readonly HostRow[]): HostFocus {
  const first = rows[0];

  return first == null ? 'add' : { key: first.key, control: 'name' };
}
