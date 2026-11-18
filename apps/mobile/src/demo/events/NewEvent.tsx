import {
  COVER_DESCRIPTION_MAXIMUM,
  type EventFormField,
  endMovedLine,
  eventNameLength,
  skippedLine,
  startMoved,
  visibleLength,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrivalNoteField, CoverPhotoFields } from '../../components/EventEdits.tsx';
import { EventNotice } from '../../components/EventNotice.tsx';
import { focusChecked } from '../../components/Field.tsx';
import { DoneLine, Legend, SheetBody, SheetLayer } from '../../components/FormLayers.tsx';
import { BoxField, type Picking, PickerLayer, pick } from '../../components/MomentPick.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import { type AskProps, FocusedScreen } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  ASK_WIDTH,
  AlertLine,
  Choices,
  CoverPreview,
  CoverUpload,
  CurrencySearch,
  DatePair,
  EventField,
  type Host,
  HostRows,
  SelectBox,
  TypeChoices,
  VenueFields,
  useEditGap,
} from './EventEdits.tsx';
import { ORGANISATION, TYPE_WORDS, ZONES, currencyRows, currencyWords } from './EventsSample.ts';
import { W, say, t } from './EventsWords.ts';
import {
  FILLED,
  type NewState,
  type NewTyped,
  type Refusals,
  checkOf,
  draftOf,
  firstRefused,
  typedFor,
  typedSomething,
} from './NewEventModel.ts';
import { hostErrorWords } from './hostErrors.ts';
import { openEvent } from './openEvent.ts';
import type { FromEnquiry } from '../enquiries/EnquiryToEventModel.ts';
import { useFromEnquiry } from '../enquiries/FromEnquiryParts.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;
type Status = 'editing' | 'creating' | 'failed' | 'created';
type ListOpen = 'type' | 'zone' | 'currency';

/** The draft the demo opens once Create goes through; the product opens the event it just made. */
export const CREATED_ID = 'evt-draft-4';
const CREATING_MS = 1200;
const OPENING_MS = 1600;

function statusOf(state: NewState | null): Status {
  if (state === 'newCreating') return 'creating';
  if (state === 'newNotCreated' || state === 'newOffline') return 'failed';
  if (state === 'newCreated') return 'created';
  return 'editing';
}

/** New event (sc-48607): the event's own part edits on one screen in today's order, Create event pinned under them. */
export function NewEventScreen({
  open,
  start,
  locale,
  opener,
  onClose,
  from,
}: {
  open: boolean;
  start: NewState | null;
  locale: string;
  opener: Opener;
  onClose: () => void;
  from?: FromEnquiry | undefined;
}) {
  const insets = useSafeAreaInsets();
  const gap = useEditGap();
  const [opened] = useState<NewTyped>(() => from?.typed ?? typedFor(start));
  const [typed, setTyped] = useState<NewTyped>(opened);
  const [tried, setTried] = useState(start === 'newRefused');
  const [status, setStatus] = useState<Status>(() => statusOf(start));
  const [server, setServer] = useState<Refusals>(
    start === 'newServer' ? { timeZone: W.zoneRefused } : {},
  );
  const [endChosen, setEndChosen] = useState(start === 'newRefused');
  const [moved, setMoved] = useState<string | null>(() =>
    start === 'newMoved'
      ? endMovedLine(draftOf(FILLED), draftOf(typedFor('newMoved')), locale, t)
      : null,
  );
  const [picking, setPicking] = useState<Picking | null>(null);
  const [list, setList] = useState<ListOpen | null>(null);
  const [leaving, setLeaving] = useState(start === 'newLeave');
  const [said, setSaid] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(() =>
    start === 'newRefused' ? checkOf(opened).summary : null,
  );
  const [target, setTarget] = useState<Target | null>(() =>
    start === 'newRefused' ? targetOf(opened, {}) : null,
  );
  const nameRef = useRef<TextInputInstance>(null);
  const venueNameRef = useRef<TextInputInstance>(null);
  const addressRef = useRef<TextInputInstance>(null);
  const noteRef = useRef<TextInputInstance>(null);
  const describeRef = useRef<TextInputInstance>(null);
  const typeRef = useRef<ViewInstance>(null);
  const startRef = useRef<ViewInstance>(null);
  const endRef = useRef<ViewInstance>(null);
  const zoneRef = useRef<ViewInstance>(null);
  const currencyRef = useRef<ViewInstance>(null);
  const hostRefs = useRef(new Map<number, TextInputInstance>());
  const scrollRef = useRef<ScrollViewInstance>(null);
  const busy = status === 'creating' || status === 'created';
  const check = checkOf(typed);
  const shown: Refusals = { ...(tried ? check.refusals : {}), ...server };
  const hostErrors = tried ? check.hosts : hostErrorWords(names(typed.hosts), false);
  const skipped = skippedLine(typed.start.date, typed.start.time, typed.timeZone, locale, t);
  const enquiry = useFromEnquiry(from, {
    busy,
    currency: typed.currency,
    scroll: scrollRef,
  });

  useReadOut(said);

  const change = (next: Partial<NewTyped>) => {
    setTyped((was) => ({ ...was, ...next }));
    setSummary(null);
    if (status === 'failed') setStatus('editing');
  };

  useEffect(() => {
    if (target == null) return;
    if ('host' in target) {
      const input = hostRefs.current.get(target.host);
      if (input != null) focusChecked({ current: input });
      return;
    }
    if ('cover' in target) {
      focusChecked(describeRef);
      return;
    }
    const typedIn: Partial<Record<EventFormField, RefObject<TextInputInstance | null>>> = {
      name: nameRef,
      venueName: venueNameRef,
      venueAddress: addressRef,
      arrivalNote: noteRef,
    };
    const picker: Partial<Record<EventFormField, RefObject<ViewInstance | null>>> = {
      type: typeRef,
      startsAt: startRef,
      endsAt: endRef,
      timeZone: zoneRef,
      currency: currencyRef,
    };
    const input = typedIn[target.field];
    if (input != null) focusChecked(input);
    else moveScreenReaderFocus(picker[target.field]?.current ?? null);
  }, [target]);

  useEffect(() => {
    if (status === 'creating' && start !== 'newCreating') {
      const later = setTimeout(
        () => setStatus(enquiry.refuses ? 'failed' : 'created'),
        CREATING_MS,
      );

      return () => clearTimeout(later);
    }
    if (status === 'created') {
      const later = setTimeout(() => {
        onClose();
        openEvent(
          CREATED_ID,
          enquiry.opens ?? (start === 'newPhotoRefused' ? { state: 'createdNoPhoto' } : undefined),
        );
      }, OPENING_MS);

      return () => clearTimeout(later);
    }
    return undefined;
  }, [status, start, onClose, enquiry.refuses, enquiry.opens]);

  const create = () => {
    if (busy) return;
    setTried(true);
    const now = checkOf(typed);
    const count = now.count + Object.keys(server).filter((key) => !(key in now.refusals)).length;
    if (count > 0) {
      setSummary(say.problems(count));
      setTarget(targetOf(typed, server));
      return;
    }
    setSummary(null);
    setStatus('creating');
  };

  const pickStart = (mode: 'date' | 'time') =>
    pick(
      {
        title: say.timesIn(typed.timeZone),
        mode,
        field: typed.start.date === '' ? { date: '2027-03-13', time: '18:00' } : typed.start,
        take: (next) => {
          const before = draftOf(typed);
          const after = startMoved(
            before,
            { startDate: next.date, startTime: next.time },
            endChosen,
            typed.timeZone,
          );
          change({
            start: next,
            end: { date: after.endDate, time: after.endTime },
          });
          setMoved(endMovedLine(before, after, locale, t));
        },
      },
      setPicking,
    );
  const pickEnd = (mode: 'date' | 'time') =>
    pick(
      {
        title: say.timesIn(typed.timeZone),
        mode,
        field:
          typed.end.date === ''
            ? typed.start.date === ''
              ? { date: '2027-03-13', time: '23:00' }
              : typed.start
            : typed.end,
        take: (next) => {
          change({ end: next });
          setEndChosen(true);
          setMoved(null);
        },
      },
      setPicking,
    );

  const cancel = () => {
    if (busy) return;
    if (typedSomething(typed)) setLeaving(true);
    else onClose();
  };
  const leave: AskProps | null = leaving
    ? {
        title: W.leaveTitle,
        line: W.leaveBody,
        keep: { label: W.keepEditing, testID: 'events.new.leave.keep' },
        confirm: { label: W.leave, testID: 'events.new.leave.go', removes: true },
        onKeep: () => setLeaving(false),
        onConfirm: () => {
          setLeaving(false);
          onClose();
        },
        width: ASK_WIDTH,
      }
    : null;

  const closeList = () => setList(null);
  const over =
    picking != null
      ? {
          layer: <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />,
          onClose: () => setPicking(null),
        }
      : list != null
        ? {
            layer: (
              <SheetLayer onClose={closeList} label={W.cancel}>
                <SheetBody
                  title={list === 'type' ? W.type : list === 'zone' ? W.timeZone : W.currency}
                  close={W.cancel}
                  onClose={closeList}
                >
                  {list === 'type' ? (
                    <TypeChoices
                      type={typed.type === '' ? null : typed.type}
                      onPick={(type) => {
                        change({ type });
                        closeList();
                      }}
                      testID="events.new.type"
                    />
                  ) : list === 'zone' ? (
                    <Choices
                      items={ZONES.map((one) => ({ key: one, title: one }))}
                      on={typed.timeZone}
                      onPick={(timeZone) => {
                        change({ timeZone });
                        setServer({});
                        closeList();
                      }}
                      testID="events.new.zone"
                    />
                  ) : (
                    <CurrencySearch
                      code={typed.currency}
                      rows={currencyRows('')}
                      onPick={(currency) => {
                        change({ currency });
                        closeList();
                      }}
                      testID="events.new.currency"
                    />
                  )}
                </SheetBody>
              </SheetLayer>
            ),
            onClose: closeList,
          }
        : enquiry.over;

  return (
    <FocusedScreen
      gap={gap}
      open={open}
      title={W.newEvent}
      verb={null}
      onCancel={cancel}
      cancelTestID="events.new.cancel"
      opener={opener}
      ask={leave}
      over={over}
      fills
      testID="events.new"
    >
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {enquiry.notice}
        <Part head={W.aboutHeading}>
          <EventField
            label={W.eventName}
            error={shown.name ?? null}
            help={say.nameCount(eventNameLength(typed.name))}
          >
            <BoxField
              ref={nameRef}
              value={typed.name}
              wrong={shown.name != null}
              editable={!busy}
              onChangeText={(name) => change({ name })}
              autoCorrect={false}
              accessibilityLabel={W.eventName}
              testID="events.new.name"
            />
          </EventField>
          <EventField label={W.type} error={shown.type ?? null}>
            <SelectBox
              ref={typeRef}
              label={W.type}
              value={typed.type === '' ? null : TYPE_WORDS[typed.type]}
              placeholder={W.typePlaceholder}
              wrong={shown.type != null}
              onPress={() => !busy && setList('type')}
              testID="events.new.type"
            />
          </EventField>
        </Part>

        <Part head={W.hostedBy}>
          <HostRows
            hosts={typed.hosts}
            onHosts={(hosts: Host[]) => change({ hosts })}
            errors={hostErrors}
            refs={hostRefs}
            off={busy}
            onSaid={setSaid}
            testID="events.new.hosts"
          />
        </Part>
        {enquiry.lead}

        <Part head={W.coverPhoto}>
          <CoverPart
            typed={typed}
            off={busy}
            error={tried ? check.cover : null}
            describeRef={describeRef}
            onCover={(cover) => change(cover)}
          />
        </Part>

        <Part head={W.whenHeading}>
          <DatePair
            label={W.starts}
            at={typed.start}
            locale={locale}
            wrong={shown.startsAt != null}
            firstRef={startRef}
            onPick={(mode) => !busy && pickStart(mode)}
            testID="events.new.start"
          >
            {shown.startsAt != null && <AlertLine text={shown.startsAt} />}
            {skipped != null && (
              <Text size={13.5} weight="semibold" style={styles.hint}>
                {skipped}
              </Text>
            )}
          </DatePair>
          <DatePair
            label={W.ends}
            at={typed.end}
            locale={locale}
            wrong={shown.endsAt != null}
            firstRef={endRef}
            onPick={(mode) => !busy && pickEnd(mode)}
            testID="events.new.end"
          >
            {shown.endsAt != null ? (
              <AlertLine text={shown.endsAt} />
            ) : moved != null ? (
              <Text size={13.5} weight="semibold" style={styles.hint}>
                {moved}
              </Text>
            ) : (
              <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
                {W.endsHint}
              </Text>
            )}
          </DatePair>
        </Part>

        <Part head={W.venue}>
          <VenueFields
            name={typed.venueName}
            address={typed.venueAddress}
            onName={(venueName) => change({ venueName })}
            onAddress={(venueAddress) => change({ venueAddress })}
            zone={typed.timeZone}
            onZone={(timeZone) => {
              change({ timeZone });
              setServer({});
              setSaid(say.zoneSet(timeZone));
            }}
            down={false}
            nameError={shown.venueName ?? null}
            addressError={shown.venueAddress ?? null}
            nameRef={venueNameRef}
            addressRef={addressRef}
            off={busy}
            testID="events.new.venue"
          />
          <ArrivalNoteField
            note={typed.note}
            onNote={(note) => !busy && change({ note })}
            error={shown.arrivalNote ?? null}
            noteRef={noteRef}
            off={busy}
            testID="events.new.venue.note"
          />
        </Part>

        <Part head={W.zoneHeading}>
          <EventField
            label={W.timeZone}
            error={shown.timeZone ?? null}
            help={say.timesIn(typed.timeZone)}
          >
            <SelectBox
              ref={zoneRef}
              label={W.timeZone}
              value={typed.timeZone}
              wrong={shown.timeZone != null}
              onPress={() => !busy && setList('zone')}
              testID="events.new.zone"
            />
          </EventField>
          <EventField
            label={W.currency}
            error={shown.currency ?? null}
            help={enquiry.currencyHelp ?? say.defaultsHint(ORGANISATION)}
          >
            <SelectBox
              ref={currencyRef}
              label={W.currency}
              value={typed.currency === '' ? null : currencyWords(typed.currency)}
              placeholder={W.currencyBlank}
              wrong={shown.currency != null}
              onPress={() => !busy && setList('currency')}
              testID="events.new.currency"
            />
          </EventField>
        </Part>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: Math.max(12, insets.bottom > 0 ? 12 : 34) }]}>
        {status === 'failed' && (
          <EventNotice tone="broken" words={enquiry.notCreated ?? W.notCreated} interrupts />
        )}
        {summary != null && <AlertLine text={summary} />}
        {status === 'created' && <DoneLine text={W.newCreated} size={14.5} />}
        <Pill
          label={status === 'creating' ? W.creatingNow : W.create}
          busy={busy}
          onPress={create}
          testID="events.new.create"
        />
      </View>
    </FocusedScreen>
  );
}

type Target = { field: EventFormField } | { host: number } | { cover: true };

/** The first refusal in the form's order, a host by its row's key; a new object each time, so each press of Create moves focus. */
function targetOf(typed: NewTyped, server: Refusals): Target | null {
  const now = checkOf(typed);
  const first = firstRefused({ ...now.refusals, ...server }, now.hosts, now.cover);
  if (first == null) return null;
  if (!('host' in first)) return { ...first };
  const row = typed.hosts[first.host];

  return row == null ? null : { host: row.key };
}

function names(hosts: readonly Host[]): string[] {
  return hosts.map((host) => host.name);
}

function Part({ head, children }: { head: string; children: ReactNode }) {
  return (
    <View style={styles.part}>
      <Legend text={head} />
      {children}
    </View>
  );
}

const NO_PHOTO = { photo: false, position: 'middle', described: '' } as const;
const CHOSEN = { photo: true, position: 'middle', described: '' } as const;

type Cover = Pick<NewTyped, 'photo' | 'position' | 'described'>;

/** Cover: Soirely's cover in the type's colours until a photo is chosen, then the cover edit's own Position and Description; all of it goes up once the draft exists. */
function CoverPart({
  typed,
  off,
  error,
  describeRef,
  onCover,
}: {
  typed: NewTyped;
  off: boolean;
  error: string | null;
  describeRef: RefObject<TextInputInstance | null>;
  onCover: (cover: Partial<Cover>) => void;
}) {
  return (
    <>
      <CoverPreview
        photo={typed.photo}
        meshKey={typed.type === '' ? 'new-event' : typed.type}
        id="new-event-cover"
      />
      {typed.photo ? (
        <CoverPhotoFields
          position={typed.position}
          onPosition={(position) => onCover({ position })}
          described={typed.described}
          onDescribed={(described) => !off && onCover({ described })}
          count={visibleLength(typed.described)}
          most={COVER_DESCRIPTION_MAXIMUM}
          describeError={error}
          describeRef={describeRef}
          onChange={() => onCover(CHOSEN)}
          onRemove={() => onCover(NO_PHOTO)}
          off={off}
        />
      ) : (
        <CoverUpload
          off={off}
          kind="secondary"
          onUpload={() => onCover(CHOSEN)}
          testID="events.new.cover.upload"
        />
      )}
    </>
  );
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
  foot: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: tokens.spaceXxl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  secondary: { color: tokens.colorInkSecondary },
  hint: { lineHeight: 13.5 * 1.4 },
  lines: { lineHeight: 15 * 1.45 },
});
