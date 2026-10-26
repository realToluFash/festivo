import {
  ApiError,
  type EventCover as EventCoverPhoto,
  type Membership,
  type TaggedEvent,
} from '@soirely/api-client';
import {
  EVENT_NAME_MAXIMUM,
  EVENT_TYPES,
  type EventDraft,
  type EventFormField,
  type VenueDraft,
  currencyChoices,
  eventChanges,
  eventFormErrors,
  eventNameLength,
  filledEndDate,
  formatWallClock,
  formatWallDay,
  isEventType,
  shownPhase,
  skippedLine,
  timezoneLabel,
  withCurrent,
} from '@soirely/domain';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { currentLocale, dateLocale } from '../i18n/index.ts';
import {
  type EventErrors,
  type EventTyped,
  blankEvent,
  firstRefused,
  isDirty,
  newEventOf,
  pickedDate,
  pickedTime,
  pickerValue,
  sendOutcome,
  typedOf,
} from '../kit/eventForm.ts';
import { coverRefusalOf } from '../kit/coverUpload.ts';
import { markCoverRefused } from '../kit/eventSaved.ts';
import { useLoadedAt, useServerNow } from '../kit/serverNow.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { holdSwitches } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { type CoverUse, CoverField, discardCoverUpload } from './CoverField.tsx';
import { focusPicker } from './CountryPicker.tsx';
import { CONTROL_TEXT_SIZE, Field, FieldError, TextField, focusChecked } from './Field.tsx';
import { ListPicker } from './ListPicker.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';
import { VenueFields } from './VenueFields.tsx';

type Status = 'editing' | 'sending' | 'failed' | 'changedElsewhere' | 'created';

type Asking = 'leave' | 'latest' | null;

export function EventForm({
  kind,
  organisation,
  opened,
  onCreated,
  onSaved,
  onLatest,
}: {
  kind: LayoutKind;
  organisation: Membership;
  opened?: TaggedEvent | undefined;
  onCreated: (eventId: string) => void;
  onSaved: (outcome: 'saved' | 'unchanged') => void;
  /** Show the latest: the event is read again and the form starts over from it. */
  onLatest: (latest: TaggedEvent) => void;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const locale = currentLocale();
  const editing = opened != null;
  const [from] = useState<EventTyped>(() =>
    opened == null ? blankEvent(organisation) : typedOf(opened.event),
  );
  const [typed, setTyped] = useState(from);
  const [endChosen, setEndChosen] = useState(editing);
  const [errors, setErrors] = useState<EventErrors>({});
  const [unsent, setUnsent] = useState<{ count: number } | null>(null);
  const [status, setStatus] = useState<Status>('editing');
  const [asking, setAsking] = useState<Asking>(null);
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const leaving = useRef(false);
  const leaveAction = useRef<(() => void) | null>(null);
  const { draft, venue, timeZone, currency } = typed;
  const [cover, setCover] = useState<EventCoverPhoto | null>(opened?.event.cover ?? null);
  const staged = useRef<string | null>(null);
  const busy = status === 'sending';
  const now = useServerNow();
  const loadedAt = useLoadedAt(opened?.event ?? from);
  const over = opened != null && shownPhase(opened.event, loadedAt, now) === 'finished';
  const dirty = isDirty(typed, from) || (!editing && cover != null);

  const nameInput = useRef<TextInput>(null);
  const venueNameInput = useRef<TextInput>(null);
  const venueAddressInput = useRef<TextInput>(null);
  const typePicker = useRef<View>(null);
  const startPicker = useRef<View>(null);
  const endPicker = useRef<View>(null);
  const zonePicker = useRef<View>(null);
  const currencyPicker = useRef<View>(null);
  const [focusOn, setFocusOn] = useState<{ field: EventFormField } | null>(null);

  useEffect(() => {
    if (focusOn == null) return;
    const field = focusOn.field;
    const typedIn = { name: nameInput, venueName: venueNameInput, venueAddress: venueAddressInput };

    if (field === 'name' || field === 'venueName' || field === 'venueAddress')
      focusChecked(typedIn[field]);
    else
      focusPicker(
        {
          type: typePicker,
          startsAt: startPicker,
          endsAt: endPicker,
          timeZone: zonePicker,
          currency: currencyPicker,
        }[field],
      );
  }, [focusOn]);

  // A save or a create leaves before the state saying so has rendered, so the ref decides.
  usePreventRemove(dirty, ({ data }) => {
    if (leaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    leaveAction.current = () => navigation.dispatch(data.action);
    setAsking('leave');
  });

  useEffect(
    () => () => {
      if (staged.current != null) discardCoverUpload(organisation.id, staged.current);
    },
    [organisation.id],
  );

  /** New event keeps the photo until the event exists; Edit details saves it at once, as the web's forms do. */
  async function keepCover({ upload, position, description }: CoverUse): Promise<void> {
    if (opened != null) {
      const updated = await api.setEventCover(opened.event.id, {
        ...(upload == null ? {} : { uploadKey: upload.key }),
        position,
        description,
      });
      setCover(updated.cover);
      return;
    }

    if (upload != null && staged.current != null && staged.current !== upload.key)
      discardCoverUpload(organisation.id, staged.current);
    if (upload != null) staged.current = upload.key;
    setCover((previous) => {
      const sizes = upload?.preview.sizes ?? previous?.sizes;

      return sizes == null ? null : { sizes, position, description };
    });
  }

  async function removeCover(): Promise<void> {
    if (opened != null) {
      setCover((await api.removeEventCover(opened.event.id)).cover);
      return;
    }

    if (staged.current != null) discardCoverUpload(organisation.id, staged.current);
    staged.current = null;
    setCover(null);
  }

  // The frame's switcher would remount or unmount the form, so it asks as leaving does.
  useEffect(
    () =>
      dirty
        ? holdSwitches((go) => {
            leaveAction.current = go;
            setAsking('leave');
          })
        : undefined,
    [dirty],
  );

  const types = useMemo(
    () => EVENT_TYPES.map((type) => ({ code: type, name: t(`eventTypes.${type}`) })),
    [t],
  );
  const zones = useMemo(
    () =>
      withCurrent(Intl.supportedValuesOf('timeZone'), from.timeZone).map((zone) => ({
        code: zone,
        name: timezoneLabel(zone),
      })),
    [from.timeZone],
  );
  const currencies = useMemo(
    () =>
      currencyChoices(opened?.event.currency ?? '', locale, (code) =>
        t('orgGeneral.currencyRetired', { code }),
      ),
    [opened?.event.currency, locale, t],
  );

  function change(field: EventFormField, next: Partial<EventTyped>): void {
    setTyped((previous) => ({ ...previous, ...next }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    if (status === 'failed') setStatus('editing');
  }

  const changeVenue = useCallback((next: Partial<VenueDraft>): void => {
    setTyped((previous) => ({ ...previous, venue: { ...previous.venue, ...next } }));
    setErrors((previous) => {
      const left = { ...previous };
      if ('name' in next) delete left.venueName;
      if ('address' in next) delete left.venueAddress;

      return left;
    });
    setStatus((previous) => (previous === 'failed' ? 'editing' : previous));
  }, []);

  function changeDraft(field: EventFormField, next: Partial<EventDraft>): void {
    change(field, { draft: { ...draft, ...next } });
  }

  function refuse(found: EventErrors): void {
    setErrors(found);
    const first = firstRefused(found);
    setFocusOn(first == null ? null : { field: first });
  }

  async function send(): Promise<void> {
    if (busy) return;

    const found = eventFormErrors(typed, t);
    const count = Object.keys(found).length;

    if (count > 0) {
      setUnsent({ count });
      setStatus('editing');
      refuse(found);
      return;
    }

    setUnsent(null);

    if (opened != null && !dirty) {
      onSaved('unchanged');
      return;
    }

    const body = opened == null ? newEventOf(typed) : null;
    if (opened == null && body == null) return;

    setStatus('sending');

    try {
      if (body != null) {
        const created = await api.createEvent(organisation.id, body);
        const uploadKey = staged.current;
        staged.current = null;

        // The event exists either way, so a refused or failed cover is said on its page rather than here.
        if (uploadKey != null && cover != null)
          await api
            .setEventCover(created.id, {
              uploadKey,
              position: cover.position,
              description: cover.description,
            })
            .catch((error: unknown) => markCoverRefused(created.id, coverRefusalOf(error, t)));

        setStatus('created');
        leaving.current = true;
        onCreated(created.id);
      } else if (opened != null) {
        await api.updateEvent(opened.event.id, eventChanges(opened.event, typed), opened.tag);
        leaving.current = true;
        onSaved('saved');
      }
    } catch (error) {
      const outcome = sendOutcome(error, t);

      if (outcome.kind === 'refused') {
        setStatus('editing');
        refuse(outcome.errors);
        return;
      }

      setStatus(outcome.kind);
    }
  }

  async function showLatest(): Promise<void> {
    if (opened == null) return;
    setFetchingLatest(true);

    try {
      const latest = await api.taggedEvent(opened.event.id);
      leaving.current = true;
      onLatest(latest);
    } catch {
      setFetchingLatest(false);
      setAsking(null);
      setStatus('failed');
    }
  }

  const failed = editing ? t('eventEdit.notSaved') : t('eventForm.notCreated');
  const problems = unsent == null ? null : t('eventForm.problems', { count: unsent.count });

  return (
    <>
      {status === 'created' && (
        <ReadOut words={t('eventForm.created')} interrupts>
          <Notice tone="done" mark={tokens.marks.done.glyph} body={t('eventForm.created')} />
        </ReadOut>
      )}
      {status === 'failed' && (
        <ReadOut words={failed} interrupts accessibilityRole="alert">
          <Notice tone="broken" mark={tokens.marks.broken.glyph} body={failed} />
        </ReadOut>
      )}
      {status === 'changedElsewhere' && (
        <ReadOut words={t('eventEdit.changedElsewhere')} interrupts accessibilityRole="alert">
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('eventEdit.changedElsewhere')}
          />
          <View style={styles.actions}>
            <SecondaryButton
              label={t('eventEdit.showLatest')}
              onPress={() => setAsking('latest')}
              testID="eventForm.showLatest"
            />
            <SecondaryButton
              label={t('eventEdit.cancel')}
              onPress={() => setStatus('editing')}
              testID="eventForm.keepMine"
            />
          </View>
        </ReadOut>
      )}
      {problems != null && <ReadOut words={problems} answer={unsent} />}

      <View style={cardFrame(kind)}>
        <Field
          label={t('eventForm.name')}
          error={errors.name}
          help={t('eventForm.nameCount', {
            count: eventNameLength(draft.name),
            most: EVENT_NAME_MAXIMUM,
          })}
        >
          <TextField
            ref={nameInput}
            value={draft.name}
            onChangeText={(name) => changeDraft('name', { name })}
            wrong={errors.name != null}
            submitting={busy}
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => venueNameInput.current?.focus()}
            accessibilityLabel={t('eventForm.name')}
            testID="eventForm.name"
          />
        </Field>

        <Field label={t('eventForm.type')} error={errors.type}>
          <ListPicker
            label={t('eventForm.type')}
            placeholder={t('eventForm.typePlaceholder')}
            searchLabel={t('eventForm.searchType')}
            choices={types}
            value={draft.type}
            onChange={(type) => changeDraft('type', { type: isEventType(type) ? type : '' })}
            disabled={busy}
            pickerRef={typePicker}
            testID="eventForm.type"
          />
        </Field>

        <CoverField
          type={draft.type}
          cover={cover}
          organisationId={organisation.id}
          busy={busy}
          onUse={keepCover}
          onRemove={removeCover}
        />

        {over && (
          <Text size={tokens.typeBody.size} muted testID="eventForm.scheduleOver">
            {t('eventEdit.scheduleConcluded')}
          </Text>
        )}

        <Moment
          label={t('eventForm.starts')}
          date={draft.startDate}
          time={draft.startTime}
          timeZone={timeZone}
          error={errors.startsAt}
          disabled={busy || over}
          pickerRef={startPicker}
          testID="eventForm.start"
          onPick={(date, time) =>
            changeDraft('startsAt', {
              startDate: date,
              startTime: time,
              endDate: filledEndDate(date, draft.endDate, endChosen),
            })
          }
        />

        <Moment
          label={t('eventForm.ends')}
          help={t('eventForm.endsHint')}
          date={draft.endDate}
          time={draft.endTime}
          timeZone={timeZone}
          error={errors.endsAt}
          disabled={busy || over}
          pickerRef={endPicker}
          testID="eventForm.end"
          onPick={(date, time) => {
            if (date !== draft.endDate) setEndChosen(true);
            changeDraft('endsAt', { endDate: date, endTime: time });
          }}
        />

        <VenueFields
          venue={venue}
          errors={errors}
          busy={busy}
          timeZone={timeZone}
          nameInput={venueNameInput}
          addressInput={venueAddressInput}
          onVenue={changeVenue}
          {...(over ? {} : { onUseZone: (zone: string) => change('timeZone', { timeZone: zone }) })}
        />

        <Field label={t('eventForm.timeZone')} error={errors.timeZone}>
          <ListPicker
            label={t('eventForm.timeZone')}
            searchLabel={t('orgGeneral.searchTimezone')}
            choices={zones}
            value={timeZone}
            onChange={(zone) => change('timeZone', { timeZone: zone })}
            disabled={busy || over}
            pickerRef={zonePicker}
            testID="eventForm.timeZone"
          />
        </Field>

        <Field
          label={t('eventForm.currency')}
          error={errors.currency}
          help={editing ? undefined : t('eventForm.defaultsHint', { name: organisation.name })}
        >
          <ListPicker
            label={t('eventForm.currency')}
            placeholder={t('orgGeneral.currencyPlaceholder')}
            searchLabel={t('orgGeneral.searchCurrency')}
            choices={currencies}
            value={currency}
            onChange={(code) => change('currency', { currency: code })}
            disabled={busy}
            pickerRef={currencyPicker}
            testID="eventForm.currency"
          />
        </Field>

        <PrimaryButton
          label={
            editing
              ? busy
                ? t('eventEdit.saving')
                : t('eventEdit.save')
              : busy
                ? t('eventForm.creating')
                : t('eventForm.create')
          }
          onPress={() => void send()}
          busy={busy || status === 'created'}
          testID="eventForm.send"
        />
      </View>

      <Ask
        open={asking === 'leave'}
        title={t('eventEdit.leaveTitle')}
        body={t('eventForm.leaveBody')}
        go={t('eventEdit.leave')}
        pending={false}
        onGo={() => {
          setAsking(null);
          leaving.current = true;
          leaveAction.current?.();
        }}
        onKeep={() => setAsking(null)}
        testID="eventForm.leave"
      />
      <Ask
        open={asking === 'latest'}
        title={t('eventEdit.showLatestTitle')}
        body={t('eventEdit.showLatestBody')}
        go={t('eventEdit.showLatest')}
        pending={fetchingLatest}
        onGo={() => void showLatest()}
        onKeep={() => setAsking(null)}
        testID="eventForm.latest"
      />
    </>
  );
}

/** Keep editing is the safe answer, so it comes first and system back gives it. */
function Ask({
  open,
  title,
  body,
  go,
  pending,
  onGo,
  onKeep,
  testID,
}: {
  open: boolean;
  title: string;
  body: string;
  go: string;
  pending: boolean;
  onGo: () => void;
  onKeep: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const opener = useRef<View>(null);

  return (
    <Sheet open={open} onClose={onKeep} opener={opener} testID={testID}>
      <View style={styles.ask}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
          {title}
        </Text>
        <Text size={tokens.typeBodyPhone.size}>{body}</Text>
        <PrimaryButton
          label={t('eventEdit.keepEditing')}
          onPress={onKeep}
          off={pending}
          testID={`${testID}.keep`}
        />
        <SecondaryButton label={go} onPress={onGo} off={pending} testID={`${testID}.go`} />
      </View>
    </Sheet>
  );
}

/** A start or an end: the platform's own date and time pickers, in the event's zone, named beside them. */
function Moment({
  label,
  help,
  date,
  time,
  timeZone,
  error,
  disabled,
  pickerRef,
  testID,
  onPick,
}: {
  label: string;
  help?: string;
  date: string;
  time: string;
  timeZone: string;
  error: string | undefined;
  disabled: boolean;
  pickerRef: RefObject<View | null>;
  testID: string;
  onPick: (date: string, time: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [picking, setPicking] = useState<'date' | 'time' | null>(null);
  const [held, setHeld] = useState<Date | null>(null);
  const skipped = skippedLine(date, time, timeZone, locale, t);
  const helpLines = [skipped, help].filter((line) => line != null);

  function open(mode: 'date' | 'time'): void {
    const value = pickerValue(date, time, new Date());

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        timeZoneName: 'UTC',
        onChange: (event, picked) => {
          if (event.type === 'set' && picked != null) take(mode, picked);
        },
      });
      return;
    }

    setHeld(value);
    setPicking(mode);
  }

  function take(mode: 'date' | 'time', picked: Date): void {
    if (mode === 'date') onPick(pickedDate(picked), time);
    else onPick(date === '' ? pickedDate(picked) : date, pickedTime(picked));
  }

  const dayWords = date === '' ? t('eventForm.date') : formatWallDay(date, locale);
  const timeWords = time === '' ? t('eventForm.time') : formatWallClock(time, locale);

  return (
    <View style={styles.momentGroup}>
      <View style={styles.momentHead}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {label}
        </Text>
        <View style={styles.zone}>
          <Text size={tokens.typePill.size} weight="semibold" style={styles.secondary}>
            {timeZone}
          </Text>
        </View>
      </View>
      <View style={styles.moment}>
        <View style={styles.pickDate}>
          <Field label={t('eventForm.date')}>
            <Pressable
              ref={pickerRef}
              style={[styles.pick, error != null && styles.pickWrong]}
              onPress={() => open('date')}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t('eventForm.date')}
              accessibilityValue={{
                text: [label, date === '' ? null : dayWords, timeZone]
                  .filter((part) => part != null)
                  .join(', '),
              }}
              testID={`${testID}.date`}
            >
              <Text size={CONTROL_TEXT_SIZE} style={date === '' ? styles.placeholder : undefined}>
                {dayWords}
              </Text>
            </Pressable>
          </Field>
        </View>
        <Field label={t('eventForm.time')}>
          <Pressable
            style={[styles.pick, error != null && styles.pickWrong]}
            onPress={() => open('time')}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('eventForm.time')}
            accessibilityValue={{
              text: [label, time === '' ? null : timeWords, timeZone]
                .filter((part) => part != null)
                .join(', '),
            }}
            testID={`${testID}.time`}
          >
            <Text size={CONTROL_TEXT_SIZE} style={time === '' ? styles.placeholder : undefined}>
              {timeWords}
            </Text>
          </Pressable>
        </Field>
      </View>
      {error != null && <FieldError message={error} />}
      {helpLines.map((line) => (
        <Text key={line} size={tokens.typeSmall.size} style={styles.secondary}>
          {line}
        </Text>
      ))}

      {Platform.OS === 'ios' && (
        <Sheet
          open={picking != null}
          onClose={() => setPicking(null)}
          scrimLabel={t('eventForm.pickerDone')}
          opener={pickerRef}
          testID={`${testID}.sheet`}
        >
          <View style={styles.ask}>
            <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
              {t('eventForm.timesIn', { zone: timeZone })}
            </Text>
            {picking != null && held != null && (
              <DateTimePicker
                value={held}
                mode={picking}
                display={picking === 'date' ? 'inline' : 'spinner'}
                timeZoneName="UTC"
                locale={locale}
                onChange={(_event, picked) => picked != null && setHeld(picked)}
              />
            )}
            <PrimaryButton
              label={t('eventForm.pickerDone')}
              onPress={() => {
                if (picking != null && held != null) take(picking, held);
                setPicking(null);
              }}
              testID={`${testID}.done`}
            />
          </View>
        </Sheet>
      )}
    </View>
  );
}

/** Opened for editing, the event is read with its tag, as the web's form reads it (sc-3587). */
export async function readTagged(
  eventId: string,
  organisationId: string,
): Promise<TaggedEvent | 'notFound' | 'failed'> {
  try {
    const tagged = await api.taggedEvent(eventId);

    return tagged.event.organisationId === organisationId ? tagged : 'notFound';
  } catch (error) {
    return error instanceof ApiError && (error.status === 404 || error.status === 403)
      ? 'notFound'
      : 'failed';
  }
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  ask: { gap: tokens.spaceLg, padding: tokens.spaceXl },
  momentGroup: { gap: tokens.spaceXs },
  momentHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  zone: {
    minHeight: tokens.sizePill,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  secondary: { color: tokens.colorInkSecondary },
  moment: { flexDirection: 'row', gap: tokens.spaceSm },
  pick: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusField,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  pickDate: { flex: 1 },
  pickWrong: { borderColor: tokens.colorBroken },
  placeholder: { color: tokens.colorInkTertiary },
});
