import { ApiError, type TimeZoneOption } from '@soirely/api-client';
import { exactZone, formerName, matchingZones, zoneLabel } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { useComboboxKeys } from '../../../comboboxKeys.ts';
import { FieldError } from '../../../components/FieldError.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { useStepFocus } from '../../../stepFocus.ts';
import { focusWhereSent, offField } from '../../../offField.ts';

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
  const locale = currentLocale();
  const [zones, setZones] = useState<TimeZoneOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<TimeZoneOption | null>(null);
  const [refocus, setRefocus] = useState(false);
  const changeButton = useRef<HTMLButtonElement>(null);
  const [savedLine, arriveAtSaved] = useStepFocus<HTMLDivElement>();

  // Change is back in the page only once the edit has ended (WCAG 2.4.3).
  useEffect(() => {
    if (!editing && refocus) changeButton.current?.focus();
  }, [editing, refocus]);

  // The API names the zones in the request's language, so a language change asks again (sc-1800).
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
  }, [locale]);

  const current = zones.find((zone) => zone.id === timezone);
  const label = timezone == null ? null : current == null ? timezone : zoneLabel(current);
  const savedZone = saved == null ? null : (zones.find((zone) => zone.id === saved.id) ?? saved);

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
            setSaved(zone);
            arriveAtSaved();
          }}
          onCancel={() => {
            setEditing(false);
            setRefocus(true);
          }}
        />
      ) : (
        <>
          <div className="current-value">
            <div className="current-value-text">
              <span className="current-value-label">{label ?? t('timeZone.unset')}</span>
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

          {savedZone != null && (
            <div className="status-done" tabIndex={-1} ref={savedLine}>
              <span className="mark mark-done" aria-hidden="true">
                ✓
              </span>
              <p>{t('timeZone.saved', { zone: zoneLabel(savedZone) })}</p>
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
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  // Held by id, so a pick reads in the language the list was last fetched in.
  const picked = pickedId == null ? null : (zones.find((zone) => zone.id === pickedId) ?? null);
  const showingPicked = picked != null;
  const shown = picked == null ? typed : zoneLabel(picked);
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
  const { active, setActive, onKeyDown } = useComboboxKeys({
    count: matches.length,
    onPick: (index) => {
      const chosen = matches[index];
      if (chosen != null) pick(chosen);
    },
    onEnter: () => void save(),
    onEscape: onCancel,
  });

  function pick(zone: TimeZoneOption): void {
    setPickedId(zone.id);
    setTyped(zoneLabel(zone));
    setActive(-1);
    setError(null);
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
    const land = focusWhereSent();

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
      land('tz-input');
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
          value={shown}
          {...offField(saving)}
          onChange={(event) => {
            setTyped(event.target.value);
            setPickedId(null);
            setActive(-1);
            setError(null);
          }}
          onKeyDown={saving ? undefined : onKeyDown}
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
        <button className="button" type="button" onClick={onCancel} disabled={saving}>
          {t('timeZone.cancel')}
        </button>
        <button
          className="button button-primary"
          type="button"
          aria-busy={saving}
          onClick={() => void save()}
        >
          {saving ? t('timeZone.saving') : t('timeZone.save')}
        </button>
      </div>
    </>
  );
}
