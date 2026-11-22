import {
  type EventType,
  endMovedLine,
  eventProblems,
  formatWallDay,
  hostProblems,
  keepsLastHost,
  startMoved,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { AlertLine } from '../../components/AlertLine.tsx';
import { SearchField } from '../../components/EventsSearch.tsx';
import {
  ArrivalNoteField,
  Choices,
  CoverPhotoFields,
  CurrencyView,
  CoverPreview as PartPreview,
  CoverUpload as PartUpload,
  DatePair,
  DatesView,
  EditShell,
  EventField,
  type Host,
  HostRows,
  NameView,
  NoteBox,
  type Position,
  SelectBox,
  TypeChoices,
  VenueFieldsView,
  pickerOver,
  useEditGap,
  useEditTitle,
} from '../../components/EventEdits.tsx';
import { PhotoFill } from '../../components/EventThumb.tsx';
import { currencyMatches } from '../../components/currencyMatches.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { GlyphMark } from '../../components/StatusMark.tsx';
import { RowRule } from '../../components/SummaryRows.tsx';
import { MomentBox, type Picking, pick } from '../../components/MomentPick.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { ASK_WIDTH, type AskProps, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { LONG_NOTE, ARRIVAL_NOTE, NOTE_WORDS, noteTooLong, savedNote } from './ArrivalNote.ts';
import {
  CREDIT_TYPED,
  type CreditLanguage,
  OSM_COPYRIGHT,
  OSM_CREDIT,
  STADIA_ATTRIBUTION,
  creditLanguageOf,
  isCreditState,
} from './addressCredit.ts';
import {
  type EditPart,
  type EventDemoState,
  instantOf,
  suggestionsFor,
  wallOf,
} from './EventsModel.ts';
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
import {
  PHOTO_DESCRIPTION,
  SIX_HOSTS,
  SUGGESTIONS,
  type SampleEvent,
  type Suggestion,
  ZONES,
  currencyRows,
} from './EventsSample.ts';
import { W, say, t } from './EventsWords.ts';
import { hostErrorWords } from './hostErrors.ts';

/** The edits are the product's own (sc-48600); the demo drives them from its sample and its states. */
export {
  ASK_WIDTH,
  AlertLine,
  Choices,
  DatePair,
  EventField,
  type Host,
  HostRows,
  NoteBox,
  SelectBox,
  TypeChoices,
  useEditGap,
};

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

/** The product's shell, opened on the demo's state: the discard question or Show the latest. */
function Shell({
  part,
  verb,
  changed,
  onSave,
  edit,
  ask = null,
  elsewhere = null,
  over = null,
  toast = null,
  failed = null,
  children,
}: {
  part: EditPart;
  verb?: string;
  changed: boolean;
  onSave: () => void;
  edit: EditProps;
  ask?: AskProps | null;
  elsewhere?: { onLatest: () => void } | null;
  over?: { layer: ReactNode; onClose: () => void } | null;
  toast?: { words: string; onClose: () => void } | null;
  failed?: string | null;
  children: ReactNode;
}) {
  const title = useEditTitle();

  return (
    <EditShell
      open={edit.open}
      title={part === 'replyBy' ? W.replyBy : title(part)}
      testID={`event.edit.${part}`}
      opener={edit.opener}
      {...(verb == null ? {} : { verb })}
      changed={changed}
      onSave={onSave}
      onClose={edit.onClose}
      asking={edit.start === 'discard' ? 'discard' : edit.start === 'showLatest' ? 'latest' : null}
      elsewhere={elsewhere}
      ask={ask}
      over={over}
      toast={toast}
      failed={failed}
    >
      {children}
    </EditShell>
  );
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
    <Shell
      part="dates"
      changed={changed}
      onSave={save}
      edit={edit}
      ask={closeAsk}
      elsewhere={
        elsewhere
          ? {
              onLatest: () => {
                setFrom(saved.start);
                setTo(saved.end);
                setZone(event.timeZone);
                setMoved(null);
                setElsewhere(false);
              },
            }
          : null
      }
      over={pickerOver(picking, locale, () => setPicking(null))}
    >
      <DatesView
        from={from}
        to={to}
        zone={zone}
        locale={locale}
        startLine={replyByLine}
        endError={wrong ? W.endBeforeStart : null}
        moved={moved}
        zones={ZONES}
        zonesOpen={zonesOpen}
        onZonesOpen={setZonesOpen}
        onZone={setZone}
        onPickStart={pickStart}
        onPickEnd={pickEnd}
      />
    </Shell>
  );
}

const REPLY_BY_TYPED: Partial<Record<EventDemoState, string>> = {
  replyByError: '2026-11-05',
  replyBySooner: '2026-11-03',
  replyByNow: '2026-11-02',
  replyByGone: '2026-11-03',
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
  const [gone, setGone] = useState(false);
  const box = useRef<ViewInstance>(null);
  const [aim, setAim] = useState(0);
  const next = value === '' ? null : value;
  const wrong = replyByWrong(next, event.startsAt, event.timeZone);
  const keep = saved == null ? W.keepEditing : say.keepDate(formatWallDay(saved, locale));
  const done = () => {
    setAsking(null);
    if (start === 'replyByGone') setGone(true);
    else edit.onReplyBy?.(next);
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
    <Shell
      part="replyBy"
      changed={next !== saved}
      onSave={save}
      edit={edit}
      ask={ask}
      over={pickerOver(picking, locale, () => setPicking(null))}
      failed={gone ? W.eventGone : null}
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
    </Shell>
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
  credit = 'en',
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
  credit?: CreditLanguage;
  testID: string;
}) {
  const [chosen, setChosen] = useState<Suggestion | null>(offering);
  const [offer, setOffer] = useState(offering != null);
  const found = chosen == null && !down ? suggestionsFor(address) : [];

  useReadOut(found.length > 0 ? say.suggestionsBelow(found.length) : null);

  return (
    <>
      <VenueFieldsView
        name={name}
        address={address}
        onName={onName}
        onAddress={(typed) => {
          onAddress(typed);
          setChosen(null);
          setOffer(false);
        }}
        suggestions={found.map((one) => ({ key: one.name, title: one.name, line: one.address }))}
        onSuggestion={(key) => {
          const one = found.find((each) => each.name === key);
          if (one == null) return;
          onName(one.name);
          onAddress(one.address);
          setChosen(one);
          setOffer(one.timeZone !== zone);
        }}
        down={down}
        offer={
          offer && chosen != null
            ? {
                zone: chosen.timeZone,
                keep: zone,
                onUse: () => {
                  onZone(chosen.timeZone);
                  setOffer(false);
                },
                onKeep: () => setOffer(false),
              }
            : null
        }
        nameError={nameError}
        addressError={addressError}
        {...(nameRef == null ? {} : { nameRef })}
        {...(addressRef == null ? {} : { addressRef })}
        autoFocus={autoFocus}
        off={off}
        testID={testID}
      />
      {found.length > 0 && <AddressCredit language={credit} testID={`${testID}.credit`} />}
    </>
  );
}

/** sc-80918: under the last suggestion, past a hairline, and not one of them: each link opens in the device's browser, and each is its own 48pt target. */
function AddressCredit({ language, testID }: { language: CreditLanguage; testID: string }) {
  const words = OSM_CREDIT[language];
  const link = (url: string, name: string, id: string) => (
    <Pressable
      accessibilityRole="link"
      accessibilityLanguage={language}
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [styles.creditLink, pressed && styles.pressed]}
      testID={`${testID}.${id}`}
    >
      <Text size={13} weight="medium" style={styles.creditWords}>
        {name}
      </Text>
    </Pressable>
  );

  return (
    <>
      <RowRule inset={40} />
      <View style={styles.credit} testID={testID}>
        <Text size={13} weight="medium" style={styles.secondary}>
          ©{' '}
        </Text>
        {link(STADIA_ATTRIBUTION, words.stadia, 'stadia')}
        <Text size={13} weight="medium" style={styles.secondary}>
          {' '}
          ©{' '}
        </Text>
        {link(OSM_COPYRIGHT, words.osm, 'osm')}
      </View>
    </>
  );
}

function VenueEdit(edit: EditProps) {
  const { event, start } = edit;
  const eko = SUGGESTIONS[0];
  const sample = isCreditState(start)
    ? { name: '', address: CREDIT_TYPED[start] }
    : start === 'venueSuggestions'
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
    <Shell
      part="venue"
      changed={changed}
      failed={forbidden ? NOTE_WORDS.forbidden : null}
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
        autoFocus={start === 'venueSuggestions' || isCreditState(start) || down}
        credit={creditLanguageOf(start)}
        testID="event.edit.venue"
      />
      <ArrivalNoteField
        note={note}
        onNote={(typed) => {
          setNote(typed);
          setForbidden(false);
          if (!noteTooLong(typed)) setNoteError(null);
        }}
        error={noteError}
        autoFocus={start === 'venueNote' || refusedNote}
        noteRef={noteField}
        testID="event.edit.venue.note"
      />
    </Shell>
  );
}

function HostsEdit(edit: EditProps) {
  const { event, start } = edit;
  const [hosts, setHosts] = useState<Host[]>(() =>
    (start === 'hostsDuplicate'
      ? ['Adaeze Obi', 'Tunde Bakare', 'Adaeze Obi']
      : start === 'hostsSix'
        ? [...SIX_HOSTS]
        : start === 'lastHost'
          ? event.hosts.slice(0, 1)
          : [...event.hosts]
    ).map((name, key) => ({ key, name })),
  );
  const [tried, setTried] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [first, setFirst] = useState(false);
  const names = hosts.map((host) => host.name);
  const problems = hostProblems(names);
  const kept = keepsLastHost(event, hosts.length);
  const changed =
    names.length !== event.hosts.length || names.some((name, at) => name !== event.hosts[at]);

  useReadOut(said);

  const save = () => {
    if (problems.some((problem) => problem != null)) {
      setTried(true);
      return;
    }
    edit.onSaved({ ...event, hosts: names.map((name) => name.trim()) });
  };

  return (
    <Shell part="hosts" changed={changed} onSave={save} edit={edit}>
      {hosts.length === 0 ? (
        <NoHosts
          onAdd={() => {
            setFirst(true);
            setHosts([{ key: 0, name: '' }]);
          }}
        />
      ) : (
        <HostRows
          hosts={hosts}
          onHosts={setHosts}
          errors={hostErrorWords(names, tried)}
          kept={kept}
          focusAt={start === 'hostsDuplicate' ? 2 : start === 'lastHost' || first ? 0 : null}
          onSaid={setSaid}
          testID="event.edit.hosts"
        />
      )}
    </Shell>
  );
}

/** sc-15497: a draft with no hosts says so in an inset line between the explainer and Add a host. */
function NoHosts({ onAdd }: { onAdd: () => void }) {
  const { t: translate } = useTranslation();

  return (
    <>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {translate('eventHosts.explainer')}
      </Text>
      <View style={[styles.inset, styles.noHosts]} testID="event.edit.hosts.none">
        <GlyphMark mark={tokens.marks.notStarted} />
        <Text size={tokens.typeBody.size} style={styles.grow}>
          {translate('eventHosts.none')}
        </Text>
      </View>
      <TextAction
        label={translate('eventHosts.add')}
        glyph="plus"
        onPress={onAdd}
        testID="event.edit.hosts.add"
      />
    </>
  );
}

function TypeEdit(edit: EditProps) {
  const [type, setType] = useState<EventType>(edit.event.type);

  return (
    <Shell
      part="type"
      changed={type !== edit.event.type}
      onSave={() => edit.onSaved({ ...edit.event, type })}
      edit={edit}
    >
      <TypeChoices type={type} onPick={setType} testID="event.edit.type" />
    </Shell>
  );
}

function CurrencyEdit(edit: EditProps) {
  const refused = edit.start === 'currencyRefused';
  const [code, setCode] = useState(refused ? 'EUR' : edit.event.currency);
  const [refusal, setRefusal] = useState(refused);

  return (
    <Shell
      part="currency"
      changed={code !== edit.event.currency}
      onSave={() => (refused ? setRefusal(true) : edit.onSaved({ ...edit.event, currency: code }))}
      edit={edit}
    >
      <CurrencyView
        code={code}
        choices={currencyRows(edit.event.currency)}
        refused={refusal}
        onPick={setCode}
      />
    </Shell>
  );
}

/** New event's search, list and empty line; the Edit uses the product's CurrencyView, and both match through currencyMatches. */
export function CurrencySearch({
  code,
  rows,
  onPick,
  testID,
}: {
  code: string;
  rows: readonly { code: string; name: string }[];
  onPick: (code: string) => void;
  testID: string;
}) {
  const [typed, setTyped] = useState('');
  const { shown, unmatched } = currencyMatches(rows, typed);

  useReadOut(unmatched == null ? null : say.noCurrency(unmatched));

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
          label={W.searchCurrencies}
          testID={`${testID}.search`}
        />
      </View>
      {unmatched != null ? (
        <View style={styles.none} testID={`${testID}.none`}>
          <Text size={15} weight="medium">
            {say.noCurrency(unmatched)}
          </Text>
          <TextAction label={W.clearSearch} onPress={() => setTyped('')} />
        </View>
      ) : (
        <Choices
          items={shown.map((one) => ({ key: one.code, title: `${one.code} · ${one.name}` }))}
          on={code === '' ? null : code}
          onPick={onPick}
          testID={testID}
        />
      )}
    </>
  );
}

const NAME_MOST = 120;

function NameEdit(edit: EditProps) {
  const [name, setName] = useState(
    edit.start === 'nameBlank'
      ? ''
      : edit.start === 'nameGone'
        ? `${edit.event.name}, the reception`
        : edit.event.name,
  );
  const [gone, setGone] = useState(false);
  const blank = name.trim() === '';

  return (
    <Shell
      part="name"
      changed={name.trim() !== edit.event.name}
      onSave={() => {
        if (blank) return;
        if (edit.start === 'nameGone') setGone(true);
        else edit.onSaved({ ...edit.event, name: name.trim() });
      }}
      edit={edit}
      failed={gone ? W.eventGone : null}
    >
      <NameView
        name={name}
        error={blank ? W.nameBlank : null}
        count={[...name].length}
        most={NAME_MOST}
        onName={setName}
      />
    </Shell>
  );
}

/** The cover as it will show: the sample's photo, or Soirely's cover in the colours its key gives. */
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
    <PartPreview
      photo={
        photo ? (
          <>
            <PhotoFill id={id} />
            <Glyph name="photo" size={56} ink={tokens.colorInkOnDark} weight={1.6} />
          </>
        ) : null
      }
      meshKey={meshKey}
    />
  );
}

/** With no photo yet: what the cover is, or that the sample's last one was refused. */
export function CoverUpload({
  refused = false,
  ...rest
}: {
  refused?: boolean;
  off?: boolean;
  kind?: 'secondary';
  onUpload: () => void;
  testID: string;
}) {
  return <PartUpload refused={refused ? W.coverRefused : null} {...rest} />;
}

const DESCRIBE_MOST = 250;

function CoverEdit(edit: EditProps) {
  const { event, start } = edit;
  const chosen = start === 'coverPhoto' || start === 'coverForbidden';
  const [photo, setPhoto] = useState(event.photo || chosen);
  const [refused, setRefused] = useState(start === 'coverRefused');
  const [forbidden, setForbidden] = useState(false);
  const [position, setPosition] = useState<Position>('middle');
  const [described, setDescribed] = useState(event.photo || chosen ? PHOTO_DESCRIPTION : '');
  const [told, setTold] = useState<string | null>(null);
  const changed =
    photo !== event.photo || position !== 'middle' || (photo && described !== PHOTO_DESCRIPTION);

  return (
    <Shell
      part="cover"
      verb={W.useThisPhoto}
      changed={changed}
      failed={forbidden ? NOTE_WORDS.forbidden : null}
      onSave={() => {
        if (start === 'coverForbidden') {
          setForbidden(true);
          return;
        }
        edit.onSaved({ ...event, photo });
      }}
      edit={edit}
      toast={told == null ? null : { words: told, onClose: () => setTold(null) }}
    >
      <CoverPreview photo={photo} meshKey={event.id} id="cover-edit" />
      {photo ? (
        <CoverPhotoFields
          position={position}
          onPosition={setPosition}
          described={described}
          onDescribed={(typed) => setDescribed(typed.slice(0, DESCRIBE_MOST))}
          count={[...described].length}
          most={DESCRIBE_MOST}
          onChange={() => setTold(say.ownDesign(W.choosingPhoto))}
          onRemove={() => {
            setPhoto(false);
            setDescribed('');
          }}
        />
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
    </Shell>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row' },
  none: { gap: tokens.spaceSm, paddingVertical: tokens.spaceMd },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  credit: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingLeft: 40,
  },
  creditLink: {
    minWidth: tokens.sizeHitPhonePrimary,
    minHeight: tokens.sizeHitPhonePrimary,
    flexShrink: 1,
    justifyContent: 'center',
  },
  creditWords: { color: tokens.colorInkSecondary, textDecorationLine: 'underline' },
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
  lines: { lineHeight: 15 * 1.45 },
  start: { alignItems: 'flex-start' },
  noHosts: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  grow: { flexGrow: 1, flexShrink: 1 },
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
