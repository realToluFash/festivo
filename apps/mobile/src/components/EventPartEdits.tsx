import {
  type EventChanges,
  type EventCover as Cover,
  type OrganisationEvent,
} from '@soirely/api-client';
import {
  COVER_DESCRIPTION_MAXIMUM,
  COVER_MIDDLE,
  EVENT_NAME_MAXIMUM,
  NOTHING_SEEN,
  type EventFormField,
  type EventType,
  type Counts,
  type HostRow,
  addressLookup,
  countsOf,
  roleHolds,
  arrivalNoteTooLong,
  coverTypeOf,
  currencyChoices,
  draftOf,
  endMovedLine,
  formatWallDay,
  eventChanges,
  eventFormErrors,
  eventNameLength,
  type EventSaveRefusal,
  hostErrorsOf,
  hostsChanged,
  keepsLastHost,
  positionPart,
  skippedLine,
  startMoved,
  venueDraftOf,
  withCurrent,
} from '@soirely/domain';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale, dateLocale } from '../i18n/index.ts';
import { coverRefusalOf, pickedFile, pickedRefusal } from '../kit/coverUpload.ts';
import { changesOf, typedOf } from '../kit/eventForm.ts';
import type { EditPart } from '../kit/eventNav.ts';
import { type SavedPart, heldRead, sendPart } from '../kit/partSave.ts';
import {
  CLOSES_AT,
  type ReplyByAsk,
  replyByAfterStart,
  replyByAsk,
  replyByAskWords,
  replyByHint,
  replyByMoves,
  replyByPreview,
  replyBySaved,
  replyByWrong,
  todayIn,
} from '../kit/replyBy.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { tokens } from '../theme/tokens.ts';
import { discardCoverUpload } from './CoverField.tsx';
import { EventCover } from './EventCover.tsx';
import { EventNotice } from './EventNotice.tsx';
import {
  ArrivalNoteField,
  CoverPhotoFields,
  CoverPreview,
  CoverUpload,
  CurrencyView,
  DatesView,
  EditShell,
  EventField,
  type Host,
  HostRows,
  NameView,
  type Position,
  type Suggested,
  TypeChoices,
  VenueFieldsView,
  pickerOver,
  useEditTitle,
} from './EventEdits.tsx';
import { MomentBox, type Picking, pick } from './MomentPick.tsx';
import { useReadOut } from './ReadOut.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { type AskProps, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

export interface PartEditProps {
  open: boolean;
  event: OrganisationEvent;
  opener: RefObject<ScreenReaderTarget | null>;
  /** Cancel, or Discard: nothing saved. */
  onClose: () => void;
  /** With the toast's words when the part says more than Saved (sc-3780). */
  onSaved: (event: OrganisationEvent, said?: string) => void;
  /** Show the latest: the event as somebody else saved it, which the screen starts over from. */
  onLatest: (event: OrganisationEvent) => void;
}

type Errors = Partial<Record<EventFormField, string>>;

function cleared(was: Errors, field: EventFormField): Errors {
  return Object.fromEntries(Object.entries(was).filter(([key]) => key !== field));
}

type Outcome = 'changed' | 'failed' | null;

/** An event's part on its own screen (sc-48600), opened from its row, Change dates or the photo notice. */
export function EventEditScreen({ part, ...props }: PartEditProps & { part: EditPart }) {
  switch (part) {
    case 'dates':
      return <DatesEdit {...props} />;
    case 'replyBy':
      return <ReplyByEdit {...props} />;
    case 'venue':
      return <VenueEdit {...props} />;
    case 'hosts':
      return <HostsEdit {...props} />;
    case 'type':
      return <TypeEdit {...props} />;
    case 'currency':
      return <CurrencyEdit {...props} />;
    case 'name':
      return <NameEdit {...props} />;
    case 'cover':
      return <CoverEdit {...props} />;
  }
}

function only(errors: Errors, fields: readonly EventFormField[]): Errors {
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => fields.includes(field as EventFormField)),
  );
}

/** One part's save, as Edit details saved the whole form: only what changed, under the version the screen opened on, the API's refusals mapped back. */
function usePartSave(
  part: SavedPart,
  { event, onSaved, onLatest }: PartEditProps,
  said?: (saved: OrganisationEvent) => string | undefined,
) {
  const { t } = useTranslation();
  const [read] = useState(() => heldRead(() => api.taggedEvent(event.id)));
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => void read(), [read]);

  async function save(
    changes: EventChanges,
    rows: readonly HostRow[] = [],
  ): Promise<EventSaveRefusal | null> {
    if (busy) return null;

    setBusy(true);
    setOutcome(null);
    const sent = await sendPart({ api, part, shown: event, changes, read }, t, rows);
    setBusy(false);

    if (sent.kind === 'unchanged') onSaved(event);
    if (sent.kind === 'saved') onSaved(sent.event, said?.(sent.event));
    if (sent.kind === 'unchanged' || sent.kind === 'saved') return null;

    setOutcome(sent.kind === 'refused' ? null : sent.kind);
    return sent;
  }

  const elsewhere =
    outcome === 'changed'
      ? {
          pending: fetching,
          onLatest: () => {
            setFetching(true);
            api.taggedEvent(event.id).then(
              (latest) => onLatest(latest.event),
              () => {
                setFetching(false);
                setOutcome('failed');
              },
            );
          },
        }
      : null;

  return { busy, save, elsewhere, failed: outcome === 'failed', setOutcome };
}

function useShellProps(part: EditPart, props: PartEditProps) {
  const title = useEditTitle();

  return {
    open: props.open,
    title: title(part),
    testID: `event.edit.${part}`,
    opener: props.opener,
    onClose: props.onClose,
  };
}

function NameEdit(props: PartEditProps) {
  const { t } = useTranslation();
  const { event } = props;
  const [name, setName] = useState(event.name);
  const [refused, setRefused] = useState<string | null>(null);
  const field = useRef<TextInputInstance>(null);
  const { busy, save, elsewhere, failed } = usePartSave('name', props);
  const typed = { ...typedOf(event), draft: { ...draftOf(event), name } };
  const error = only(eventFormErrors(typed, t), ['name']).name ?? refused;

  async function send(): Promise<void> {
    if (error != null) return field.current?.focus();

    const refusal = await save(eventChanges(event, typed));
    if (refusal?.kind === 'refused' && refusal.errors.name != null) {
      setRefused(refusal.errors.name);
      field.current?.focus();
    }
  }

  return (
    <EditShell
      {...useShellProps('name', props)}
      changed={name !== event.name}
      busy={busy}
      elsewhere={elsewhere}
      failed={failed}
      onSave={() => void send()}
    >
      <NameView
        name={name}
        error={error}
        count={eventNameLength(name)}
        most={EVENT_NAME_MAXIMUM}
        nameRef={field}
        onName={(typedName) => {
          setName(typedName);
          setRefused(null);
        }}
      />
    </EditShell>
  );
}

function TypeEdit(props: PartEditProps) {
  const { event } = props;
  const [type, setType] = useState<EventType>(event.type);
  const { busy, save, elsewhere, failed } = usePartSave('type', props);

  return (
    <EditShell
      {...useShellProps('type', props)}
      changed={type !== event.type}
      busy={busy}
      elsewhere={elsewhere}
      failed={failed}
      onSave={() =>
        void save(eventChanges(event, { ...typedOf(event), draft: { ...draftOf(event), type } }))
      }
    >
      <TypeChoices type={type} onPick={setType} testID="event.edit.type" />
    </EditShell>
  );
}

function CurrencyEdit(props: PartEditProps) {
  const { t } = useTranslation();
  const { event } = props;
  const locale = currentLocale();
  const [code, setCode] = useState(event.currency);
  const [inUse, setInUse] = useState(false);
  const { busy, save, elsewhere, failed } = usePartSave('currency', props);
  const choices = useMemo(
    () =>
      currencyChoices(event.currency, locale, (held) =>
        t('orgGeneral.currencyRetired', { code: held }),
      ),
    [event.currency, locale, t],
  );

  return (
    <EditShell
      {...useShellProps('currency', props)}
      changed={code !== event.currency}
      busy={busy}
      elsewhere={elsewhere}
      failed={failed}
      onSave={() =>
        void save(eventChanges(event, { ...typedOf(event), currency: code })).then((refusal) =>
          setInUse(refusal?.kind === 'refused' && refusal.currencyInUse),
        )
      }
    >
      <CurrencyView
        code={code}
        choices={choices}
        refused={inUse}
        onPick={(picked) => {
          setCode(picked);
          setInUse(false);
        }}
      />
    </EditShell>
  );
}

function DatesEdit(props: PartEditProps) {
  const { t } = useTranslation();
  const { event } = props;
  const locale = dateLocale();
  const saved = draftOf(event);
  const [draft, setDraft] = useState(saved);
  const [zone, setZone] = useState(event.timeZone);
  const [moved, setMoved] = useState<string | null>(null);
  const [refused, setRefused] = useState<Errors>({});
  const [zonesOpen, setZonesOpen] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [asking, setAsking] = useState<ReplyByAsk | null>(null);
  const now = useServerNow();
  const counts = useHaventCounts(event);
  const { busy, save, elsewhere, failed } = usePartSave('dates', props, (saved) =>
    saved.replyBy !== event.replyBy && saved.replyBy != null
      ? replyBySaved(saved.replyBy, saved.timeZone, locale, now, t)
      : undefined,
  );
  const zones = useMemo(
    () => withCurrent(Intl.supportedValuesOf('timeZone'), event.timeZone),
    [event.timeZone],
  );
  const typed = { ...typedOf(event), draft, timeZone: zone };
  const live = only(eventFormErrors(typed, t), ['startsAt', 'endsAt', 'timeZone']);
  const errors = { ...refused, ...live };
  const from = { date: draft.startDate, time: draft.startTime };
  const to = { date: draft.endDate, time: draft.endTime };
  const changed =
    zone !== event.timeZone ||
    [draft.startDate, draft.startTime, draft.endDate, draft.endTime].join() !==
      [saved.startDate, saved.startTime, saved.endDate, saved.endTime].join();

  const replyBy = event.replyBy ?? null;
  const replyByTo = replyByAfterStart(replyBy, draft.startDate);
  const replyByLine =
    replyBy == null || replyByTo == null ? null : replyByMoves(replyBy, replyByTo, locale, t);
  const closes =
    replyByTo == null
      ? null
      : replyByAsk(replyBy, replyByTo, todayIn(now, zone), counts?.havent ?? 1);
  const skipped = skippedLine(draft.startDate, draft.startTime, zone, locale, t);

  useReadOut(moved);
  useReadOut(replyByLine);

  const pickStart = (mode: 'date' | 'time') =>
    pick(
      {
        title: t('eventForm.timesIn', { zone }),
        mode,
        field: from,
        take: (next) => {
          const after = startMoved(
            draft,
            { startDate: next.date, startTime: next.time },
            true,
            zone,
          );
          setDraft(after);
          setMoved(endMovedLine(draft, after, locale, t));
          setRefused({});
        },
      },
      setPicking,
    );
  const pickEnd = (mode: 'date' | 'time') =>
    pick(
      {
        title: t('eventForm.timesIn', { zone }),
        mode,
        field: to,
        take: (next) => {
          setDraft((was) => ({ ...was, endDate: next.date, endTime: next.time }));
          setMoved(null);
          setRefused({});
        },
      },
      setPicking,
    );

  async function send(): Promise<void> {
    setAsking(null);
    const refusal = await save(eventChanges(event, typed));
    if (refusal?.kind === 'refused') setRefused(refusal.errors);
  }

  function ask(): void {
    if (Object.keys(live).length > 0) return;
    if (closes != null) setAsking(closes);
    else void send();
  }

  const closeAsk: AskProps | null =
    asking == null || replyByTo == null
      ? null
      : (() => {
          const words = replyByAskWords(asking, replyByTo, counts, locale, t);

          return {
            title: words.title,
            line: words.line,
            keep: { label: t('eventEdit.keepEditing'), testID: 'event.edit.dates.replyBy.keep' },
            confirm: { label: words.confirm, testID: 'event.edit.dates.replyBy.close' },
            onKeep: () => setAsking(null),
            onConfirm: () => void send(),
          };
        })();

  return (
    <EditShell
      {...useShellProps('dates', props)}
      changed={changed}
      busy={busy}
      elsewhere={elsewhere}
      failed={failed}
      onSave={ask}
      ask={closeAsk}
      over={pickerOver(picking, locale, () => setPicking(null))}
    >
      <DatesView
        from={from}
        to={to}
        zone={zone}
        locale={locale}
        startError={errors.startsAt ?? errors.timeZone ?? null}
        startLine={
          skipped == null
            ? replyByLine
            : replyByLine == null
              ? skipped
              : `${skipped} ${replyByLine}`
        }
        endError={errors.endsAt ?? null}
        moved={moved}
        endLine={skippedLine(draft.endDate, draft.endTime, zone, locale, t)}
        zones={zones}
        zonesOpen={zonesOpen}
        onZonesOpen={setZonesOpen}
        onZone={(next) => {
          setZone(next);
          setRefused({});
        }}
        onPickStart={pickStart}
        onPickEnd={pickEnd}
      />
    </EditShell>
  );
}

/** Who has still to reply, as Guests' card counts them, for the question before replies close sooner; null without guests.read or until read. */
function useHaventCounts(event: OrganisationEvent): Counts | null {
  const reads = roleHolds(event, 'guests.read');
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!reads) return;
    let current = true;
    api.headcount(event.id).then(
      (headcount) => current && setCounts(countsOf(headcount.counts)),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [event.id, reads]);

  return counts;
}

/** Reply by (sc-3780): an optional day before the start's; closing replies sooner asks first, and only while somebody has still to reply. */
function ReplyByEdit(props: PartEditProps) {
  const { t } = useTranslation();
  const { event } = props;
  const locale = dateLocale();
  const now = useServerNow();
  const saved = event.replyBy ?? null;
  const [value, setValue] = useState<string | null>(saved);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState(false);
  const [asking, setAsking] = useState<ReplyByAsk | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [aim, setAim] = useState(0);
  const box = useRef<ViewInstance>(null);
  const counts = useHaventCounts(event);
  const { busy, save, elsewhere, failed } = usePartSave('replyBy', props, (shown) =>
    replyBySaved(shown.replyBy ?? null, shown.timeZone, locale, now, t),
  );
  const today = todayIn(now, event.timeZone);
  const wrong = replyByWrong(value, draftOf(event).startDate);
  const error = (tried && wrong) || refused ? t('replyBy.notBefore') : null;
  const preview = wrong ? null : replyByPreview(value, today, locale, t);

  useEffect(() => {
    if (aim > 0) moveScreenReaderFocus(box.current);
  }, [aim]);

  async function send(): Promise<void> {
    setAsking(null);
    const refusal = await save({ replyBy: value });
    if (refusal?.kind === 'refused') {
      setRefused(true);
      setAim((count) => count + 1);
    }
  }

  function ask(): void {
    if (wrong) {
      setTried(true);
      setAim((count) => count + 1);
      return;
    }
    const closes = replyByAsk(saved, value, today, counts?.havent ?? 1);
    if (closes == null) void send();
    else setAsking(closes);
  }

  const choose = () =>
    pick(
      {
        title: t('replyBy.label'),
        mode: 'date',
        field: { date: value ?? '', time: CLOSES_AT },
        take: (picked) => {
          setValue(picked.date);
          setTried(false);
          setRefused(false);
        },
      },
      setPicking,
    );
  const closeAsk: AskProps | null =
    asking == null || value == null
      ? null
      : (() => {
          const words = replyByAskWords(asking, value, counts, locale, t);

          return {
            title: words.title,
            line: words.line,
            keep: {
              label:
                saved == null
                  ? t('eventEdit.keepEditing')
                  : t('replyBy.keepDate', { date: formatWallDay(saved, locale) }),
              testID: 'event.edit.replyBy.keep',
            },
            confirm: { label: words.confirm, testID: 'event.edit.replyBy.close' },
            onKeep: () => setAsking(null),
            onConfirm: () => void send(),
          };
        })();

  return (
    <EditShell
      {...useShellProps('replyBy', props)}
      changed={value !== saved}
      busy={busy}
      elsewhere={elsewhere}
      failed={failed}
      onSave={ask}
      ask={closeAsk}
      over={pickerOver(picking, locale, () => setPicking(null))}
    >
      <EventField
        label={t('replyBy.label')}
        optional
        error={error}
        help={replyByHint(event.timeZone, locale, t)}
      >
        {value == null ? (
          <Pressable
            ref={box}
            onPress={choose}
            style={({ pressed }) => [styles.select, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('replyBy.label')}
            testID="event.edit.replyBy.date"
          />
        ) : (
          <MomentBox
            ref={box}
            label={t('replyBy.label')}
            mode="date"
            value={value}
            locale={locale}
            wrong={error != null}
            onPress={choose}
            testID="event.edit.replyBy.date"
          />
        )}
      </EventField>
      {value != null && (
        <View style={styles.start}>
          <TextAction
            label={t('replyBy.remove')}
            onPress={() => {
              setValue(null);
              setTried(false);
              setRefused(false);
              setAim((count) => count + 1);
            }}
            testID="event.edit.replyBy.remove"
          />
        </View>
      )}
      {preview != null && (
        <View style={styles.inset}>
          <Text size={15} weight="medium" style={styles.lines}>
            {preview}
          </Text>
        </View>
      )}
    </EditShell>
  );
}

function VenueEdit(props: PartEditProps) {
  const { t } = useTranslation();
  const { event } = props;
  const savedVenue = venueDraftOf(event.venue, event.arrivalNote);
  const [venue, setVenue] = useState(savedVenue);
  const [zone, setZone] = useState(event.timeZone);
  const [seen, setSeen] = useState(NOTHING_SEEN);
  const [errors, setErrors] = useState<Errors>({});
  const [said, setSaid] = useState<string | null>(null);
  const nameInput = useRef<TextInputInstance>(null);
  const addressInput = useRef<TextInputInstance>(null);
  const noteInput = useRef<TextInputInstance>(null);
  const { busy, save, elsewhere, failed } = usePartSave('venue', props);
  const [lookup] = useState(() =>
    addressLookup({
      suggest: (query) => api.addressSuggestions(query),
      resolve: (id) => api.address(id),
      onVenue: (change) => setVenue((was) => ({ ...was, ...change })),
      onSeen: setSeen,
    }),
  );
  const changed =
    venue.name !== savedVenue.name ||
    venue.address !== savedVenue.address ||
    venue.note !== savedVenue.note ||
    zone !== event.timeZone;
  const suggestions: Suggested[] = seen.suggestions.map((one) => ({
    key: one.id,
    title: one.text,
    line: one.secondaryText ?? undefined,
  }));
  const offer =
    seen.offered != null && seen.offered.zone !== zone
      ? {
          zone: seen.offered.zone,
          keep: zone,
          onUse: () => {
            const chosen = seen.offered?.zone;
            if (chosen != null) setZone(chosen);
            lookup.answered();
          },
          onKeep: () => lookup.answered(),
        }
      : null;

  useEffect(() => () => lookup.stop(), [lookup]);
  useReadOut(said);

  function refuse(found: Errors): void {
    const count = Object.keys(found).length;

    setErrors(found);
    setSaid(count === 0 ? null : t('eventForm.problems', { count }));
    const first =
      found.venueName != null ? nameInput : found.venueAddress != null ? addressInput : noteInput;
    if (count > 0) first.current?.focus();
  }

  async function send(): Promise<void> {
    const typed = { ...typedOf(event), venue, timeZone: zone };
    const found = only(eventFormErrors(typed, t), ['venueName', 'venueAddress', 'arrivalNote']);

    if (Object.keys(found).length > 0) return refuse(found);

    const refusal = await save(eventChanges(event, typed));
    if (refusal?.kind === 'refused') refuse(refusal.errors);
  }

  return (
    <EditShell
      {...useShellProps('venue', props)}
      changed={changed}
      busy={busy}
      elsewhere={elsewhere}
      failed={failed}
      onSave={() => void send()}
    >
      <VenueFieldsView
        name={venue.name}
        address={venue.address}
        onName={(name) => {
          setVenue((was) => ({ ...was, name }));
          setErrors((was) => cleared(was, 'venueName'));
        }}
        onAddress={(address) => {
          lookup.type(address);
          setErrors((was) => cleared(was, 'venueAddress'));
        }}
        suggestions={suggestions}
        onSuggestion={(key) => {
          const chosen = seen.suggestions.find((one) => one.id === key);
          if (chosen != null) void lookup.pick(chosen, zone);
        }}
        down={seen.down}
        offer={offer}
        nameError={errors.venueName ?? null}
        addressError={errors.venueAddress ?? null}
        nameRef={nameInput}
        addressRef={addressInput}
        off={busy}
        testID="event.edit.venue"
      />
      <ArrivalNoteField
        note={venue.note}
        onNote={(note) => {
          setVenue((was) => ({ ...was, note }));
          if (!arrivalNoteTooLong(note)) setErrors((was) => cleared(was, 'arrivalNote'));
        }}
        error={errors.arrivalNote ?? null}
        noteRef={noteInput}
        testID="event.edit.venue.note"
      />
    </EditShell>
  );
}

function HostsEdit(props: PartEditProps) {
  const { t } = useTranslation();
  const { event } = props;
  const [hosts, setHosts] = useState<Host[]>(() => event.hosts.map((name, key) => ({ key, name })));
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<Partial<Record<number, string>>>({});
  const [said, setSaid] = useState<string | null>(null);
  const { busy, save, elsewhere, failed } = usePartSave('hosts', props);
  const names = hosts.map((host) => host.name);
  const found = hostErrorsOf(hosts, t);
  const errors = hosts.map(
    (host) => (tried ? found[host.key] : undefined) ?? refused[host.key] ?? null,
  );

  useReadOut(said);

  async function send(): Promise<void> {
    setTried(true);
    if (Object.keys(found).length > 0) return;

    const refusal = await save(changesOf(event, { ...typedOf(event), hosts }), hosts);
    if (refusal?.kind === 'refused') setRefused(refusal.hosts);
  }

  return (
    <EditShell
      {...useShellProps('hosts', props)}
      changed={hostsChanged(event.hosts, names)}
      busy={busy}
      elsewhere={elsewhere}
      failed={failed}
      onSave={() => void send()}
    >
      <HostRows
        hosts={hosts}
        onHosts={(rows) => {
          setHosts(rows);
          setRefused({});
        }}
        errors={errors}
        kept={keepsLastHost(event, hosts.length)}
        off={busy}
        onSaid={setSaid}
        testID="event.edit.hosts"
      />
    </EditShell>
  );
}

const POSITION_AT: Record<Position, number> = { top: 0, middle: COVER_MIDDLE, bottom: 100 };

type Photo =
  | { kind: 'saved'; cover: Cover }
  | { kind: 'none' }
  | { kind: 'uploading'; uri: string; width: number }
  | { kind: 'ready'; uri: string; width: number; key: string };

/** Cover photo: a photo chosen uploads at once and is kept only by Use this photo; Remove photo brings the event's own cover back. */
function CoverEdit(props: PartEditProps) {
  const { t } = useTranslation();
  const { event, onSaved } = props;
  const saved = event.cover;
  const savedPosition = positionPart(saved?.position ?? COVER_MIDDLE);
  const [photo, setPhoto] = useState<Photo>(
    saved == null ? { kind: 'none' } : { kind: 'saved', cover: saved },
  );
  const [position, setPosition] = useState<Position>(savedPosition);
  const [described, setDescribed] = useState(saved?.description ?? '');
  const [refused, setRefused] = useState<string | null>(null);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const describe = useRef<TextInputInstance>(null);
  const staged = useRef<string | null>(null);
  const has = photo.kind !== 'none';
  const changed =
    photo.kind === 'ready' ||
    photo.kind === 'uploading' ||
    (photo.kind === 'none' && saved != null) ||
    (has && position !== savedPosition) ||
    (has && described !== (saved?.description ?? ''));
  const count = [...described].length;

  useEffect(
    () => () => {
      if (staged.current != null) discardCoverUpload(event.organisationId, staged.current);
    },
    [event.organisationId],
  );

  async function choose(): Promise<void> {
    const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const chosen = picked.canceled ? null : picked.assets[0];
    if (chosen == null) return;

    const refusal = pickedRefusal(chosen);
    if (refusal != null) {
      setRefused(t(`eventCover.refused_${refusal}`));
      return;
    }

    setRefused(null);
    setPhoto({ kind: 'uploading', uri: chosen.uri, width: chosen.width });
    setPosition('middle');
    setDescribed('');

    const file = pickedFile(chosen);
    try {
      const signed = await api.signEventCoverUpload(event.organisationId, {
        contentType: coverTypeOf(file) ?? file.type,
        size: file.size,
        filename: file.name,
      });
      await api.uploadTo(signed, await (await fetch(chosen.uri)).blob());
      if (staged.current != null) discardCoverUpload(event.organisationId, staged.current);
      staged.current = signed.key;
      setPhoto({ kind: 'ready', uri: chosen.uri, width: chosen.width, key: signed.key });
    } catch (error) {
      setPhoto(saved == null ? { kind: 'none' } : { kind: 'saved', cover: saved });
      setRefused(coverRefusalOf(error, t));
    }
  }

  async function use(): Promise<void> {
    if (busy || photo.kind === 'uploading') return;
    if (count > COVER_DESCRIPTION_MAXIMUM) {
      setDescribeError(t('eventCover.describeTooLong', { most: COVER_DESCRIPTION_MAXIMUM }));
      describe.current?.focus();
      return;
    }

    const trimmed = described.trim();
    setBusy(true);
    setRefused(null);

    try {
      const updated =
        photo.kind === 'none'
          ? await api.removeEventCover(event.id)
          : await api.setEventCover(event.id, {
              ...(photo.kind === 'ready' ? { uploadKey: photo.key } : {}),
              position:
                position === savedPosition && photo.kind === 'saved'
                  ? (saved?.position ?? COVER_MIDDLE)
                  : POSITION_AT[position],
              description: trimmed === '' ? null : trimmed,
            });
      staged.current = null;
      setBusy(false);
      onSaved(updated);
    } catch (error) {
      setBusy(false);
      setRefused(coverRefusalOf(error, t));
    }
  }

  const shown: Cover | null =
    photo.kind === 'saved'
      ? { ...photo.cover, position: POSITION_AT[position] }
      : photo.kind === 'ready' || photo.kind === 'uploading'
        ? {
            sizes: [{ width: photo.width, url: photo.uri }],
            position: POSITION_AT[position],
            description: null,
          }
        : null;

  return (
    <EditShell
      {...useShellProps('cover', props)}
      verb={t('eventCover.use')}
      changed={changed && photo.kind !== 'uploading'}
      busy={busy}
      onSave={() => void use()}
    >
      <CoverPreview
        photo={
          shown == null ? null : <EventCover cover={shown} type={event.type} fill radius={0} />
        }
        meshKey={event.id}
      />
      {has ? (
        <>
          {refused != null && <EventNotice tone="broken" words={refused} interrupts />}
          <CoverPhotoFields
            position={position}
            onPosition={setPosition}
            described={described}
            onDescribed={(next) => {
              setDescribed(next);
              if ([...next].length <= COVER_DESCRIPTION_MAXIMUM) setDescribeError(null);
            }}
            count={count}
            most={COVER_DESCRIPTION_MAXIMUM}
            describeError={describeError}
            describeRef={describe}
            onChange={() => void choose()}
            onRemove={() => {
              setPhoto({ kind: 'none' });
              setDescribed('');
              setRefused(null);
            }}
            off={busy}
          />
        </>
      ) : (
        <CoverUpload
          refused={refused}
          off={busy}
          onUpload={() => void choose()}
          testID="event.edit.cover.upload"
        />
      )}
    </EditShell>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  start: { alignItems: 'flex-start' },
  inset: {
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  select: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingLeft: 14.5,
    paddingRight: 12.5,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    borderRadius: 14,
  },
});
