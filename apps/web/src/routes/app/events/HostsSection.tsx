import { type EventStatus } from '@soirely/api-client';
import { HOSTS_MAXIMUM, hostNameOf, keepsLastHost } from '@soirely/domain';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { offButton } from '../../../offButton.ts';
import { FieldError } from './EventFields.tsx';
import { ADD_HOST_ID, describedBy, hostInputId } from './eventFieldOrder.ts';

/** `key` follows a row through a move, so its field and its message move with it. */
export interface HostRow {
  key: number;
  name: string;
}

export type HostErrors = Partial<Record<number, string>>;

type Control = 'name' | 'up' | 'down';

/** Hosted by in Edit details (sc-6713): the names guests read, in order, each moved and removed in place. */
export function HostsSection({
  rows,
  errors,
  status,
  busy,
  onRows,
  onLeave,
  onSay,
}: {
  rows: readonly HostRow[];
  errors: HostErrors;
  status: EventStatus;
  busy: boolean;
  onRows: (rows: HostRow[], touched: number | null) => void;
  onLeave: (row: HostRow) => void;
  onSay: (line: string) => void;
}) {
  const { t } = useTranslation();
  const focusNext = useRef<{ key: number; control: Control } | 'add' | null>(null);
  const nextKey = useRef(Math.max(0, ...rows.map((row) => row.key)) + 1);
  const keepLast = keepsLastHost(status, rows.length);

  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;

    if (next == null) return;

    const id =
      next === 'add'
        ? ADD_HOST_ID
        : next.control === 'name'
          ? `event-host-${next.key}`
          : `event-host-${next.key}-${next.control}`;

    document.getElementById(id)?.focus();
  }, [rows]);

  const named = (row: HostRow, index: number): string =>
    hostNameOf(row.name) === ''
      ? t('eventHosts.label', { position: index + 1 })
      : hostNameOf(row.name);

  function move(index: number, by: -1 | 1): void {
    const row = rows[index];
    const to = index + by;

    if (row == null || to < 0 || to >= rows.length) return;

    const moved = [...rows];
    moved.splice(index, 1);
    moved.splice(to, 0, row);

    const pressed: Control = by < 0 ? 'up' : 'down';
    const atEnd = to === 0 || to === rows.length - 1;
    focusNext.current = {
      key: row.key,
      control: atEnd ? (pressed === 'up' ? 'down' : 'up') : pressed,
    };
    onRows(moved, null);
    onSay(t('eventHosts.moved', { name: named(row, index), position: to + 1, count: rows.length }));
  }

  function remove(index: number): void {
    const row = rows[index];

    if (row == null) return;

    const left = rows.filter((one) => one.key !== row.key);
    const next = left[index];
    focusNext.current = next == null ? 'add' : { key: next.key, control: 'name' };
    onRows(left, null);
    onSay(t('eventHosts.removed', { name: named(row, index) }));
  }

  function add(): void {
    const key = nextKey.current;
    nextKey.current += 1;
    focusNext.current = { key, control: 'name' };
    onRows([...rows, { key, name: '' }], null);
  }

  return (
    <section className="card" aria-labelledby="event-hosts" id="hosts">
      <div className="event-hosts-head">
        <h2 id="event-hosts">{t('eventHosts.heading')}</h2>
        <p className="field-help">{t('eventHosts.explainer')}</p>
      </div>

      {rows.length === 0 ? (
        <p className="notice notice-quiet event-hosts-none">{t('eventHosts.none')}</p>
      ) : (
        <ol className="event-hosts">
          {rows.map((row, index) => {
            const id = hostInputId(row);
            const error = errors[row.key];
            const name = named(row, index);

            return (
              <li key={row.key} className="event-host">
                <label htmlFor={id}>{t('eventHosts.label', { position: index + 1 })}</label>
                <div className="event-host-line">
                  <textarea
                    id={id}
                    className={
                      error == null ? 'input event-host-name' : 'input event-host-name input-wrong'
                    }
                    rows={1}
                    value={row.name}
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={busy}
                    aria-invalid={error != null}
                    aria-describedby={describedBy(
                      error == null ? null : `${id}-error`,
                      keepLast ? `${id}-kept` : null,
                    )}
                    onChange={(event) =>
                      onRows(
                        rows.map((one) =>
                          one.key === row.key ? { ...one, name: event.target.value } : one,
                        ),
                        row.key,
                      )
                    }
                    onBlur={() => onLeave(row)}
                  />
                  <div className="event-host-controls">
                    {index === 0 ? (
                      <span className="event-host-gap" aria-hidden="true" />
                    ) : (
                      <button
                        id={`${id}-up`}
                        type="button"
                        className="button event-host-arrow"
                        aria-label={t('eventHosts.moveUp', { name })}
                        {...offButton(busy, { dim: false })}
                        onClick={() => move(index, -1)}
                      >
                        <span aria-hidden="true">↑</span>
                      </button>
                    )}
                    {index === rows.length - 1 ? (
                      <span className="event-host-gap" aria-hidden="true" />
                    ) : (
                      <button
                        id={`${id}-down`}
                        type="button"
                        className="button event-host-arrow"
                        aria-label={t('eventHosts.moveDown', { name })}
                        {...offButton(busy, { dim: false })}
                        onClick={() => move(index, 1)}
                      >
                        <span aria-hidden="true">↓</span>
                      </button>
                    )}
                    {!keepLast && (
                      <button
                        type="button"
                        className="button"
                        aria-label={t('eventHosts.removeNamed', { name })}
                        {...offButton(busy, { dim: false })}
                        onClick={() => remove(index)}
                      >
                        {t('eventHosts.remove')}
                      </button>
                    )}
                  </div>
                </div>
                <FieldError id={`${id}-error`} message={error} />
                {keepLast && (
                  <p className="field-help" id={`${id}-kept`}>
                    {t('eventHosts.lastHost')}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {rows.length >= HOSTS_MAXIMUM ? (
        <p className="field-help">{t('eventHosts.most', { most: HOSTS_MAXIMUM })}</p>
      ) : (
        <button
          id={ADD_HOST_ID}
          type="button"
          className="button event-hosts-add"
          {...offButton(busy, { dim: false })}
          onClick={add}
        >
          {t('eventHosts.add')}
        </button>
      )}
    </section>
  );
}
