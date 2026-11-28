import { type AddressSuggestion } from '@soirely/api-client';
import {
  HOSTS_MAXIMUM,
  NOTHING_SEEN,
  OSM_COPYRIGHT,
  STADIA_ATTRIBUTION,
  type EventFormField,
  type HostErrors,
  type HostRow,
  type VenueDraft,
  addressLookup,
  hostCalled,
  movedHost,
  removedHost,
} from '@soirely/domain';
import { type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { useComboboxKeys } from '../../../comboboxKeys.ts';
import { Alert, EditText, Quiet } from '../../../components/EventPageParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { RowWords, TextAction } from '../../../components/SettingsParts.tsx';
import { offField } from '../../../offField.ts';

type Errors = { [Field in EventFormField]?: string | undefined };

/** Hosted by's rows, shared by its part and New event: the names guests read, in order, at most six, each moved and removed in place. */
export function HostFields({
  rows,
  errors,
  keep,
  off = false,
  inputId,
  onRows,
  onEdited,
  onLeave,
}: {
  rows: readonly HostRow[];
  errors: HostErrors;
  /** A live event keeps its last host. */
  keep: boolean;
  off?: boolean;
  inputId: (row: { key: number }) => string;
  onRows: (rows: HostRow[]) => void;
  onEdited: (key: number) => void;
  onLeave?: (row: HostRow) => void;
}) {
  const { t } = useTranslation();
  const [said, setSaid] = useState('');
  const nextKey = useRef(Math.max(0, ...rows.map((row) => row.key)) + 1);
  const focusNext = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (focusNext.current == null) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  return (
    <>
      <p className="desk-line">{t('eventHosts.explainer')}</p>
      <ol className="ev-hosts">
        {rows.map((row, index) => {
          const error = errors[row.key] ?? null;
          const alone = rows.length === 1;
          const called = hostCalled(row, index, t);

          return (
            <li key={row.key} className="ev-host">
              <div className="ev-host-head">
                <label htmlFor={inputId(row)} className="desk-label">
                  {t('eventHosts.label', { position: index + 1 })}
                </label>
                {!(alone && keep) && !off && (
                  <button
                    type="button"
                    className="desk-text"
                    aria-label={t('eventHosts.removeNamed', { name: called })}
                    onClick={() => {
                      const change = alone ? null : removedHost(rows, index, t);

                      if (change == null) {
                        onRows([{ key: nextKey.current++, name: '' }]);
                        setSaid(t('eventHosts.removed', { name: called }));
                      } else {
                        onRows(change.rows);
                        setSaid(change.said);
                      }
                      const before = rows[Math.max(0, index - 1)];
                      focusNext.current =
                        alone || before == null
                          ? null
                          : inputId(index === 0 ? (rows[1] ?? before) : before);
                    }}
                  >
                    {t('eventHosts.remove')}
                  </button>
                )}
              </div>
              <div className="ev-host-line">
                <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
                  <input
                    id={inputId(row)}
                    type="text"
                    value={row.name}
                    spellCheck={false}
                    autoComplete="off"
                    {...offField(off)}
                    aria-invalid={error != null}
                    aria-describedby={error == null ? undefined : `${inputId(row)}-error`}
                    onChange={(change) => {
                      onRows(
                        rows.map((one) =>
                          one.key === row.key ? { ...one, name: change.target.value } : one,
                        ),
                      );
                      onEdited(row.key);
                    }}
                    onBlur={() => onLeave?.(row)}
                  />
                </div>
                {!alone && !off && (
                  <>
                    <button
                      type="button"
                      className="ev-round"
                      aria-label={t('eventHosts.moveUp', { name: called })}
                      aria-disabled={index === 0}
                      onClick={() => {
                        const change = index > 0 ? movedHost(rows, index, -1, t) : null;
                        if (change == null) return;
                        onRows(change.rows);
                        setSaid(change.said);
                      }}
                    >
                      <Glyph name="chevup" size={18} weight={2.4} />
                    </button>
                    <button
                      type="button"
                      className="ev-round"
                      aria-label={t('eventHosts.moveDown', { name: called })}
                      aria-disabled={index === rows.length - 1}
                      onClick={() => {
                        const change =
                          index < rows.length - 1 ? movedHost(rows, index, 1, t) : null;
                        if (change == null) return;
                        onRows(change.rows);
                        setSaid(change.said);
                      }}
                    >
                      <Glyph name="chevdown" size={18} weight={2.4} />
                    </button>
                  </>
                )}
              </div>
              {error != null && (
                <p id={`${inputId(row)}-error`} className="desk-error">
                  <Glyph name="alert" size={15} weight={2.2} />
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {rows.length === 1 && keep && <p className="desk-note">{t('eventHosts.lastHost')}</p>}
      {rows.length >= HOSTS_MAXIMUM ? (
        <p className="desk-note">{t('eventHosts.most', { most: HOSTS_MAXIMUM })}</p>
      ) : (
        !off && (
          <TextAction
            label={t('eventHosts.add')}
            before="plus"
            onClick={() => {
              const key = nextKey.current++;
              onRows([...rows, { key, name: '' }]);
              focusNext.current = inputId({ key });
            }}
          />
        )
      )}
      <p className="desk-unseen" role="status">
        {said}
      </p>
    </>
  );
}

/** The venue's name, its address with suggestions from 3 characters, and the arrival note, shared by its part and New event; a venue in another zone offers it. */
export function VenueFields({
  venue,
  errors,
  zone,
  over = false,
  off = false,
  ids,
  onVenue,
  onUseZone,
}: {
  venue: VenueDraft;
  errors: Errors;
  zone: string;
  /** An event that is over offers no zone. */
  over?: boolean;
  off?: boolean;
  /** Where focus lands on a refusal: the name, the address and the note. */
  ids?: { name: string; address: string; note: string };
  /** The address lookup keeps the first one it is given, so it updates through state setters only. */
  onVenue: (change: Partial<VenueDraft>) => void;
  onUseZone: (zone: string) => void;
}) {
  const [zoneSet, setZoneSet] = useState<string | null>(null);
  const [seen, setSeen] = useState(NOTHING_SEEN);
  const [lookup] = useState(() =>
    addressLookup({
      suggest: (query) => api.addressSuggestions(query),
      resolve: (address) => api.address(address),
      onVenue,
      onSeen: setSeen,
    }),
  );
  const offer = seen.offered != null && seen.offered.zone !== zone && !over ? seen.offered : null;

  useEffect(() => () => lookup.stop(), [lookup]);

  return (
    <VenueFieldsView
      venue={venue}
      errors={errors}
      off={off}
      {...(ids == null ? {} : { ids })}
      suggestions={seen.suggestions}
      down={seen.down}
      offer={offer}
      zoneSet={zoneSet}
      onVenue={onVenue}
      onType={(address) => {
        setZoneSet(null);
        lookup.type(address);
      }}
      onDismiss={() => lookup.dismiss()}
      onPick={(chosen) => void lookup.pick(chosen, zone)}
      onUseZone={(chosen) => {
        onUseZone(chosen);
        setZoneSet(chosen);
        lookup.answered();
      }}
      onKeepZone={() => lookup.answered()}
    />
  );
}

/** What Venue shows, whoever looks the address up: the product asks the API, the demo its sample venues. */
export function VenueFieldsView({
  venue,
  errors,
  off = false,
  ids,
  withNote = true,
  nameRef,
  addressRef,
  suggestions,
  down,
  offer,
  zoneSet,
  onVenue,
  onType,
  onDismiss,
  onPick,
  onUseZone,
  onKeepZone,
}: {
  venue: VenueDraft;
  errors: Errors;
  off?: boolean;
  ids?: { name: string; address: string; note: string };
  withNote?: boolean;
  nameRef?: RefObject<HTMLInputElement | null>;
  addressRef?: RefObject<HTMLInputElement | null>;
  suggestions: readonly AddressSuggestion[];
  down: boolean;
  offer: { zone: string; keep: string } | null;
  zoneSet: string | null;
  onVenue: (change: Partial<VenueDraft>) => void;
  onType: (address: string) => void;
  onDismiss: () => void;
  onPick: (chosen: AddressSuggestion) => void;
  onUseZone: (zone: string) => void;
  onKeepZone: () => void;
}) {
  const { t } = useTranslation();
  const made = useId();
  const id = ids?.address ?? made;
  const noteId = ids?.note ?? `${made}-note`;
  const own = useRef<HTMLInputElement>(null);
  const field = addressRef ?? own;
  const { active, setActive, onKeyDown } = useComboboxKeys({
    count: suggestions.length,
    onPick: (index) => {
      const chosen = suggestions[index];
      if (chosen != null) onPick(chosen);
    },
    onEscape: onDismiss,
  });

  return (
    <>
      <EditText
        {...(ids == null ? {} : { id: ids.name })}
        {...(nameRef == null ? {} : { inputRef: nameRef })}
        label={t('eventForm.venueName')}
        optional
        value={venue.name}
        error={errors.venueName ?? null}
        input={{ autoComplete: 'off', ...offField(off) }}
        onChange={(name) => onVenue({ name })}
      />
      <AddressField
        id={id}
        value={venue.address}
        error={errors.venueAddress ?? null}
        inputRef={field}
        off={off}
        suggestions={suggestions}
        down={down}
        active={active}
        onKeyDown={onKeyDown}
        onType={(address) => {
          setActive(-1);
          onType(address);
        }}
        onDismiss={onDismiss}
        onPick={(index) => {
          const chosen = suggestions[index];
          if (chosen != null) onPick(chosen);
        }}
      />
      {withNote && (
        <div className="desk-field">
          <label htmlFor={noteId} className="desk-label">
            {t('eventForm.arrivalNote')}
            <span className="ev-optional">{` · ${t('eventForm.optional')}`}</span>
          </label>
          <div
            className={
              errors.arrivalNote == null ? 'desk-box ev-note-box' : 'desk-box ev-note-box is-wrong'
            }
          >
            <textarea
              id={noteId}
              rows={4}
              value={venue.note}
              {...offField(off)}
              aria-invalid={errors.arrivalNote != null}
              aria-describedby={
                errors.arrivalNote == null ? `${noteId}-help` : `${noteId}-error ${noteId}-help`
              }
              onChange={(change) => onVenue({ note: change.target.value })}
            />
          </div>
          {errors.arrivalNote != null && (
            <p id={`${noteId}-error`} className="desk-error">
              <Glyph name="alert" size={15} weight={2.2} />
              {errors.arrivalNote}
            </p>
          )}
          <p id={`${noteId}-help`} className="desk-help">
            {t('eventForm.arrivalNoteHint')}
          </p>
        </div>
      )}
      {offer != null && (
        <Quiet
          action={
            <div className="ev-pair">
              <TextAction
                label={t('eventForm.venueZoneUse', { zone: offer.zone })}
                onClick={() => {
                  onUseZone(offer.zone);
                  field.current?.focus();
                }}
              />
              <TextAction
                label={t('eventForm.venueZoneKeep', { zone: offer.keep })}
                onClick={() => {
                  onKeepZone();
                  field.current?.focus();
                }}
              />
            </div>
          }
        >
          {t('eventForm.venueZoneOffer', { zone: offer.zone })}
        </Quiet>
      )}
      {zoneSet != null && (
        <p className="ev-said" role="status">
          {t('eventForm.venueZoneSet', { zone: zoneSet })}
        </p>
      )}
    </>
  );
}

function AddressField({
  id,
  value,
  error,
  inputRef,
  off,
  suggestions,
  down,
  active,
  onKeyDown,
  onType,
  onDismiss,
  onPick,
}: {
  id: string;
  value: string;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  off: boolean;
  suggestions: readonly AddressSuggestion[];
  down: boolean;
  active: number;
  onKeyDown: ReturnType<typeof useComboboxKeys>['onKeyDown'];
  onType: (address: string) => void;
  onDismiss: () => void;
  onPick: (index: number) => void;
}) {
  const { t } = useTranslation();
  const creditRef = useRef<HTMLParagraphElement>(null);
  const closeUnlessOn = (keepOnField: boolean) => () =>
    window.setTimeout(() => {
      if (!document.hasFocus()) return;
      const now = document.activeElement;
      const onCredit = now != null && creditRef.current?.contains(now) === true;
      if (!onCredit && !(keepOnField && now === inputRef.current)) onDismiss();
    });

  return (
    <div className="desk-field ev-combo">
      <label htmlFor={id} className="desk-label">
        {t('eventForm.venueAddress')}
        <span className="ev-optional">{` · ${t('eventForm.optional')}`}</span>
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          value={value}
          spellCheck={false}
          autoComplete="off"
          {...offField(off)}
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={suggestions.length > 0 ? `${id}-list` : undefined}
          aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined}
          aria-invalid={error != null}
          aria-describedby={`${id}-help`}
          onChange={(change) => onType(change.target.value)}
          onKeyDown={onKeyDown}
          onBlur={closeUnlessOn(false)}
        />
      </div>
      {error != null && <Alert>{error}</Alert>}
      {down ? (
        <p id={`${id}-help`} className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('eventForm.venueLookupDown')}
        </p>
      ) : suggestions.length > 0 ? (
        <p id={`${id}-help`} className="desk-help" role="status">
          {t('eventForm.venueSuggestionsFound', { count: suggestions.length })}
        </p>
      ) : (
        <p id={`${id}-help`} className="desk-help">
          {t('eventForm.venueAddressHint')}
        </p>
      )}
      {suggestions.length > 0 && (
        <div className="ev-suggest">
          <ul
            id={`${id}-list`}
            className="desk-rows ev-options"
            role="listbox"
            aria-label={t('eventForm.venueSuggestions')}
          >
            {suggestions.map((one, index) => (
              <li
                key={one.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? 'desk-row ev-option is-active' : 'desk-row ev-option'}
                onPointerDown={(pointer) => pointer.preventDefault()}
                onClick={() => onPick(index)}
                onKeyDown={(key) => {
                  if (key.key === 'Enter') onPick(index);
                }}
              >
                <Glyph name="pin" size={20} />
                <RowWords
                  title={one.text}
                  lines={one.secondaryText == null ? [] : [one.secondaryText]}
                />
              </li>
            ))}
          </ul>
          <AddressCredit
            creditRef={creditRef}
            onLeave={closeUnlessOn(true)}
            onEscape={() => {
              onDismiss();
              inputRef.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}

/** sc-80918: the credit Stadia's terms and OpenStreetMap's licence ask for wherever their data shows; a sibling of the listbox, so neither link is ever an option, and a press on a link keeps Address focused so the list stays. */
function AddressCredit({
  creditRef,
  onLeave,
  onEscape,
}: {
  creditRef: RefObject<HTMLParagraphElement | null>;
  onLeave: () => void;
  onEscape: () => void;
}) {
  const { t } = useTranslation();
  const link = (href: string, name: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={(pointer) => pointer.preventDefault()}
      onBlur={onLeave}
      onKeyDownCapture={(key) => {
        if (key.key !== 'Escape') return;
        key.preventDefault();
        onEscape();
      }}
    >
      {name}
    </a>
  );

  return (
    <p className="ev-credit" ref={creditRef}>
      © {link(STADIA_ATTRIBUTION, t('eventForm.creditStadia'))} ©{' '}
      {link(OSM_COPYRIGHT, t('eventForm.creditOsm'))}
    </p>
  );
}
