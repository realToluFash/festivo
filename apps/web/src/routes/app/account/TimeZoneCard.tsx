import { ApiError, type TimeZoneOption } from '@soirely/api-client';
import { exactZone, formerName, matchingZones, zoneLabel } from '@soirely/domain';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { FieldError } from '../../../components/FieldError.tsx';

/** How many rows the list shows at once; the search narrows the rest. */
const SHOWN = 50;

/** Your account > Account, the time zone the times sent to this person are written in (sc-868). */
export function TimeZoneCard({
  timezone,
  onSaved,
}: {
  timezone: string | null;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [zones, setZones] = useState<TimeZoneOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [refocus, setRefocus] = useState(false);
  const changeButton = useRef<HTMLButtonElement>(null);

  // Change is back in the page only once the edit has ended (WCAG 2.4.3).
  useEffect(() => {
    if (!editing && refocus) changeButton.current?.focus();
  }, [editing, refocus]);

  useEffect(() => {
    let live = true;

    api
      .timezones()
      .then((list) => {
        if (live) setZones(list);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  const current = zones.find((zone) => zone.id === timezone);
  const label = timezone == null ? null : current == null ? timezone : zoneLabel(current);

  return (
    <section className="card" aria-labelledby="tz-title">
      <h2 id="tz-title">{t('timeZone.title')}</h2>
      <p>{t('timeZone.intro')}</p>

      {editing ? (
        <Choosing
          zones={zones}
          now={label}
          onSaved={async (zone) => {
            await onSaved();
            setEditing(false);
            setSaved(zoneLabel(zone));
            setRefocus(true);
          }}
          onCancel={() => {
            setEditing(false);
            setRefocus(true);
          }}
        />
      ) : (
        <>
          <div className="tz-current">
            <div className="tz-current-text">
              <span className="tz-current-label">{label ?? t('timeZone.unset')}</span>
              {timezone != null && <span className="muted">{timezone.replace(/_/g, ' ')}</span>}
            </div>
            <button
              className="button"
              type="button"
              id="tz-change"
              ref={changeButton}
              onClick={() => {
                setSaved(null);
                setRefocus(false);
                setEditing(true);
              }}
            >
              {t('timeZone.change')}
            </button>
          </div>

          {saved != null && (
            <div className="status-done" role="status">
              <span className="mark mark-done" aria-hidden="true">
                ✓
              </span>
              <p>{t('timeZone.saved', { zone: saved })}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** A searchable list, worked from the keyboard; only a listed zone is ever sent. */
function Choosing({
  zones,
  now,
  onSaved,
  onCancel,
}: {
  zones: readonly TimeZoneOption[];
  now: string | null;
  onSaved: (zone: TimeZoneOption) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<TimeZoneOption | null>(null);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const showingPicked = picked != null && typed === zoneLabel(picked);
  const matches = showingPicked ? [] : matchingZones(zones, typed).slice(0, SHOWN);
  // "India · was Calcutta" only for the row a former name found (sc-986).
  const rowDetail = (zone: TimeZoneOption): string => {
    const was = formerName(zone, typed);

    if (was == null) return zone.country;

    return zone.country === ''
      ? t('timeZone.was', { name: was })
      : t('timeZone.countryWas', { country: zone.country, name: was });
  };
  const noneMatch = typed.trim() !== '' && !showingPicked && matches.length === 0;

  function pick(zone: TimeZoneOption): void {
    setPicked(zone);
    setTyped(zoneLabel(zone));
    setActive(-1);
    setError(null);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' && matches.length > 0) {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === 'ArrowUp' && matches.length > 0) {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = matches[active];
      if (chosen != null) pick(chosen);
      else void save();
    } else if (event.key === 'Escape') {
      onCancel();
    }
  }

  async function save(): Promise<void> {
    if (saving) return;

    const zone = showingPicked ? picked : exactZone(zones, typed);
    if (zone == null) {
      setError(
        typed.trim() === '' || matches.length > 0
          ? t('timeZone.choose')
          : t('timeZone.chooseNoMatch', { typed: typed.trim() }),
      );
      input.current?.focus();
      return;
    }

    setSaving(true);

    try {
      await api.setTimezone(zone.id);
      await onSaved(zone);
    } catch (refusal) {
      setSaving(false);
      setError(
        refusal instanceof ApiError && refusal.status === 422
          ? t('timeZone.refused')
          : t('timeZone.failed'),
      );
    }
  }

  const describedBy = error == null ? 'tz-help' : 'tz-err tz-help';

  return (
    <>
      <div className="field">
        <label htmlFor="tz-input">{t('timeZone.find')}</label>
        <span className="field-help" id="tz-help">
          {t('timeZone.help', { now: now ?? t('timeZone.nowUnset') })}
        </span>
        <input
          className={error == null ? 'input' : 'input input-wrong'}
          id="tz-input"
          ref={input}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={matches.length > 0}
          aria-controls="tz-list"
          aria-activedescendant={active >= 0 ? `tz-opt-${active}` : undefined}
          aria-invalid={error != null}
          aria-describedby={describedBy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t('timeZone.placeholder')}
          value={typed}
          disabled={saving}
          onChange={(event) => {
            setTyped(event.target.value);
            setPicked(null);
            setActive(-1);
            setError(null);
          }}
          onKeyDown={onKey}
        />

        {matches.length > 0 && (
          <ul className="tz-list" id="tz-list" role="listbox" aria-label={t('timeZone.listLabel')}>
            {matches.map((zone, index) => (
              <li
                key={zone.id}
                id={`tz-opt-${index}`}
                className={index === active ? 'tz-option tz-option-active' : 'tz-option'}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(zone)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') pick(zone);
                }}
              >
                <span>{zoneLabel(zone)}</span>
                <span className="muted">{rowDetail(zone)}</span>
              </li>
            ))}
          </ul>
        )}

        {noneMatch && error == null && (
          <p className="muted" role="status">
            {t('timeZone.noneMatch', { typed: typed.trim() })}
          </p>
        )}

        {error != null && <FieldError id="tz-err" message={error} />}
      </div>

      <div className="actions">
        <button
          className="button button-primary"
          type="button"
          aria-busy={saving}
          onClick={() => void save()}
        >
          {saving ? t('timeZone.saving') : t('timeZone.save')}
        </button>
        <button className="button" type="button" onClick={onCancel} disabled={saving}>
          {t('timeZone.cancel')}
        </button>
      </div>
    </>
  );
}
