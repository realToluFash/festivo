import { NOTHING_SEEN, type VenueDraft, addressLookup } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { useComboboxKeys } from '../../../comboboxKeys.ts';
import { offField } from '../../../offField.ts';
import { FieldError } from './EventFields.tsx';
import { type Errors, describedBy } from './eventFieldOrder.ts';

/** The form's Venue section (sc-3589): a name, and an address picked from the lookup's suggestions or typed. */
export function VenueSection({
  venue,
  errors,
  busy,
  timeZone,
  onVenue,
  onUseZone,
}: {
  venue: VenueDraft;
  errors: Errors;
  busy: boolean;
  timeZone: string;
  onVenue: (change: Partial<VenueDraft>) => void;
  onUseZone: (zone: string) => void;
}) {
  const { t } = useTranslation();
  const [seen, setSeen] = useState(NOTHING_SEEN);
  const [zoneSet, setZoneSet] = useState<string | null>(null);
  const [lookup] = useState(() =>
    addressLookup({
      suggest: (query) => api.addressSuggestions(query),
      resolve: (id) => api.address(id),
      onVenue,
      onSeen: setSeen,
    }),
  );

  useEffect(() => () => lookup.stop(), [lookup]);

  const { suggestions, down: lookupDown } = seen;
  const open = suggestions.length > 0;
  const { active, setActive, onKeyDown } = useComboboxKeys({
    count: suggestions.length,
    onPick: (index) => {
      const chosen = suggestions[index];
      if (chosen != null) void lookup.pick(chosen, timeZone);
    },
    onEscape: () => lookup.dismiss(),
  });
  const offer = seen.offered != null && seen.offered.zone !== timeZone ? seen.offered : null;
  const announced =
    zoneSet != null
      ? t('eventForm.venueZoneSet', { zone: zoneSet })
      : open
        ? t('eventForm.venueSuggestionsFound', { count: suggestions.length })
        : '';

  function type(address: string): void {
    setActive(-1);
    setZoneSet(null);
    lookup.type(address);
  }

  return (
    <section className="card" id="venue" aria-labelledby="event-venue">
      <h2 id="event-venue">{t('eventForm.venueHeading')}</h2>

      <div className="field">
        <label htmlFor="event-venue-name">
          {t('eventForm.venueName')} <span className="pill-quiet">{t('eventForm.optional')}</span>
        </label>
        <input
          id="event-venue-name"
          className={errors.venueName == null ? 'input' : 'input input-wrong'}
          type="text"
          value={venue.name}
          autoComplete="off"
          {...offField(busy)}
          aria-invalid={errors.venueName != null}
          aria-describedby={errors.venueName == null ? undefined : 'event-venue-name-error'}
          onChange={(event) => onVenue({ name: event.target.value })}
        />
        <FieldError id="event-venue-name-error" message={errors.venueName} />
      </div>

      <div className="field venue-address">
        <label htmlFor="event-venue-address">{t('eventForm.venueAddress')}</label>
        <input
          id="event-venue-address"
          className={errors.venueAddress == null ? 'input' : 'input input-wrong'}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="event-venue-suggestions"
          aria-activedescendant={active >= 0 ? `event-venue-suggestion-${active}` : undefined}
          value={venue.address}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          {...offField(busy)}
          aria-invalid={errors.venueAddress != null}
          aria-describedby={describedBy(
            errors.venueAddress == null ? null : 'event-venue-address-error',
            lookupDown ? 'event-venue-lookup-down' : null,
            'event-venue-address-hint',
          )}
          onChange={(event) => type(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => lookup.dismiss()}
        />
        <ul
          className="tz-list venue-suggestions"
          id="event-venue-suggestions"
          role="listbox"
          aria-label={t('eventForm.venueSuggestions')}
          hidden={!open}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`event-venue-suggestion-${index}`}
              className={index === active ? 'tz-option tz-option-active' : 'tz-option'}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void lookup.pick(suggestion, timeZone)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void lookup.pick(suggestion, timeZone);
              }}
            >
              <span>{suggestion.text}</span>
              {suggestion.secondaryText != null && (
                <span className="muted">{suggestion.secondaryText}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="visually-hidden" aria-live="polite">
          {announced}
        </p>
        <FieldError id="event-venue-address-error" message={errors.venueAddress} />
        {lookupDown && (
          <div className="notice notice-attention venue-lookup-down" id="event-venue-lookup-down">
            <span className="mark mark-attention mark-half" aria-hidden="true" />
            <p>{t('eventForm.venueLookupDown')}</p>
          </div>
        )}
        <p className="field-help" id="event-venue-address-hint">
          {t('eventForm.venueAddressHint')}
        </p>
      </div>

      <div aria-live="polite">
        {offer != null && (
          <div className="notice notice-attention venue-zone-offer">
            <div className="notice-body">
              <p className="notice-title">{t('eventForm.venueZoneOffer', { zone: offer.zone })}</p>
              <div className="event-form-actions">
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => {
                    onUseZone(offer.zone);
                    lookup.answered();
                    document.getElementById('event-venue-address')?.focus();
                    setZoneSet(offer.zone);
                  }}
                >
                  {t('eventForm.venueZoneUse', { zone: offer.zone })}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    lookup.answered();
                    document.getElementById('event-venue-address')?.focus();
                  }}
                >
                  {t('eventForm.venueZoneKeep', { zone: offer.keep })}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
