import { type EventCover as Cover, type Membership } from '@soirely/api-client';
import {
  COVER_DESCRIPTION_MAXIMUM,
  EVENT_NAME_MAXIMUM,
  NOTHING_SEEN,
  type EventFormField,
  type HostErrors,
  type HostRow,
  type VenueDraft,
  addressLookup,
  coverTypeOf,
  currencyChoices,
  endMovedLine,
  eventFormErrors,
  eventNameLength,
  aboveCover,
  firstRefusedOf,
  hostErrorsOf,
  isEventType,
  newEventHosts,
  skippedLine,
  startMoved,
  timezoneLabel,
  visibleLength,
  withCurrent,
} from '@soirely/domain';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale, dateLocale } from '../i18n/index.ts';
import { coverRefusalOf, pickedFile, pickedRefusal } from '../kit/coverUpload.ts';
import {
  type EventErrors,
  type EventTyped,
  type StagedCover,
  blankEvent,
  coverAfterCreate,
  isDirty,
  newEventOf,
  sendOutcome,
} from '../kit/eventForm.ts';
import { markCoverRefused } from '../kit/eventSaved.ts';
import { pickedBytes } from '../kit/pickedBytes.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { focusPicker } from './CountryPicker.tsx';
import { discardCoverUpload } from './CoverField.tsx';
import { EventCover } from './EventCover.tsx';
import {
  ArrivalNoteField,
  Choices,
  CoverPhotoFields,
  CoverPreview,
  CoverUpload,
  CurrencyView,
  DatePair,
  EventField,
  Hint,
  HostRows,
  POSITION_AT,
  type Position,
  type Suggested,
  SelectBox,
  TypeChoices,
  VenueFieldsView,
  pickerOver,
  useEditGap,
} from './EventEdits.tsx';
import { EventNotice } from './EventNotice.tsx';
import { focusChecked } from './Field.tsx';
import { DoneLine, Legend, SheetBody, SheetLayer } from './FormLayers.tsx';
import { BoxField, type Picking, pick } from './MomentPick.tsx';
import { ReadOut, useReadOut } from './ReadOut.tsx';
import { type FormSection, keysGoDownFor, sectionQuiet, typedIn } from './refusedField.ts';
import { type ScreenReaderTarget, useScreenReaderOn } from './screenReaderFocus.ts';
import { Pill } from './SettingsParts.tsx';
import { ASK_WIDTH, type AskProps, FocusedScreen } from './Summary.tsx';

type Status = 'editing' | 'sending' | 'failed' | 'created';
type ListOpen = 'type' | 'zone' | 'currency';

type Photo =
  { kind: 'none' } | { kind: 'chosen'; uri: string; width: number; upload: Promise<StagedCover> };

interface FocusOn {
  field: EventFormField;
  saidFirst?: string | undefined;
}

/** New event (sc-48607): the event's own part edits on one screen in today's order, Create event pinned under them. */
export function NewEventScreen({
  open,
  organisation,
  opener,
  onClose,
  onCreated,
}: {
  open: boolean;
  organisation: Membership;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onCreated: (eventId: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const gap = useEditGap();
  const locale = currentLocale();
  const wallLocale = dateLocale();
  const [from] = useState<EventTyped>(() => blankEvent(organisation));
  const [typed, setTyped] = useState(from);
  const [endChosen, setEndChosen] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);
  const [errors, setErrors] = useState<EventErrors>({});
  const [hostErrors, setHostErrors] = useState<HostErrors>({});
  const [hostsChecked, setHostsChecked] = useState(false);
  const [unsent, setUnsent] = useState<{ count: number; keysGoDown: boolean } | null>(null);
  const [status, setStatus] = useState<Status>('editing');
  const [picking, setPicking] = useState<Picking | null>(null);
  const [list, setList] = useState<ListOpen | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Photo>({ kind: 'none' });
  const [coverRefused, setCoverRefused] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>('middle');
  const [described, setDescribed] = useState('');
  const [describeError, setDescribeError] = useState<string | null>(null);
  const [focusDescribe, setFocusDescribe] = useState(0);
  const [seen, setSeen] = useState(NOTHING_SEEN);
  const [focusOn, setFocusOn] = useState<FocusOn | null>(null);
  const [quietOn, setQuietOn] = useState<FocusOn | null>(null);
  const [focusHost, setFocusHost] = useState<{ key: number } | null>(null);
  const readerOn = useScreenReaderOn();
  const staged = useRef<string | null>(null);
  const attempt = useRef(0);
  const nameInput = useRef<TextInputInstance>(null);
  const venueNameInput = useRef<TextInputInstance>(null);
  const venueAddressInput = useRef<TextInputInstance>(null);
  const noteInput = useRef<TextInputInstance>(null);
  const describeInput = useRef<TextInputInstance>(null);
  const hostInputs = useRef(new Map<number, TextInputInstance>());
  const pickers = {
    type: useRef<ViewInstance>(null),
    startsAt: useRef<ViewInstance>(null),
    endsAt: useRef<ViewInstance>(null),
    timeZone: useRef<ViewInstance>(null),
    currency: useRef<ViewInstance>(null),
  };
  const fields = {
    type: useRef<ViewInstance>(null),
    startsAt: useRef<ViewInstance>(null),
    endsAt: useRef<ViewInstance>(null),
    timeZone: useRef<ViewInstance>(null),
    currency: useRef<ViewInstance>(null),
  };
  const busy = status === 'sending' || status === 'created';
  const { draft, venue, timeZone, currency, hosts } = typed;
  const quietAfter = quietOn?.field ?? null;
  const dirty = isDirty(typed, from) || photo.kind !== 'none';

  const [lookup] = useState(() =>
    addressLookup({
      suggest: (query) => api.addressSuggestions(query),
      resolve: (id) => api.address(id),
      onVenue: (change) => changeVenue(change),
      onSeen: setSeen,
    }),
  );

  useReadOut(said);
  useReadOut(moved);

  useEffect(() => () => lookup.stop(), [lookup]);

  useEffect(
    () => () => {
      attempt.current += 1;
      if (staged.current != null) discardCoverUpload(organisation.id, staged.current);
    },
    [organisation.id],
  );

  useEffect(() => {
    if (focusDescribe > 0) focusChecked(describeInput);
  }, [focusDescribe]);

  useEffect(() => {
    if (focusHost == null) return;
    const input = hostInputs.current.get(focusHost.key);
    if (input != null) focusChecked({ current: input });
  }, [focusHost]);

  useEffect(() => {
    if (focusOn == null) return;
    const field = focusOn.field;

    if (typedIn(field)) {
      const typedIns: Record<string, RefObject<TextInputInstance | null>> = {
        name: nameInput,
        venueName: venueNameInput,
        venueAddress: venueAddressInput,
        arrivalNote: noteInput,
      };
      const input = typedIns[field];
      if (input != null) focusChecked(input);
      return;
    }
    if (!(field in pickers)) return;
    const key = field as keyof typeof pickers;

    return focusPicker(pickers[key], fields[key], focusOn.saidFirst, () =>
      setQuietOn((now) => (now === focusOn ? null : now)),
    );
    // The refs are stable; only a new refusal moves focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOn]);

  const zones = useMemo(
    () => withCurrent(Intl.supportedValuesOf('timeZone'), from.timeZone),
    [from.timeZone],
  );
  const currencies = useMemo(
    () => currencyChoices('', locale, (code) => t('orgGeneral.currencyRetired', { code })),
    [locale, t],
  );

  function edited(): void {
    setStatus((was) => (was === 'failed' ? 'editing' : was));
  }

  function change(field: EventFormField, next: Partial<EventTyped>): void {
    setTyped((was) => ({ ...was, ...next }));
    setErrors((was) => cleared(was, field));
    edited();
  }

  function changeVenue(next: Partial<VenueDraft>): void {
    setTyped((was) => ({ ...was, venue: { ...was.venue, ...next } }));
    if ('name' in next) setErrors((was) => cleared(was, 'venueName'));
    if ('address' in next) setErrors((was) => cleared(was, 'venueAddress'));
    if ('note' in next) setErrors((was) => cleared(was, 'arrivalNote'));
    edited();
  }

  function editHosts(rows: HostRow[]): void {
    setTyped((was) => ({ ...was, hosts: rows }));
    setHostErrors(hostsChecked ? hostErrorsOf(newEventHosts(rows), t) : {});
    edited();
  }

  /** Returns whether the keys go down for the field it focuses: only a field not typed in puts them down. */
  function refuse(
    found: EventErrors,
    hostFound: HostErrors = {},
    saidFirst?: string,
    describeWrong = false,
  ): boolean {
    setErrors(found);
    setHostErrors(hostFound);
    const first = firstRefusedOf(found, hostFound, hosts);
    if (describeWrong && !aboveCover(first)) {
      setFocusOn(null);
      setQuietOn(null);
      setFocusHost(null);
      setFocusDescribe((was) => was + 1);
      return false;
    }
    const onField = first != null && 'field' in first ? first.field : null;
    const quiet = Platform.OS === 'android' && saidFirst != null && keysGoDownFor(onField);
    const on = onField != null ? { field: onField, saidFirst } : null;
    setFocusOn(on);
    setQuietOn(quiet ? on : null);
    setFocusHost(first != null && 'host' in first ? { key: first.host } : null);

    return keysGoDownFor(onField);
  }

  async function choosePhoto(): Promise<void> {
    const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const chosen = picked.canceled ? null : picked.assets[0];
    if (chosen == null) return;

    const refusal = pickedRefusal(chosen);
    if (refusal != null) {
      setCoverRefused(t(`eventCover.refused_${refusal}`));
      return;
    }

    const mine = ++attempt.current;
    setPosition('middle');
    setDescribed('');
    setDescribeError(null);
    const file = pickedFile(chosen);
    const upload = (async (): Promise<StagedCover> => {
      try {
        const signed = await api.signEventCoverUpload(organisation.id, {
          contentType: coverTypeOf(file) ?? file.type,
          size: file.size,
          filename: file.name,
        });
        await api.uploadTo(signed, await pickedBytes(chosen.uri));
        if (mine !== attempt.current) {
          discardCoverUpload(organisation.id, signed.key);
          return null;
        }
        staged.current = signed.key;

        return { key: signed.key };
      } catch (error) {
        const refused = coverRefusalOf(error, t);
        if (mine === attempt.current) {
          setPhoto({ kind: 'none' });
          setCoverRefused(refused);
        }
        return { refused };
      }
    })();

    setCoverRefused(null);
    setPhoto({ kind: 'chosen', uri: chosen.uri, width: chosen.width, upload });
  }

  function removePhoto(): void {
    attempt.current += 1;
    if (staged.current != null) discardCoverUpload(organisation.id, staged.current);
    staged.current = null;
    setPhoto({ kind: 'none' });
    setCoverRefused(null);
    setDescribed('');
    setDescribeError(null);
  }

  async function send(): Promise<void> {
    if (busy) return;

    const found = eventFormErrors(typed, t);
    const hostFound = hostErrorsOf(newEventHosts(hosts), t);
    const describeWrong =
      photo.kind === 'chosen' && visibleLength(described) > COVER_DESCRIPTION_MAXIMUM;
    const count =
      Object.keys(found).length + Object.keys(hostFound).length + (describeWrong ? 1 : 0);

    setHostsChecked(true);

    if (count > 0) {
      setStatus('editing');
      const summary = t('eventForm.problems', { count });
      setDescribeError(
        describeWrong ? t('eventCover.describeTooLong', { most: COVER_DESCRIPTION_MAXIMUM }) : null,
      );
      const keysGoDown = refuse(
        found,
        hostFound,
        Platform.OS !== 'android' || readerOn ? summary : undefined,
        describeWrong,
      );
      setUnsent({ count, keysGoDown });
      return;
    }

    setUnsent(null);

    const body = newEventOf(typed);
    if (body == null) return;

    setStatus('sending');

    try {
      const created = await api.createEvent(organisation.id, body);
      const upload = photo.kind === 'chosen' ? await photo.upload : null;
      staged.current = null;

      await coverAfterCreate(
        upload,
        (uploadKey) =>
          api.setEventCover(created.id, {
            uploadKey,
            position: POSITION_AT[position],
            description: described.trim() === '' ? null : described.trim(),
          }),
        (words) => markCoverRefused(created.id, words),
        (error) => coverRefusalOf(error, t),
      );

      setStatus('created');
      onCreated(created.id);
    } catch (error) {
      const outcome = sendOutcome(error, t, newEventHosts(hosts));

      if (outcome.kind === 'refused') {
        setStatus('editing');
        refuse(outcome.errors, outcome.hosts);
        return;
      }

      setStatus('failed');
    }
  }

  const pickStart = (mode: 'date' | 'time') =>
    pick(
      {
        title: t('eventForm.timesIn', { zone: timeZone }),
        mode,
        field: { date: draft.startDate, time: draft.startTime },
        take: (next) => {
          const after = startMoved(
            draft,
            { startDate: next.date, startTime: next.time },
            endChosen,
            timeZone,
          );
          change('startsAt', { draft: after });
          setMoved(endMovedLine(draft, after, wallLocale, t));
        },
      },
      setPicking,
    );
  const pickEnd = (mode: 'date' | 'time') =>
    pick(
      {
        title: t('eventForm.timesIn', { zone: timeZone }),
        mode,
        field:
          draft.endDate === ''
            ? { date: draft.startDate, time: draft.startTime }
            : { date: draft.endDate, time: draft.endTime },
        take: (next) => {
          change('endsAt', { draft: { ...draft, endDate: next.date, endTime: next.time } });
          setEndChosen(true);
          setMoved(null);
        },
      },
      setPicking,
    );

  function cancel(): void {
    if (busy) return;
    if (dirty) setLeaving(true);
    else onClose();
  }

  const leave: AskProps | null = leaving
    ? {
        title: t('eventEdit.leaveTitle'),
        line: t('eventForm.leaveBody'),
        keep: { label: t('eventEdit.keepEditing'), testID: 'eventForm.leave.keep' },
        confirm: { label: t('eventEdit.leave'), testID: 'eventForm.leave.go', removes: true },
        onKeep: () => setLeaving(false),
        onConfirm: () => {
          setLeaving(false);
          onClose();
        },
        width: ASK_WIDTH,
      }
    : null;

  const closeList = () => setList(null);
  const listed: { title: string; body: ReactNode } | null =
    list === 'type'
      ? {
          title: t('eventForm.type'),
          body: (
            <TypeChoices
              type={draft.type === '' ? null : draft.type}
              onPick={(type) => {
                change('type', { draft: { ...draft, type: isEventType(type) ? type : '' } });
                closeList();
              }}
              testID="eventForm.type"
            />
          ),
        }
      : list === 'zone'
        ? {
            title: t('eventForm.timeZone'),
            body: (
              <Choices
                items={zones.map((zone) => ({ key: zone, title: timezoneLabel(zone) }))}
                on={timeZone}
                onPick={(zone) => {
                  change('timeZone', { timeZone: zone });
                  closeList();
                }}
                testID="eventForm.timeZone"
              />
            ),
          }
        : list === 'currency'
          ? {
              title: t('eventForm.currency'),
              body: (
                <CurrencyView
                  code={currency}
                  choices={currencies}
                  refused={false}
                  onPick={(code) => {
                    change('currency', { currency: code });
                    closeList();
                  }}
                />
              ),
            }
          : null;
  const over =
    pickerOver(picking, wallLocale, () => setPicking(null)) ??
    (listed == null
      ? null
      : {
          layer: (
            <SheetLayer onClose={closeList} label={t('eventEdit.cancel')}>
              <SheetBody
                title={listed.title}
                close={t('eventEdit.cancel')}
                onClose={closeList}
                closeTestID="eventForm.list.close"
              >
                {listed.body}
              </SheetBody>
            </SheetLayer>
          ),
          onClose: closeList,
        });

  const suggestions: Suggested[] = seen.suggestions.map((one) => ({
    key: one.id,
    title: one.text,
    line: one.secondaryText ?? undefined,
  }));
  const offer =
    seen.offered != null && seen.offered.zone !== timeZone
      ? {
          zone: seen.offered.zone,
          keep: timeZone,
          onUse: () => {
            const chosen = seen.offered?.zone;
            if (chosen != null) {
              change('timeZone', { timeZone: chosen });
              setSaid(t('eventForm.venueZoneSet', { zone: chosen }));
            }
            lookup.answered();
          },
          onKeep: () => lookup.answered(),
        }
      : null;

  const skipped = skippedLine(draft.startDate, draft.startTime, timeZone, wallLocale, t);
  const problems = unsent == null ? null : t('eventForm.problems', { count: unsent.count });
  const failed = t('eventForm.notCreated');
  const shownCover: Cover | null =
    photo.kind === 'chosen'
      ? {
          sizes: [{ width: photo.width, url: photo.uri }],
          position: POSITION_AT[position],
          description: null,
        }
      : null;
  const hostLines = hosts.map((row) => hostErrors[row.key] ?? null);
  const quiet = (section: FormSection) => sectionQuiet(quietAfter, section);

  return (
    <FocusedScreen
      gap={gap}
      open={open}
      title={t('eventForm.title')}
      verb={null}
      waits={status === 'sending'}
      onCancel={cancel}
      cancelTestID="eventForm.cancel"
      opener={opener}
      ask={leave}
      over={over}
      fills
      testID="eventForm"
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Part head={t('eventForm.aboutHeading')}>
          <EventField
            label={t('eventForm.name')}
            error={errors.name ?? null}
            help={t('eventForm.nameCount', {
              count: eventNameLength(draft.name),
              most: EVENT_NAME_MAXIMUM,
            })}
          >
            <BoxField
              ref={nameInput}
              value={draft.name}
              wrong={errors.name != null}
              editable={!busy}
              onChangeText={(name) => change('name', { draft: { ...draft, name } })}
              autoCorrect={false}
              accessibilityLabel={t('eventForm.name')}
              testID="eventForm.name"
            />
          </EventField>
          <View ref={fields.type}>
            <EventField
              label={t('eventForm.type')}
              error={errors.type ?? null}
              linesQuiet={quietAfter === 'type'}
            >
              <SelectBox
                ref={pickers.type}
                label={t('eventForm.type')}
                value={draft.type === '' ? null : t(`eventTypes.${draft.type}`)}
                placeholder={t('eventForm.typePlaceholder')}
                wrong={errors.type != null}
                onPress={() => !busy && setList('type')}
                testID="eventForm.type"
              />
            </EventField>
          </View>
        </Part>

        <Part head={t('eventHosts.heading')} quiet={quiet('hosts')}>
          <HostRows
            hosts={hosts}
            onHosts={editHosts}
            errors={hostLines}
            focusAt={focusHost?.key ?? null}
            refs={hostInputs}
            off={busy}
            onSaid={setSaid}
            testID="eventForm.hosts"
          />
        </Part>

        <Part head={t('eventForm.coverHeading')} quiet={quiet('cover')}>
          <CoverPreview
            photo={
              shownCover == null ? null : (
                <EventCover cover={shownCover} type={draft.type || 'other'} fill radius={0} />
              )
            }
            meshKey={draft.type === '' ? 'new-event' : draft.type}
          />
          {photo.kind === 'chosen' ? (
            <CoverPhotoFields
              position={position}
              onPosition={setPosition}
              described={described}
              onDescribed={(next) => {
                setDescribed(next);
                if (visibleLength(next) <= COVER_DESCRIPTION_MAXIMUM) setDescribeError(null);
                edited();
              }}
              count={visibleLength(described)}
              most={COVER_DESCRIPTION_MAXIMUM}
              describeError={describeError}
              describeRef={describeInput}
              onChange={() => void choosePhoto()}
              onRemove={removePhoto}
              off={busy}
            />
          ) : (
            <CoverUpload
              refused={coverRefused}
              off={busy}
              kind="secondary"
              onUpload={() => void choosePhoto()}
              testID="eventForm.cover.upload"
            />
          )}
        </Part>

        <Part head={t('eventForm.whenHeading')} quiet={quiet('startsAt')}>
          <View ref={fields.startsAt}>
            <DatePair
              label={t('eventForm.starts')}
              at={{ date: draft.startDate, time: draft.startTime }}
              locale={wallLocale}
              wrong={errors.startsAt != null}
              line={errors.startsAt ?? null}
              firstRef={pickers.startsAt}
              onPick={(mode) => !busy && pickStart(mode)}
              testID="eventForm.start"
            >
              <Lines quiet={quietAfter === 'startsAt'}>
                {errors.startsAt != null && <AlertLine text={errors.startsAt} />}
                {skipped != null && <Hint words={skipped} said />}
              </Lines>
            </DatePair>
          </View>
          <View ref={fields.endsAt} style={styles.part}>
            <DatePair
              label={t('eventForm.ends')}
              at={{ date: draft.endDate, time: draft.endTime }}
              locale={wallLocale}
              wrong={errors.endsAt != null}
              line={errors.endsAt ?? null}
              firstRef={pickers.endsAt}
              onPick={(mode) => !busy && pickEnd(mode)}
              testID="eventForm.end"
            >
              <Lines quiet={quiet('endsAt') || quietAfter === 'endsAt'}>
                {errors.endsAt != null ? (
                  <AlertLine text={errors.endsAt} />
                ) : moved != null ? (
                  <Hint words={moved} said />
                ) : (
                  <Hint words={t('eventForm.endsHint')} />
                )}
              </Lines>
            </DatePair>
          </View>
        </Part>

        <Part head={t('eventForm.venueHeading')} quiet={quiet('venueName')}>
          <VenueFieldsView
            name={venue.name}
            address={venue.address}
            onName={(name) => changeVenue({ name })}
            onAddress={(address) => {
              lookup.type(address);
              setErrors((was) => cleared(was, 'venueAddress'));
            }}
            suggestions={suggestions}
            onSuggestion={(key) => {
              const chosen = seen.suggestions.find((one) => one.id === key);
              if (chosen != null) void lookup.pick(chosen, timeZone);
            }}
            down={seen.down}
            offer={offer}
            nameError={errors.venueName ?? null}
            addressError={errors.venueAddress ?? null}
            nameRef={venueNameInput}
            addressRef={venueAddressInput}
            off={busy}
            testID="eventForm.venue"
          />
          <ArrivalNoteField
            note={venue.note}
            onNote={(note) => changeVenue({ note })}
            error={errors.arrivalNote ?? null}
            noteRef={noteInput}
            off={busy}
            testID="eventForm.arrivalNote"
          />
        </Part>

        <Part head={t('eventForm.zoneHeading')} quiet={quiet('timeZone')}>
          <View ref={fields.timeZone}>
            <EventField
              label={t('eventForm.timeZone')}
              error={errors.timeZone ?? null}
              linesQuiet={quietAfter === 'timeZone'}
              help={t('eventForm.timesIn', { zone: timeZone })}
            >
              <SelectBox
                ref={pickers.timeZone}
                label={t('eventForm.timeZone')}
                value={timezoneLabel(timeZone)}
                wrong={errors.timeZone != null}
                onPress={() => !busy && setList('zone')}
                testID="eventForm.timeZone"
              />
            </EventField>
          </View>
          <View
            ref={fields.currency}
            importantForAccessibility={quiet('currency') ? 'no-hide-descendants' : 'auto'}
          >
            <EventField
              label={t('eventForm.currency')}
              error={errors.currency ?? null}
              linesQuiet={quietAfter === 'currency'}
              help={t('eventForm.defaultsHint', { name: organisation.name })}
            >
              <SelectBox
                ref={pickers.currency}
                label={t('eventForm.currency')}
                value={currencyWords(currencies, currency)}
                placeholder={t('orgGeneral.currencyPlaceholder')}
                wrong={errors.currency != null}
                onPress={() => !busy && setList('currency')}
                testID="eventForm.currency"
              />
            </EventField>
          </View>
        </Part>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom > 0 ? 12 : 34 }]}>
        {status === 'failed' && <EventNotice tone="broken" words={failed} interrupts />}
        {problems != null && (
          <ReadOut words={problems} answer={unsent} afterKeysDown={unsent?.keysGoDown}>
            <AlertLine text={problems} />
          </ReadOut>
        )}
        {status === 'created' && (
          <DoneLine text={t('eventForm.created')} size={14.5} reads={false} />
        )}
        <Pill
          label={status === 'sending' ? t('eventForm.creating') : t('eventForm.create')}
          busy={busy}
          onPress={() => void send()}
          testID="eventForm.send"
        />
      </View>
    </FocusedScreen>
  );
}

function Part({
  head,
  quiet = false,
  children,
}: {
  head: string;
  /** Under TalkBack, a section after the refused picker is out of its reach while focus moves there (sc-43907). */
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.part} importantForAccessibility={quiet ? 'no-hide-descendants' : 'auto'}>
      <Legend text={head} />
      {children}
    </View>
  );
}

function Lines({ quiet, children }: { quiet: boolean; children: ReactNode }) {
  return (
    <View style={styles.lines} importantForAccessibility={quiet ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
  );
}

function cleared(was: EventErrors, field: EventFormField): EventErrors {
  return Object.fromEntries(Object.entries(was).filter(([key]) => key !== field));
}

function currencyWords(
  choices: readonly { code: string; name: string }[],
  code: string,
): string | null {
  if (code === '') return null;
  const named = choices.find((one) => one.code === code);

  return named == null ? code : `${code} · ${named.name}`;
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, flexShrink: 1 },
  body: {
    gap: tokens.space3xl,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space5xl,
  },
  part: { gap: tokens.spaceLg },
  lines: { gap: tokens.spaceXs },
  foot: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: tokens.spaceXxl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
});
