import { type EventStatus } from '@soirely/api-client';
import {
  HOSTS_MAXIMUM,
  type HostErrors,
  type HostFocus,
  type HostRow,
  type HostsChange,
  hostCalled,
  keepsLastHost,
  movedHost,
  removedHost,
} from '@soirely/domain';
import { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { rowArrives, rowLeaves } from '../../../leaving.ts';
import { offButton } from '../../../offButton.ts';
import { FieldError } from './EventFields.tsx';
import { ADD_HOST_ID, describedBy, hostInputId } from './eventFieldOrder.ts';

/** Hosted by in Edit details (sc-6713): the names guests read, in order, each moved and removed in place. */
export function HostsSection({
  rows,
  errors,
  saved,
  busy,
  onRows,
  onLeave,
  onSay,
}: {
  rows: readonly HostRow[];
  errors: HostErrors;
  saved: { status: EventStatus; hosts: readonly string[] };
  busy: boolean;
  onRows: (rows: HostRow[], touched: number | null) => void;
  onLeave: (row: HostRow) => void;
  onSay: (line: string) => void;
}) {
  const { t } = useTranslation();
  const focusNext = useRef<HostFocus | null>(null);
  const nextKey = useRef(Math.max(0, ...rows.map((row) => row.key)) + 1);
  const arriving = useRef<number | null>(null);
  const latest = useRef(rows);
  const keepLast = keepsLastHost(saved, rows.length);

  useLayoutEffect(() => {
    latest.current = rows;
  }, [rows]);

  useLayoutEffect(() => {
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

  function changed(change: HostsChange | null): void {
    if (change == null) return;

    focusNext.current = change.focus;
    onRows(change.rows, null);
    onSay(change.said);
  }

  /** The row fades before it goes, so it is found by key in the rows as they are by then. */
  function remove(key: number, row: HTMLElement | null): void {
    rowLeaves(row, () => {
      const now = latest.current;
      flushSync(() =>
        changed(
          removedHost(
            now,
            now.findIndex((one) => one.key === key),
            t,
          ),
        ),
      );
    });
  }

  function add(): void {
    const key = nextKey.current;
    nextKey.current += 1;
    focusNext.current = { key, control: 'name' };
    arriving.current = key;
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
            const name = hostCalled(row, index, t);

            return (
              <li
                key={row.key}
                className="event-host"
                ref={(node) => {
                  if (node == null || arriving.current !== row.key) return;
                  arriving.current = null;
                  rowArrives(node);
                }}
              >
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
                        onClick={() => changed(movedHost(rows, index, -1, t))}
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
                        onClick={() => changed(movedHost(rows, index, 1, t))}
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
                        onClick={(click) => remove(row.key, click.currentTarget.closest('li'))}
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
