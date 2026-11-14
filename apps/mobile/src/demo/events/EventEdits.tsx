import {
  EVENT_TYPES,
  type EventType,
  HOSTS_MAXIMUM,
  endMovedLine,
  eventProblems,
  formatWallDay,
  hostProblems,
  keepsLastHost,
  startMoved,
} from '@soirely/domain';
import {
  type ComponentProps,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { RadioMark } from '../../components/RadioMark.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { EventMesh } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { AlertLine } from '../../components/AlertLine.tsx';
import { LineIcon } from '../../components/AccountCard.tsx';
import { PhotoFill } from '../../components/EventThumb.tsx';
import { EventField as ProductField } from '../../components/EventField.tsx';
import { EventNotice } from '../../components/EventNotice.tsx';
import { type EditPart, type EventDemoState, folded, instantOf, wallOf } from './EventsModel.ts';
import { ARRIVAL_NOTE, LONG_NOTE, NOTE_WORDS, noteTooLong, savedNote } from './ArrivalNote.ts';
import {
  CLOSES_AT,
  datesAsk,
  noReplyOf,
  replyByAskCount,
  previewsReplyBy,
  replyByAfterStart,
  replyByAsk,
  replyByHint,
  replyByMoves,
  replyByPreview,
  replyByWrong,
  todayIn,
} from './ReplyBy.ts';
import { SearchField } from '../../components/EventsSearch.tsx';
import {
  BoxField,
  MomentBox,
  type Picking,
  PickerLayer,
  pick,
} from '../../components/MomentPick.tsx';
import {
  CURRENCIES,
  PHOTO_DESCRIPTION,
  SIX_HOSTS,
  SUGGESTIONS,
  type SampleEvent,
  type Suggestion,
  TYPE_WORDS,
  ZONES,
} from './EventsSample.ts';
import { meshFor } from '../../kit/today.ts';
import { TextField, type TextFieldProps } from '../../components/Field.tsx';
import { weight } from '../../theme/fonts.ts';
import { W, say, t } from './EventsWords.ts';
import { hostErrorWords } from './hostErrors.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Pill } from '../../components/SettingsParts.tsx';
import {
  type AskProps,
  FocusedScreen,
  Row,
  RowList,
  TextAction,
} from '../../components/Summary.tsx';

export { AlertLine };

type Opener = RefObject<ScreenReaderTarget | null>;

export interface EditProps {
  open: boolean;
  event: SampleEvent;
  start: EventDemoState | null;
  locale: string;
  opener: Opener;
  onClose: () => void;
  onSaved: (event: SampleEvent, movedReplyBy?: string) => void;
  /** sc-3780: the Reply by part edits the date beside the event, not the event itself. */
  replyBy?: string | null;
  now?: Date;
  onReplyBy?: (date: string | null) => void;
}

const TITLES: Record<EditPart, string> = {
  dates: W.dates,
  replyBy: W.replyBy,
  venue: W.venue,
  hosts: W.hostedBy,
  type: W.type,
  currency: W.currency,
  name: W.eventName,
  cover: W.coverPhoto,
};

/** Each part on its own screen: Cancel, the part and Save, which stays off until something changes. */
export function EditScreen({ part, ...edit }: EditProps & { part: EditPart }) {
  switch (part) {
    case 'dates':
      return <DatesEdit {...edit} />;
    case 'replyBy':
      return <ReplyByEdit {...edit} />;
    case 'venue':
      return <VenueEdit {...edit} />;
    case 'hosts':
      return <HostsEdit {...edit} />;
    case 'type':
      return <TypeEdit {...edit} />;
    case 'currency':
      return <CurrencyEdit {...edit} />;
    case 'name':
      return <NameEdit {...edit} />;
    case 'cover':
      return <CoverEdit {...edit} />;
  }
}

export const ASK_WIDTH = 340;

export function useEditGap(): number {
  return useShell().layout === 'phone' ? tokens.spaceXl : tokens.spaceLg;
}

function EditShell({
  part,
  verb = W.save,
  changed,
  onSave,
  edit,
  latest,
  over,
  toast,
  children,
}: {
  part: EditPart;
  verb?: string;
  changed: boolean;
  onSave: () => void;
  edit: EditProps;
  latest?: AskProps | null;
  over?: { layer: ReactNode; onClose: () => void } | null;
  toast?: { words: string; onClose: () => void } | null;
  children: ReactNode;
}) {
  const [discarding, setDiscarding] = useState(edit.start === 'discard');
  const testID = `event.edit.${part}`;
  const gap = useEditGap();
  const discard: AskProps | null = discarding
    ? {
        title: W.discardTitle,
        line: W.discardLine,
        keep: { label: W.keepEditing, testID: `${testID}.keep` },
        confirm: { label: W.discard, testID: `${testID}.discard`, removes: true },
        onKeep: () => setDiscarding(false),
        onConfirm: edit.onClose,
      }
    : null;
  const asked = latest ?? discard;

  return (
    <FocusedScreen
      gap={gap}
      open={edit.open}
      title={TITLES[part]}
      verb={{ label: verb, on: changed, onPress: onSave, testID: `${testID}.save` }}
      onCancel={() => (changed ? setDiscarding(true) : edit.onClose())}
      cancelTestID={`${testID}.cancel`}
      opener={edit.opener}
      ask={asked && { ...asked, width: ASK_WIDTH }}
      over={over ?? null}
      toast={toast ?? null}
      testID={testID}
    >
      {children}
    </FocusedScreen>
  );
}

/** The product's field, with the demo's Optional. */
export function EventField({
  optional = false,
  ...rest
}: Omit<ComponentProps<typeof ProductField>, 'optional'> & { optional?: boolean }) {
  return <ProductField {...rest} optional={optional ? W.optional : undefined} />;
}

export function AcPill({ words }: { words: string }) {
  return (
    <View style={styles.acPill}>
      <Text size={12.5} weight="semibold" style={styles.secondary}>
        {words}
      </Text>
    </View>
  );
}

/** The event's choices: each a row with its radio at the right, ruled apart. */
export function Choices<Key extends string>({
  items,
  on,
  onPick,
  testID,
}: {
  items: readonly { key: Key; title: string }[];
  on: Key | null;
  onPick: (key: Key) => void;
  testID: string;
}) {
  return (
    <View accessibilityRole="radiogroup">
      <RowList
        items={items.map((one) => ({
          key: one.key,
          row: (
            <Row
              title={one.title}
              trail={<RadioMark on={one.key === on} />}
              accent={one.key === on}
              onPress={() => onPick(one.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: one.key === on }}
              testID={`${testID}.${one.key}`}
            />
          ),
        }))}
      />
    </View>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.labelled}>
      <Text size={14} weight="semibold" style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}

/** A start or an end as the Dates edit draws it: the date, then the time 104 wide; an empty one shows Date or Time. */
export function DatePair({
  label,
  at,
  locale,
  wrong = false,
  firstRef,
  onPick,
  testID,
  children,
}: {
  label: string;
  at: { date: string; time: string };
  locale: string;
  wrong?: boolean;
  firstRef?: RefObject<ViewInstance | null>;
  onPick: (mode: 'date' | 'time') => void;
  testID: string;
  children?: ReactNode;
}) {
  const slot = (mode: 'date' | 'time') => {
    const value = mode === 'date' ? at.date : at.time;
    const word = mode === 'date' ? W.date : W.time;
    const width = mode === 'time' ? 104 : undefined;
    const id = `${testID}${mode === 'date' ? 'Date' : 'Time'}`;

    const ref = mode === 'date' ? firstRef : undefined;

    return value === '' ? (
      <Pressable
        ref={ref}
        onPress={() => onPick(mode)}
        style={({ pressed }) => [
          styles.select,
          width == null ? styles.grow : { width },
          wrong && styles.selectWrong,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${word}`}
        testID={id}
      >
        <Text size={16} weight="medium" accessible={false} style={styles.secondary}>
          {word}
        </Text>
      </Pressable>
    ) : (
      <MomentBox
        {...(ref == null ? {} : { ref })}
        label={`${label}, ${word}`}
        mode={mode}
        value={value}
        locale={locale}
        {...(width == null ? {} : { width })}
        wrong={wrong}
        onPress={() => onPick(mode)}
        testID={id}
      />
    );
  };

  return (
    <Labelled label={label}>
      <View style={styles.pair}>
        {slot('date')}
        {slot('time')}
      </View>
      {children}
    </Labelled>
  );
}

/** A choice from a list, shut: what is chosen, or the placeholder, and the chevron. */
export function SelectBox({
  label,
  value,
  placeholder,
  expanded,
  wrong = false,
  onPress,
  ref,
  testID,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  expanded?: boolean;
  wrong?: boolean;
  onPress: () => void;
  ref?: RefObject<ViewInstance | null>;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        styles.select,
        wrong && styles.selectWrong,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      {...(expanded == null ? {} : { accessibilityState: { expanded } })}
      accessibilityLabel={`${label}, ${value ?? placeholder ?? ''}`}
      testID={testID}
    >
      <Text
        size={16}
        weight="medium"
        accessible={false}
        style={[styles.grow, value == null && styles.secondary]}
      >
        {value ?? placeholder}
      </Text>
      <Glyph name="down" size={18} ink={tokens.colorInkSecondary} weight={2.3} />
    </Pressable>
  );
}

export const CHANGED = {
  start: { date: '2026-11-04', time: '18:00' },
  end: { date: '2026-11-06', time: '15:00' },
};

function DatesEdit(edit: EditProps) {
  const { event, start, locale } = edit;
  const saved = {
    start: wallOf(event.startsAt, event.timeZone),
    end: wallOf(event.endsAt, event.timeZone),
  };
  const sample =
    start === 'datesChanged' ||
    start === 'datesReplyBy' ||
    start === 'datesReplyByAsk' ||
    start === 'discard' ||
    start === 'changedElsewhere' ||
    start === 'showLatest'
      ? CHANGED
      : start === 'datesError'
        ? { start: saved.start, end: { date: '2026-11-05', time: '15:00' } }
        : saved;
  const [from, setFrom] = useState(sample.start);
  const [to, setTo] = useState(sample.end);
  const [zone, setZone] = useState(event.timeZone);
  const [endChosen, setEndChosen] = useState(start === 'datesError');
  const [moved, setMoved] = useState<string | null>(() =>
    sample === CHANGED
      ? endMovedLine(draftOf(event, saved), draftOf(event, CHANGED), locale, t)
      : null,
  );
  const [zonesOpen, setZonesOpen] = useState(false);
  const [elsewhere, setElsewhere] = useState(
    start === 'changedElsewhere' || start === 'showLatest',
  );
  const [showing, setShowing] = useState(start === 'showLatest');
  const [picking, setPicking] = useState<Picking | null>(null);
  const draft = draftOf(event, { start: from, end: to });
  const wrong = eventProblems(draft, zone).some((problem) => problem.problem === 'endBeforeStart');
  const replyBy = edit.replyBy ?? null;
  const replyByTo = replyByAfterStart(replyBy, from.date);
  const replyByLine =
    replyBy == null || replyByTo == null ? null : replyByMoves(replyBy, replyByTo, locale);
  const closes = datesAsk(replyBy, replyByTo, edit.now ?? new Date(), zone, event.id);
  const [asking, setAsking] = useState(start === 'datesReplyByAsk');
  const changed =
    zone !== event.timeZone ||
    [from.date, from.time, to.date, to.time].join() !==
      [saved.start.date, saved.start.time, saved.end.date, saved.end.time].join();

  useReadOut(moved);
  useReadOut(replyByLine);

  const pickStart = (mode: 'date' | 'time') =>
    pick(
      {
        title: say.timesIn(zone),
        mode,
        field: from,
        take: (next) => {
          const after = startMoved(
            draft,
            { startDate: next.date, startTime: next.time },
            endChosen,
            zone,
          );
          setFrom(next);
          setTo({ date: after.endDate, time: after.endTime });
          setMoved(endMovedLine(draft, after, locale, t));
        },
      },
      setPicking,
    );
  const pickEnd = (mode: 'date' | 'time') =>
    pick(
      {
        title: say.timesIn(zone),
        mode,
        field: to,
        take: (next) => {
          setTo(next);
          setEndChosen(true);
          setMoved(null);
        },
      },
      setPicking,
    );
  const save = () => {
    if (wrong) return;
    if (closes != null) setAsking(true);
    else commit();
  };
  const commit = () => {
    setAsking(false);
    edit.onSaved(
      {
        ...event,
        timeZone: zone,
        startsAt: instantOf(from.date, from.time, zone),
        endsAt: instantOf(to.date, to.time, zone),
      },
      replyByTo ?? undefined,
    );
  };
  const closeAsk: AskProps | null =
    asking && closes != null && replyByTo != null
      ? {
          title:
            closes === 'now'
              ? W.closeNowTitle
              : say.closeSoonerTitle(formatWallDay(replyByTo, locale)),
          line: `${replyByAskCount(noReplyOf(event.id))} ${closes === 'now' ? W.closeNowLine : W.closeSoonerLine}`,
          keep: { label: W.keepEditing, testID: 'event.edit.dates.replyBy.keep' },
          confirm: {
            label: closes === 'now' ? W.closeNow : W.closeSooner,
            testID: 'event.edit.dates.replyBy.close',
          },
          onKeep: () => setAsking(false),
          onConfirm: commit,
        }
      : null;

  return (
    <EditShell
      part="dates"
      changed={changed}
      onSave={save}
      edit={edit}
      latest={
        showing
          ? {
              title: W.showLatestTitle,
              line: W.showLatestBody,
              keep: { label: W.keepEditing, testID: 'event.edit.dates.latest.keep' },
              confirm: {
                label: W.showLatest,
                testID: 'event.edit.dates.latest.show',
                removes: true,
              },
              onKeep: () => setShowing(false),
              onConfirm: () => {
                setFrom(saved.start);
                setTo(saved.end);
                setZone(event.timeZone);
                setMoved(null);
                setElsewhere(false);
                setShowing(false);
              },
            }
          : closeAsk
      }
      over={
        picking == null
          ? null
          : {
              layer: (
                <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
              ),
              onClose: () => setPicking(null),
            }
      }
    >
      {elsewhere && (
        <EventNotice
          tone="broken"
          words={W.changedElsewhere}
          actions={
            <TextAction
              label={W.showLatest}
              onPress={() => setShowing(true)}
              testID="event.edit.dates.latest"
            />
          }
        />
      )}
      <DatePair
        label={W.starts}
        at={from}
        locale={locale}
        onPick={pickStart}
        testID="event.edit.dates.start"
      >
        {replyByLine != null && (
          <Text size={13.5} weight="semibold" style={styles.hint} testID="event.edit.dates.replyBy">
            {replyByLine}
          </Text>
        )}
      </DatePair>
      <DatePair
        label={W.ends}
        at={to}
        locale={locale}
        wrong={wrong}
        onPick={pickEnd}
        testID="event.edit.dates.end"
      />
      {wrong ? (
        <AlertLine text={W.endBeforeStart} />
      ) : moved != null ? (
        <Text size={13.5} weight="semibold" style={styles.hint}>
          {moved}
        </Text>
      ) : (
        <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
          {W.endsHint}
        </Text>
      )}
      <Labelled label={W.timeZone}>
        <SelectBox
          label={W.timeZone}
          value={zone}
          expanded={zonesOpen}
          onPress={() => setZonesOpen((now) => !now)}
          testID="event.edit.dates.zone"
        />
        <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
          {say.timesIn(zone)}
        </Text>
      </Labelled>
      {zonesOpen && (
        <Choices
          items={ZONES.map((one) => ({ key: one, title: one }))}
          on={zone}
          onPick={(one) => {
            setZone(one);
            setZonesOpen(false);
          }}
          testID="event.edit.dates.zone"
        />
      )}
    </EditShell>
  );
}

const REPLY_BY_TYPED: Partial<Record<EventDemoState, string>> = {
  replyByError: '2026-11-05',
  replyBySooner: '2026-11-03',
  replyByNow: '2026-11-02',
};

/** Reply by (sc-3780): an optional day; a day on or after the start is refused, and closing replies sooner asks first. */
function ReplyByEdit(edit: EditProps) {
  const { event, start, locale } = edit;
  const saved = edit.replyBy ?? null;
  const now = edit.now ?? new Date();
  const [value, setValue] = useState<string>(
    (start == null ? undefined : REPLY_BY_TYPED[start]) ?? saved ?? '',
  );
  const [tried, setTried] = useState(start === 'replyByError');
  const [asking, setAsking] = useState(
    start === 'replyBySooner' || start === 'replyByNow'
      ? replyByAsk(saved, value, todayIn(now, event.timeZone), noReplyOf(event.id))
      : null,
  );
  const [picking, setPicking] = useState<Picking | null>(null);
  const box = useRef<ViewInstance>(null);
  const [aim, setAim] = useState(0);
  const next = value === '' ? null : value;
  const wrong = replyByWrong(next, event.startsAt, event.timeZone);
  const keep = saved == null ? W.keepEditing : say.keepDate(formatWallDay(saved, locale));
  const done = () => {
    setAsking(null);
    edit.onReplyBy?.(next);
  };
  const save = () => {
    if (wrong) {
      setTried(true);
      setAim((count) => count + 1);
      return;
    }
    const ask = replyByAsk(saved, next, todayIn(now, event.timeZone), noReplyOf(event.id));
    if (ask == null) done();
    else setAsking(ask);
  };
  const choose = () =>
    pick(
      {
        title: W.replyBy,
        mode: 'date',
        field: { date: value, time: CLOSES_AT },
        take: (picked) => {
          setValue(picked.date);
          setTried(false);
        },
      },
      setPicking,
    );
  const remove = () => {
    setValue('');
    setTried(false);
    setAim((count) => count + 1);
  };

  useEffect(() => {
    if (aim > 0) moveScreenReaderFocus(box.current);
  }, [aim]);

  const ask: AskProps | null =
    asking == null || next == null
      ? null
      : {
          title:
            asking === 'now' ? W.closeNowTitle : say.closeSoonerTitle(formatWallDay(next, locale)),
          line: `${replyByAskCount(noReplyOf(event.id))} ${asking === 'now' ? W.closeNowLine : W.closeSoonerLine}`,
          keep: { label: keep, testID: 'event.edit.replyBy.keep' },
          confirm: {
            label: asking === 'now' ? W.closeNow : W.closeSooner,
            testID: 'event.edit.replyBy.close',
          },
          onKeep: () => setAsking(null),
          onConfirm: done,
        };

  return (
    <EditShell
      part="replyBy"
      changed={next !== saved}
      onSave={save}
      edit={edit}
      latest={ask}
      over={
        picking == null
          ? null
          : {
              layer: (
                <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
              ),
              onClose: () => setPicking(null),
            }
      }
    >
      <EventField
        label={W.replyBy}
        optional
        error={tried && wrong ? W.replyByNotBefore : null}
        help={replyByHint(event.timeZone, locale)}
      >
        {next == null ? (
          <Pressable
            ref={box}
            onPress={choose}
            style={({ pressed }) => [styles.select, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={W.replyBy}
            testID="event.edit.replyBy.date"
          />
        ) : (
          <MomentBox
            ref={box}
            label={W.replyBy}
            mode="date"
            value={next}
            locale={locale}
            wrong={tried && wrong}
            onPress={choose}
            testID="event.edit.replyBy.date"
          />
        )}
      </EventField>
      {next != null && (
        <View style={styles.start}>
          <TextAction label={W.removeTheDate} onPress={remove} testID="event.edit.replyBy.remove" />
        </View>
      )}
      {next != null && !wrong && previewsReplyBy(next, todayIn(now, event.timeZone)) && (
        <View style={styles.inset}>
          <Text size={15} weight="medium" style={styles.lines}>
            {replyByPreview(next, locale)}
          </Text>
        </View>
      )}
    </EditShell>
  );
}

function draftOf(
  event: SampleEvent,
  at: { start: { date: string; time: string }; end: { date: string; time: string } },
) {
  return {
    name: event.name,
    type: event.type,
    startDate: at.start.date,
    startTime: at.start.time,
    endDate: at.end.date,
    endTime: at.end.time,
  };
}

/** Venue name and Address with the sample's suggestions, shared by the Venue edit and New event; a suggestion in another zone offers it. */
export function VenueFields({
  name,
  address,
  onName,
  onAddress,
  zone,
  onZone,
  down,
  offering = null,
  nameError = null,
  addressError = null,
  nameRef,
  addressRef,
  autoFocus = false,
  off = false,
  testID,
}: {
  name: string;
  address: string;
  onName: (name: string) => void;
  onAddress: (address: string) => void;
  zone: string;
  onZone: (zone: string) => void;
  down: boolean;
  offering?: Suggestion | null;
  nameError?: string | null;
  addressError?: string | null;
  nameRef?: RefObject<TextInputInstance | null>;
  addressRef?: RefObject<TextInputInstance | null>;
  autoFocus?: boolean;
  off?: boolean;
  testID: string;
}) {
  const [chosen, setChosen] = useState<Suggestion | null>(offering);
  const [offer, setOffer] = useState(offering != null);
  const looking = chosen == null && !down && folded(address).length >= 3;
  const found = looking
    ? SUGGESTIONS.filter((one) => folded(one.name).includes(folded(address)))
    : [];
  const words = found.length > 0 ? say.suggestionsBelow(found.length) : null;

  useReadOut(words);

  return (
    <>
      <EventField label={W.venueName} optional error={nameError}>
        <BoxField
          ref={nameRef}
          value={name}
          wrong={nameError != null}
          editable={!off}
          onChangeText={onName}
          autoCorrect={false}
          accessibilityLabel={`${W.venueName} · ${W.optional}`}
          testID={`${testID}.name`}
        />
      </EventField>
      <EventField
        label={W.address}
        optional
        error={addressError}
        help={down || words != null || offer ? undefined : W.venueAddressHint}
      >
        <BoxField
          ref={addressRef}
          value={address}
          wrong={addressError != null}
          editable={!off}
          autoFocus={autoFocus}
          onChangeText={(typed) => {
            onAddress(typed);
            setChosen(null);
            setOffer(false);
          }}
          autoCorrect={false}
          accessibilityLabel={`${W.address} · ${W.optional}`}
          testID={`${testID}.address`}
        />
      </EventField>
      {down && <AlertLine text={W.venueLookupDown} />}
      {words != null && (
        <>
          <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
            {words}
          </Text>
          <RowList
            items={found.map((one) => ({
              key: one.name,
              inset: 40,
              row: (
                <Row
                  title={one.name}
                  line={one.address}
                  lead={<LineIcon name="pin" />}
                  onPress={() => {
                    onName(one.name);
                    onAddress(one.address);
                    setChosen(one);
                    setOffer(one.timeZone !== zone);
                  }}
                  testID={`${testID}.suggestion.${one.name}`}
                />
              ),
            }))}
          />
        </>
      )}
      {offer && chosen != null && (
        <EventNotice
          tone="quiet"
          words={say.zoneOffer(chosen.timeZone)}
          actions={
            <View style={styles.offer}>
              <TextAction
                label={say.zoneUse(chosen.timeZone)}
                onPress={() => {
                  onZone(chosen.timeZone);
                  setOffer(false);
                }}
                testID={`${testID}.useZone`}
              />
              <TextAction
                label={say.zoneKeep(zone)}
                onPress={() => setOffer(false)}
                testID={`${testID}.keepZone`}
              />
            </View>
          }
        />
      )}
    </>
  );
}

function VenueEdit(edit: EditProps) {
  const { event, start } = edit;
  const eko = SUGGESTIONS[0];
  const sample =
    start === 'venueSuggestions'
      ? { name: '', address: 'Eko Hot' }
      : start === 'venueZone' && eko != null
        ? { name: eko.name, address: eko.address }
        : start === 'venueDown'
          ? { name: '', address: '12 Rua' }
          : { name: event.venue?.name ?? '', address: event.venue?.address ?? '' };
  const [name, setName] = useState(sample.name);
  const [address, setAddress] = useState(sample.address);
  const [zone, setZone] = useState(event.timeZone);
  const refusedNote = start === 'venueNoteTooLong' || start === 'venueNoteRefused';
  const [note, setNote] = useState(
    refusedNote
      ? LONG_NOTE
      : start === 'venueNoteForbidden'
        ? `${ARRIVAL_NOTE}\nDoors close at 23:00.`
        : (event.arrivalNote ?? ''),
  );
  const [noteError, setNoteError] = useState<string | null>(
    refusedNote ? NOTE_WORDS.tooLong : null,
  );
  const [forbidden, setForbidden] = useState(false);
  const [noteSaid, setNoteSaid] = useState<string | null>(
    start === 'venueNoteTooLong' ? NOTE_WORDS.oneField : null,
  );
  const noteField = useRef<TextInputInstance>(null);
  const down = start === 'venueDown';
  const changed =
    name !== (event.venue?.name ?? '') ||
    address !== (event.venue?.address ?? '') ||
    note !== (event.arrivalNote ?? '') ||
    zone !== event.timeZone;

  useReadOut(noteSaid);

  return (
    <EditShell
      part="venue"
      changed={changed}
      onSave={() => {
        if (noteTooLong(note)) {
          setNoteError(NOTE_WORDS.tooLong);
          setNoteSaid(NOTE_WORDS.oneField);
          noteField.current?.focus();
          return;
        }
        if (start === 'venueNoteForbidden') {
          setForbidden(true);
          return;
        }
        edit.onSaved({
          ...event,
          timeZone: zone,
          arrivalNote: savedNote(note),
          venue:
            name.trim() === '' && address.trim() === ''
              ? null
              : {
                  name: name.trim(),
                  address: address.trim(),
                  place: name.trim() || address.trim(),
                },
        });
      }}
      edit={edit}
    >
      <VenueFields
        name={name}
        address={address}
        onName={setName}
        onAddress={setAddress}
        zone={zone}
        onZone={setZone}
        down={down}
        offering={start === 'venueZone' ? (eko ?? null) : null}
        autoFocus={start === 'venueSuggestions' || down}
        testID="event.edit.venue"
      />
      <EventField label={NOTE_WORDS.label} optional error={noteError} help={NOTE_WORDS.hint}>
        <NoteBox
          ref={noteField}
          value={note}
          onChangeText={(typed) => {
            setNote(typed);
            setForbidden(false);
            if (!noteTooLong(typed)) setNoteError(null);
          }}
          autoFocus={start === 'venueNote' || refusedNote}
          wrong={noteError != null}
          accessibilityLabel={`${NOTE_WORDS.label} · ${W.optional}`}
          accessibilityHint={NOTE_WORDS.hint}
          testID="event.edit.venue.note"
        />
      </EventField>
      {forbidden && <AlertLine text={NOTE_WORDS.forbidden} />}
    </EditShell>
  );
}

export interface Host {
  key: number;
  name: string;
}

/** Hosted by's body, shared by its own edit and New event: the explainer, Host 1 on down, then Add a host. */
export function HostRows({
  hosts,
  onHosts,
  errors,
  kept = false,
  focusAt = null,
  refs,
  off = false,
  onSaid,
  testID,
}: {
  hosts: readonly Host[];
  onHosts: (hosts: Host[]) => void;
  errors: readonly (string | null)[];
  kept?: boolean;
  focusAt?: number | null;
  refs?: RefObject<Map<number, TextInputInstance>>;
  off?: boolean;
  onSaid: (words: string) => void;
  testID: string;
}) {
  const move = (from: number, to: number) => {
    const moved = [...hosts];
    const [one] = moved.splice(from, 1);
    if (one == null) return;
    moved.splice(to, 0, one);
    onHosts(moved);
    onSaid(say.hostMoved(one.name.trim() || say.hostLabel(from + 1), to + 1, moved.length));
  };

  return (
    <>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {W.hostsExplainer}
      </Text>
      {hosts.map((host, index) => {
        const error = errors[index] ?? null;
        const named = host.name.trim() || say.hostLabel(index + 1);

        return (
          <View key={host.key} style={styles.host}>
            <View style={styles.hostHead}>
              <Text size={14} weight="semibold" style={styles.grow}>
                {say.hostLabel(index + 1)}
              </Text>
              {!kept && !off && (
                <TextAction
                  label={W.remove}
                  onPress={() => onHosts(hosts.filter((one) => one.key !== host.key))}
                  accessibilityLabel={say.removeNamed(named)}
                  testID={`${testID}.remove.${index}`}
                />
              )}
            </View>
            <View style={styles.hostRow}>
              <View style={styles.grow}>
                <BoxField
                  ref={(input) => {
                    if (input == null) refs?.current.delete(host.key);
                    else refs?.current.set(host.key, input);
                  }}
                  value={host.name}
                  wrong={error != null}
                  editable={!off}
                  autoFocus={focusAt === index}
                  onChangeText={(typed) =>
                    onHosts(
                      hosts.map((one) => (one.key === host.key ? { ...one, name: typed } : one)),
                    )
                  }
                  autoCapitalize="words"
                  autoCorrect={false}
                  accessibilityLabel={say.hostLabel(index + 1)}
                  testID={`${testID}.field.${index}`}
                />
              </View>
              {!kept && !off && (
                <>
                  <MoveButton
                    glyph="up"
                    label={say.moveUp(named)}
                    off={index === 0}
                    onPress={() => move(index, index - 1)}
                  />
                  <MoveButton
                    glyph="down"
                    label={say.moveDown(named)}
                    off={index === hosts.length - 1}
                    onPress={() => move(index, index + 1)}
                  />
                </>
              )}
            </View>
            {error != null && <AlertLine text={error} />}
          </View>
        );
      })}
      {kept && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
          {W.lastHost}
        </Text>
      )}
      {hosts.length >= HOSTS_MAXIMUM ? (
        <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
          {W.hostsMost}
        </Text>
      ) : (
        !off && (
          <TextAction
            label={W.addHost}
            glyph="plus"
            onPress={() =>
              onHosts([
                ...hosts,
                { key: Math.max(HOSTS_MAXIMUM, ...hosts.map((one) => one.key + 1)), name: '' },
              ])
            }
            testID={`${testID}.add`}
          />
        )
      )}
    </>
  );
}

function HostsEdit(edit: EditProps) {
  const { event, start } = edit;
  const [hosts, setHosts] = useState<Host[]>(() =>
    (start === 'hostsDuplicate'
      ? ['Adaeze Obi', 'Tunde Bakare', 'Adaeze Obi']
      : start === 'hostsSix'
        ? [...SIX_HOSTS]
        : [...event.hosts]
    ).map((name, key) => ({ key, name })),
  );
  const [tried, setTried] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const names = hosts.map((host) => host.name);
  const problems = hostProblems(names);
  const kept = keepsLastHost(event, hosts.length);
  const changed = names.join('\n') !== event.hosts.join('\n');

  useReadOut(said);

  const save = () => {
    if (problems.some((problem) => problem != null)) {
      setTried(true);
      return;
    }
    edit.onSaved({ ...event, hosts: names.map((name) => name.trim()) });
  };

  return (
    <EditShell part="hosts" changed={changed} onSave={save} edit={edit}>
      <HostRows
        hosts={hosts}
        onHosts={setHosts}
        errors={hostErrorWords(names, tried)}
        kept={kept}
        focusAt={start === 'hostsDuplicate' ? 2 : start === 'lastHost' ? 0 : null}
        onSaid={setSaid}
        testID="event.edit.hosts"
      />
    </EditShell>
  );
}

function MoveButton({
  glyph,
  label,
  off,
  onPress,
}: {
  glyph: 'up' | 'down';
  label: string;
  off: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.move, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      accessibilityLabel={label}
    >
      <Glyph
        name={glyph}
        size={18}
        ink={off ? tokens.colorInkTertiary : tokens.colorInk}
        weight={2.4}
      />
    </Pressable>
  );
}

/** Type's list, shared by its own edit and New event: Search types, then the fourteen in the API's order. */
export function TypeChoices({
  type,
  onPick,
  testID,
}: {
  type: EventType | null;
  onPick: (type: EventType) => void;
  testID: string;
}) {
  const [typed, setTyped] = useState('');
  const shown = EVENT_TYPES.filter((one) => folded(TYPE_WORDS[one]).includes(folded(typed.trim())));

  return (
    <>
      <View style={styles.searchRow}>
        <SearchField
          typed={typed}
          off={false}
          width={null}
          onTyped={setTyped}
          onSearch={() => undefined}
          onClear={() => setTyped('')}
          label={W.searchTypes}
          testID={`${testID}.search`}
        />
      </View>
      <Choices
        items={shown.map((one) => ({ key: one, title: TYPE_WORDS[one] }))}
        on={type}
        onPick={onPick}
        testID={testID}
      />
    </>
  );
}

function TypeEdit(edit: EditProps) {
  const [type, setType] = useState<EventType>(edit.event.type);

  return (
    <EditShell
      part="type"
      changed={type !== edit.event.type}
      onSave={() => edit.onSaved({ ...edit.event, type })}
      edit={edit}
    >
      <TypeChoices type={type} onPick={setType} testID="event.edit.type" />
    </EditShell>
  );
}

function CurrencyEdit(edit: EditProps) {
  const refused = edit.start === 'currencyRefused';
  const [code, setCode] = useState(refused ? 'EUR' : edit.event.currency);
  const [refusal, setRefusal] = useState(refused);

  return (
    <EditShell
      part="currency"
      changed={code !== edit.event.currency}
      onSave={() => (refused ? setRefusal(true) : edit.onSaved({ ...edit.event, currency: code }))}
      edit={edit}
    >
      {refusal && <EventNotice tone="broken" words={W.currencyInUse} />}
      <Choices
        items={CURRENCIES.map((one) => ({ key: one.code, title: `${one.code} · ${one.name}` }))}
        on={code}
        onPick={setCode}
        testID="event.edit.currency"
      />
    </EditShell>
  );
}

function NameEdit(edit: EditProps) {
  const [name, setName] = useState(edit.start === 'nameBlank' ? '' : edit.event.name);
  const blank = name.trim() === '';

  return (
    <EditShell
      part="name"
      changed={name.trim() !== edit.event.name}
      onSave={() => !blank && edit.onSaved({ ...edit.event, name: name.trim() })}
      edit={edit}
    >
      <EventField
        label={W.eventName}
        error={blank ? W.nameBlank : null}
        help={say.nameCount([...name].length)}
      >
        <BoxField
          value={name}
          wrong={blank}
          autoFocus
          maxLength={120}
          onChangeText={setName}
          accessibilityLabel={W.eventName}
          testID="event.edit.name.field"
        />
      </EventField>
    </EditShell>
  );
}

type Position = 'top' | 'middle' | 'bottom';

const SHOWING: Record<Position, string> = {
  top: W.showingTop,
  middle: W.showingMiddle,
  bottom: W.showingBottom,
};

/** The cover as it will show: the photo, or Soirely's cover in the colours its key gives. */
export function CoverPreview({
  photo,
  meshKey,
  id,
}: {
  photo: boolean;
  meshKey: string;
  id: string;
}) {
  return (
    <View
      style={styles.preview}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {photo ? (
        <>
          <PhotoFill id={id} />
          <Glyph name="photo" size={56} ink={tokens.colorInkOnDark} weight={1.6} />
        </>
      ) : (
        <EventMesh event={{ mesh: meshFor(meshKey), photo: null }} />
      )}
    </View>
  );
}

/** With no photo yet: what the cover is (or why the last one was refused), Upload unless held, and what is accepted. */
export function CoverUpload({
  refused = false,
  off = false,
  kind,
  onUpload,
  testID,
}: {
  refused?: boolean;
  off?: boolean;
  kind?: 'secondary';
  onUpload: () => void;
  testID: string;
}) {
  return (
    <>
      {refused ? (
        <EventNotice tone="broken" words={W.coverRefused} />
      ) : (
        <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
          {W.coverDefaultLine}
        </Text>
      )}
      {!off && (
        <Pill
          label={W.upload}
          {...(kind == null ? {} : { kind })}
          glyph="camera"
          onPress={onUpload}
          testID={testID}
        />
      )}
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
        {W.accepted}
      </Text>
    </>
  );
}

function CoverEdit(edit: EditProps) {
  const { event, start } = edit;
  const [photo, setPhoto] = useState(event.photo || start === 'coverPhoto');
  const [refused, setRefused] = useState(start === 'coverRefused');
  const [position, setPosition] = useState<Position>('middle');
  const [described, setDescribed] = useState(
    event.photo || start === 'coverPhoto' ? PHOTO_DESCRIPTION : '',
  );
  const [told, setTold] = useState<string | null>(null);
  const changed =
    photo !== event.photo || position !== 'middle' || (photo && described !== PHOTO_DESCRIPTION);

  return (
    <EditShell
      part="cover"
      verb={W.useThisPhoto}
      changed={changed}
      onSave={() => edit.onSaved({ ...event, photo })}
      edit={edit}
      toast={told == null ? null : { words: told, onClose: () => setTold(null) }}
    >
      <CoverPreview photo={photo} meshKey={event.id} id="cover-edit" />
      {photo ? (
        <>
          <TextAction
            label={W.changePhoto}
            glyph="camera"
            onPress={() => setTold(say.ownDesign(W.choosingPhoto))}
            testID="event.edit.cover.change"
          />
          <PositionSlider position={position} onPosition={setPosition} />
          <EventField label={W.describe} optional help={W.describeHint}>
            <BoxField
              value={described}
              onChangeText={setDescribed}
              multiline
              maxLength={250}
              accessibilityLabel={`${W.describe} · ${W.optional}`}
              testID="event.edit.cover.describe"
            />
          </EventField>
          <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint, styles.figures]}>
            {say.describeCount([...described].length)}
          </Text>
          <TextAction
            label={W.removePhoto}
            removes
            consequence={W.removePhotoLine}
            onPress={() => {
              setPhoto(false);
              setDescribed('');
            }}
            testID="event.edit.cover.remove"
          />
        </>
      ) : (
        <CoverUpload
          refused={refused}
          onUpload={() => {
            setRefused(false);
            setPhoto(true);
            setDescribed('');
          }}
          testID="event.edit.cover.upload"
        />
      )}
    </EditShell>
  );
}

const POSITIONS: readonly Position[] = ['top', 'middle', 'bottom'];

/** Top to Bottom in three stops, as the board draws it; a screen reader moves it a stop at a time. */
function PositionSlider({
  position,
  onPosition,
}: {
  position: Position;
  onPosition: (position: Position) => void;
}) {
  const at = POSITIONS.indexOf(position);
  const step = (by: number) => {
    const next = POSITIONS[Math.min(2, Math.max(0, at + by))];
    if (next != null) onPosition(next);
  };

  return (
    <View style={styles.slider}>
      <Text size={14} weight="semibold" style={styles.label}>
        {W.position}
      </Text>
      <View style={styles.track}>
        <View
          style={styles.track}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={W.position}
          accessibilityValue={{ text: SHOWING[position] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(action) =>
            step(action.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
          testID="event.edit.cover.position"
        >
          <View style={styles.rail} />
          <View style={styles.stops}>
            {POSITIONS.map((one) => (
              <View key={one} style={styles.stop}>
                {one === position && <View style={styles.knob} />}
              </View>
            ))}
          </View>
        </View>
        <View
          style={styles.stops}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {POSITIONS.map((one) => (
            <Pressable key={one} onPress={() => onPosition(one)} style={styles.stop} />
          ))}
        </View>
      </View>
      <View style={styles.ends}>
        <Text size={13.5} weight="medium" style={[styles.grow, styles.secondary]}>
          {W.top}
        </Text>
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {W.bottom}
        </Text>
      </View>
      <Text size={13.5} weight="medium" style={[styles.secondary, styles.hint]}>
        {SHOWING[position]}
      </Text>
    </View>
  );
}

/** The arrival note's box: BoxField's look, four lines tall at first, growing to ten and then scrolling inside. */
export function NoteBox({
  wrong = false,
  accessibilityLabel,
  ...rest
}: TextFieldProps & { accessibilityLabel: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <TextField
      {...rest}
      multiline
      scrollEnabled
      accessibilityLabel={accessibilityLabel}
      wrong={wrong}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.noteBox, (focused || wrong) && styles.noteBoxLit]}
    />
  );
}

const NOTE_LINE = 24;

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  searchRow: { flexDirection: 'row' },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  figures: { fontVariant: ['tabular-nums'] },
  noteBox: {
    minHeight: NOTE_LINE * 4 + tokens.spaceSm * 2,
    maxHeight: NOTE_LINE * 10 + tokens.spaceSm * 2,
    paddingLeft: 14.5,
    paddingRight: 10.5,
    borderWidth: 1.5,
    borderRadius: tokens.radiusInset,
    lineHeight: NOTE_LINE,
    textAlignVertical: 'top',
    ...weight('medium'),
  },
  noteBoxLit: { paddingLeft: tokens.spacePillEnd, paddingRight: tokens.spaceMd, borderWidth: 2 },
  acPill: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceMd,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorFieldBorder,
    borderRadius: 13,
    backgroundColor: tokens.colorCard,
  },
  labelled: { gap: 7 },
  label: { lineHeight: 14 * 1.3 },
  hint: { lineHeight: 13.5 * 1.4 },
  said: { lineHeight: 14 * 1.45 },
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
  pair: { flexDirection: 'row', gap: tokens.spaceSm },
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
  selectWrong: { borderWidth: 2, borderColor: tokens.colorBroken, paddingLeft: 14 },
  offer: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXxl },
  host: { gap: tokens.spaceHair },
  hostHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  move: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slider: { gap: tokens.spaceXxs },
  track: { height: tokens.sizeHit, justifyContent: 'center' },
  rail: { height: 6, borderRadius: 3, backgroundColor: tokens.colorNeutralFill },
  stops: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -tokens.spaceSm,
  },
  stop: { width: tokens.sizeHit, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.raised.ios,
  },
  ends: { flexDirection: 'row' },
});
