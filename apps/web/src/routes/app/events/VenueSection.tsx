import { type AddressSuggestion } from '@soirely/api-client';
import { type VenueDraft } from '@soirely/domain';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { offField } from '../../../offField.ts';
import { FieldError } from './EventFields.tsx';
import { type Errors, describedBy } from './eventFieldOrder.ts';

const ASK_AFTER_MS = 250;

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
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [lookupDown, setLookupDown] = useState(false);
  const [offered, setOffered] = useState<{ zone: string; keep: string } | null>(null);
  const [announced, setAnnounced] = useState('');
  const asked = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const open = suggestions.length > 0;
  const offer = offered != null && offered.zone !== timeZone ? offered : null;

  function close(): void {
    setSuggestions([]);
    setActive(-1);
  }

  function type(address: string): void {
    const query = address.trim();
    const ask = ++asked.current;

    onVenue({ address, addressId: null });
    setOffered(null);
    window.clearTimeout(timer.current);

    if (query.length < 3) {
      close();
      return;
    }

    timer.current = window.setTimeout(() => {
      api.addressSuggestions(query).then(
        (found) => {
          if (ask !== asked.current) return;
          setLookupDown(false);
          setSuggestions(found);
          setActive(-1);
          setAnnounced(
            found.length === 0 ? '' : t('eventForm.venueSuggestionsFound', { count: found.length }),
          );
        },
        () => {
          if (ask !== asked.current) return;
          setLookupDown(true);
          close();
        },
      );
    }, ASK_AFTER_MS);
  }

  async function pick(suggestion: AddressSuggestion): Promise<void> {
    const ask = ++asked.current;
    const zoneBefore = timeZone;

    close();
    setAnnounced('');
    onVenue({
      address:
        suggestion.secondaryText == null
          ? suggestion.text
          : `${suggestion.text}, ${suggestion.secondaryText}`,
      addressId: suggestion.id,
    });

    try {
      const address = await api.address(suggestion.id);

      if (ask !== asked.current) return;
      onVenue({ address: address.formatted, addressId: suggestion.id });
      if (address.timeZone != null && address.timeZone !== zoneBefore)
        setOffered({ zone: address.timeZone, keep: zoneBefore });
    } catch {
      // The suggestion's own line stays, and the API saves it as typed if it cannot resolve it either.
    }
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' && open) {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      const chosen = suggestions[active];
      if (chosen != null) void pick(chosen);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
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
          onKeyDown={onKey}
          onBlur={close}
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
              onClick={() => void pick(suggestion)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void pick(suggestion);
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
                    setOffered(null);
                    document.getElementById('event-venue-address')?.focus();
                    setAnnounced(t('eventForm.venueZoneSet', { zone: offer.zone }));
                  }}
                >
                  {t('eventForm.venueZoneUse', { zone: offer.zone })}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    setOffered(null);
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
