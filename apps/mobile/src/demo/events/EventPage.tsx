import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, type RefObject, useMemo, useReducer, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { LineIcon } from '../settings/AccountCard.tsx';
import { useShell } from '../settings/Frame.tsx';
import { SwitchTrack } from '../settings/NotificationsSwitch.tsx';
import { Row, RowList, Section, TextAction } from '../settings/Summary.tsx';
import { EventCard, EventThumb } from './EventCard.tsx';
import { AcPill, AlertLine, EditScreen } from './EventEdits.tsx';
import { AreaPage, EventFrame } from './EventFrame.tsx';
import {
  type DeleteStart,
  DeleteScreen,
  DuplicateScreen,
  type LifeAsk,
  LifecycleAsk,
} from './EventLifecycle.tsx';
import {
  type CardStep,
  type EditPart,
  type EventDemoState,
  type ManageKey,
  type Shown,
  clockOf,
  datesRow,
  editOf,
  hostsRow,
  manageOf,
  needsName,
  scheduleLocked,
  shownEvent,
} from './EventsModel.ts';
import {
  type AreaKey,
  type SampleEvent,
  TYPE_WORDS,
  currencyWords,
  sampleEvent,
} from './EventsSample.ts';
import { W, say } from './EventsWords.ts';
import { type MessagesState, reduce, startOf } from '../messages/MessagesModel.ts';
import { TellGuests } from '../messages/MessagesOverlays.tsx';
import { SAMPLE_EVENT_ID, TELL } from '../messages/MessagesSample.ts';
import { tellChange } from '../messages/TellChange.ts';
import { MessagesScreen, badgeFor } from '../messages/MessagesScreen.tsx';
import { W as MW, say as sayMessages } from '../messages/MessagesWords.ts';

type Mute = 'ok' | 'notLoaded' | 'notSaved';

/** Tell guests opens once the edit's own screen has gone, since iOS shows one window at a time. */
const TELL_AFTER_MS = 800;

const ASKS: Partial<Record<EventDemoState, LifeAsk>> = {
  pause: 'pause',
  callOff: 'callOff',
  endNow: 'endNow',
  deleteDraft: 'deleteDraft',
};

function startEvent(
  id: string | undefined,
  state: EventDemoState | null,
  messages: MessagesState | null,
): SampleEvent {
  const event = sampleEvent(id) ?? sampleEvent('evt-wed-4');
  if (event == null) throw new Error('The sample has the wedding.');
  if (messages === 'tell' || messages === 'untold') return { ...event, startsAt: TELL.startsAt };

  return state === 'photo' ? { ...event, photo: true } : event;
}

function deleteStart(state: EventDemoState | null): DeleteStart | null {
  return state === 'delete' || state === 'deleteMismatch' || state === 'deleteTyped' ? state : null;
}

/** An event's page in A: the cover card with its one step, then flat rows; each part edits on its own screen. */
export function EventScreen({
  id,
  state,
  area,
  messages = null,
}: {
  id: string | undefined;
  state: EventDemoState | null;
  area: AreaKey | null;
  messages?: MessagesState | null;
}) {
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const now = useMemo(() => clockOf(state), [state]);
  const [event, setEvent] = useState(() => startEvent(id, state, messages));
  const [at, setAt] = useState<AreaKey>(
    area == null || area === 'people' || messages === 'tell' ? 'overview' : area,
  );
  const [m, dispatch] = useReducer(reduce, null, () => startOf(messages, shell.layout !== 'phone'));
  const [messagesSeen, setMessagesSeen] = useState(messages != null || at === 'messages');
  if (at === 'messages' && !messagesSeen) setMessagesSeen(true);
  const messagesHere = event.id === SAMPLE_EVENT_ID;
  const [toldEvent, setToldEvent] = useState(() => sampleEvent(id) ?? event);
  const [more, setMore] = useState(state === 'more');
  const [edit, setEdit] = useState<EditPart | null>(editOf(state));
  const [round, setRound] = useState(0);
  const [part, setPart] = useState<EditPart>(editOf(state) ?? 'dates');
  const [ask, setAsk] = useState<LifeAsk | null>(state == null ? null : (ASKS[state] ?? null));
  const [deleting, setDeleting] = useState(deleteStart(state) != null);
  const [duplicating, setDuplicating] = useState(state === 'duplicate');
  const [muted, setMuted] = useState(state === 'muted');
  const [mute, setMute] = useState<Mute>(
    state === 'muteNotLoaded' ? 'notLoaded' : state === 'muteNotSaved' ? 'notSaved' : 'ok',
  );
  const [told, setTold] = useState<string | null>(state === 'saved' ? W.saved : null);
  const refs = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const from = useRef('card');
  const opener = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        return refs.current[from.current] ?? null;
      },
    }),
    [],
  );
  const shown = shownEvent(event, now);
  const first = round === 0 ? state : null;
  const refFor = (key: string) => (node: ViewInstance | null) => {
    refs.current[key] = node;
  };
  const openEdit = (which: EditPart) => {
    from.current = which;
    setPart(which);
    setRound((count) => count + 1);
    setEdit(which);
  };
  const saved = (next: SampleEvent) => {
    setEvent(next);
    setEdit(null);
    setTold(W.saved);
    const change =
      part === 'dates' || part === 'venue' ? tellChange(toldEvent, next, locale) : null;
    if (change != null && change.lines.length > 0)
      setTimeout(() => dispatch({ type: 'offerTell', change }), TELL_AFTER_MS);
  };
  const deleteIt = () => {
    setAsk(null);
    setDeleting(false);
    router.dismissTo(`/demo/events?deleted=${event.id}` as Href);
  };
  const onStep = (step: Extract<CardStep, { kind: 'button' }>) => {
    from.current = 'card';
    if (step.action === 'makeLive') shell.tell(say.ownDesign(W.makeLive));
    else if (step.action === 'changeDates') openEdit('dates');
    else if (step.action === 'resume') setEvent({ ...event, status: 'live' });
    else setDuplicating(true);
  };
  const onManage = (key: ManageKey) => {
    from.current = key;
    if (key === 'duplicate') setDuplicating(true);
    else if (key === 'pause') setAsk('pause');
    else if (key === 'callOff') setAsk('callOff');
    else if (key === 'endNow') setAsk('endNow');
    else if (needsName(event)) setDeleting(true);
    else setAsk('deleteDraft');
  };
  const onAsked = (which: LifeAsk) => {
    setAsk(null);
    if (which === 'pause') setEvent({ ...event, status: 'paused' });
    else if (which === 'deleteDraft') deleteIt();
    else setEvent({ ...event, status: 'ended', concludedAt: now.toISOString() });
  };
  const toggleMute = () => {
    setMute('ok');
    setMuted(!muted);
  };

  const card = (
    <EventCard
      event={shown}
      now={now}
      locale={locale}
      wide={shell.layout !== 'phone'}
      onStep={onStep}
      testID="event.card"
    />
  );
  const details = (
    <Details
      shown={shown}
      locale={locale}
      refFor={refFor}
      onEdit={openEdit}
      onMaps={() => shell.tell(W.mapsHandOff)}
    />
  );
  const nameCover = <NameAndCover shown={shown} refFor={refFor} onEdit={openEdit} />;
  const guests = <GuestsPage />;
  const forYou = (
    <JustForYou
      muted={muted}
      mute={mute}
      onToggle={toggleMute}
      onRetry={() => setMute('ok')}
      onSettings={() => shell.openSection('notifications')}
    />
  );
  const manage = <Manage keys={manageOf(shown, now)} refFor={refFor} onManage={onManage} />;
  const tellHere = (words: string) => {
    if (at === 'messages') dispatch({ type: 'told', words });
    else setTold(words);
  };
  const tellSent = () => {
    dispatch({ type: 'tellSent' });
    setToldEvent(event);
    tellHere(sayMessages.queued(TELL.count));
  };
  const tell = messagesHere && (
    <TellGuests
      open={m.telling}
      lines={m.change.lines}
      phone={shell.layout === 'phone'}
      opener={opener}
      onSend={tellSent}
      onNotNow={() => dispatch({ type: 'notNow' })}
      onSeeWho={() => tellHere(sayMessages.ownDesign(MW.seeWho))}
    />
  );

  if (at === 'messages' && messagesHere)
    return (
      <MessagesScreen
        m={m}
        dispatch={dispatch}
        event={shown}
        now={now}
        more={more}
        onMore={setMore}
        onArea={setAt}
        start={{
          fix: messages === 'fix',
          push: messages === 'bell',
          keys: messages === 'write' || messages === 'cancelled',
        }}
        extra={tell}
      />
    );

  let page: ReactNode;
  if (at !== 'overview' && at !== 'people')
    page = <AreaPage area={at} event={shown} locale={locale} />;
  else if (shell.layout === 'landscape')
    page = (
      <>
        {card}
        <View style={styles.columns}>
          <View style={styles.left}>
            {details}
            {nameCover}
          </View>
          <View style={styles.right}>
            {guests}
            {forYou}
            {manage}
          </View>
        </View>
      </>
    );
  else
    page = (
      <>
        {card}
        {details}
        {nameCover}
        {guests}
        {forYou}
        {manage}
      </>
    );

  return (
    <EventFrame
      event={shown}
      now={now}
      area={at}
      onArea={setAt}
      more={more}
      onMore={setMore}
      badge={messagesHere && messagesSeen ? badgeFor(m) : null}
      toast={told == null ? null : { words: told, onClose: () => setTold(null) }}
      overlay={
        <>
          {tell}
          {round > 0 || edit != null ? (
            <EditScreen
              key={`${part}:${round}`}
              part={part}
              open={edit === part}
              event={event}
              start={first}
              locale={locale}
              opener={opener}
              onClose={() => setEdit(null)}
              onSaved={saved}
            />
          ) : null}
          <LifecycleAsk
            ask={ask}
            name={event.name}
            opener={opener}
            onKeep={() => setAsk(null)}
            onConfirm={onAsked}
          />
          <DeleteScreen
            open={deleting}
            event={event}
            start={deleteStart(state)}
            opener={opener}
            onClose={() => setDeleting(false)}
            onDeleted={deleteIt}
          />
          <DuplicateScreen
            open={duplicating}
            event={event}
            locale={locale}
            opener={opener}
            onClose={() => setDuplicating(false)}
            onCreated={() => {
              setDuplicating(false);
              setTold(W.created);
            }}
          />
        </>
      }
    >
      {page}
    </EventFrame>
  );
}

type RefFor = (key: string) => (node: ViewInstance | null) => void;

function Details({
  shown,
  locale,
  refFor,
  onEdit,
  onMaps,
}: {
  shown: Shown;
  locale: string;
  refFor: RefFor;
  onEdit: (part: EditPart) => void;
  onMaps: () => void;
}) {
  const dates = datesRow(shown, locale);
  const hosts = hostsRow(shown, locale);
  const locked = scheduleLocked(shown);

  return (
    <Section title={W.details}>
      <RowList
        items={[
          {
            key: 'dates',
            inset: 40,
            row: (
              <Row
                ref={refFor('dates')}
                title={dates.title}
                line={dates.line}
                lead={<LineIcon name="calendar" />}
                opens={!locked}
                onPress={locked ? undefined : () => onEdit('dates')}
                testID="event.row.dates"
              />
            ),
          },
          {
            key: 'venue',
            inset: 40,
            row: (
              <View>
                <Row
                  ref={refFor('venue')}
                  title={shown.venue?.name ?? W.venueToBeConfirmed}
                  line={shown.venue == null ? W.venue : `${W.venue} · ${shown.venue.address}`}
                  lead={<LineIcon name="pin" />}
                  opens
                  onPress={() => onEdit('venue')}
                  testID="event.row.venue"
                />
                {shown.venue != null && (
                  <View style={styles.maps}>
                    <TextAction
                      label={W.openInMaps}
                      glyph="globe"
                      onPress={onMaps}
                      testID="event.maps"
                    />
                  </View>
                )}
              </View>
            ),
          },
          {
            key: 'hosts',
            inset: 40,
            row: (
              <Row
                ref={refFor('hosts')}
                title={hosts.title}
                line={hosts.line}
                lead={<LineIcon name="users" />}
                opens
                onPress={() => onEdit('hosts')}
                testID="event.row.hosts"
              />
            ),
          },
          {
            key: 'type',
            inset: 40,
            row: (
              <Row
                ref={refFor('type')}
                title={TYPE_WORDS[shown.type]}
                line={W.type}
                lead={<LineIcon name="events" />}
                opens
                onPress={() => onEdit('type')}
                testID="event.row.type"
              />
            ),
          },
          {
            key: 'currency',
            inset: 40,
            row: (
              <Row
                ref={refFor('currency')}
                title={currencyWords(shown.currency)}
                line={W.currency}
                lead={<LineIcon name="wallet" />}
                opens
                onPress={() => onEdit('currency')}
                testID="event.row.currency"
              />
            ),
          },
        ]}
      />
    </Section>
  );
}

function NameAndCover({
  shown,
  refFor,
  onEdit,
}: {
  shown: Shown;
  refFor: RefFor;
  onEdit: (part: EditPart) => void;
}) {
  return (
    <Section title={W.nameAndCover}>
      <RowList
        items={[
          {
            key: 'name',
            inset: 40,
            row: (
              <Row
                ref={refFor('name')}
                title={shown.name}
                line={W.eventName}
                lead={<LineIcon name="edit" />}
                opens
                onPress={() => onEdit('name')}
                testID="event.row.name"
              />
            ),
          },
          {
            key: 'cover',
            inset: 40,
            row: (
              <Row
                ref={refFor('cover')}
                title={shown.photo ? W.yourPhoto : W.defaultCover}
                line={shown.photo ? `${W.cover} · ${W.showingMiddle}` : W.cover}
                lead={<EventThumb event={shown} side={28} radius={8} />}
                opens
                onPress={() => onEdit('cover')}
                testID="event.row.cover"
              />
            ),
          },
        ]}
      />
    </Section>
  );
}

/** sc-1439's page is not built: dashed, in Ink 2, with nothing to press. */
function GuestsPage() {
  return (
    <Section title={W.guestsPage}>
      <View style={styles.dashed} testID="event.guestsPage">
        <Row
          title={W.previewGuestsPage}
          line={W.previewLine}
          lead={<LineIcon name="eye" />}
          pad={tokens.spaceXxs}
        />
        <View style={styles.pillAt}>
          <AcPill words={W.previewPill} />
        </View>
      </View>
    </Section>
  );
}

function JustForYou({
  muted,
  mute,
  onToggle,
  onRetry,
  onSettings,
}: {
  muted: boolean;
  mute: Mute;
  onToggle: () => void;
  onRetry: () => void;
  onSettings: () => void;
}) {
  return (
    <Section title={W.justForYou}>
      {mute === 'notLoaded' ? (
        <View style={styles.notLoaded}>
          <Text size={15} weight="medium">
            {W.muteNotLoaded}
          </Text>
          <TextAction label={W.tryAgain} onPress={onRetry} testID="event.mute.retry" />
        </View>
      ) : (
        <>
          <Row
            title={W.mute}
            line={W.muteNote}
            lead={<LineIcon name="bell" />}
            trail={<SwitchTrack on={muted} />}
            onPress={onToggle}
            accessibilityRole="switch"
            accessibilityState={{ checked: muted }}
            accessibilityLabel={`${W.mute}. ${W.muteNote}`}
            testID="event.mute"
          />
          {mute === 'notSaved' && (
            <View style={styles.notSaved}>
              <AlertLine text={W.muteNotSaved} />
            </View>
          )}
        </>
      )}
      <TextAction
        label={W.notificationSettings}
        onPress={onSettings}
        testID="event.notifications"
      />
    </Section>
  );
}

const MANAGE: Record<ManageKey, { label: string; line: string; removes: boolean }> = {
  duplicate: { label: W.duplicate, line: W.duplicateLine, removes: false },
  pause: { label: W.pause, line: W.pauseLine, removes: false },
  callOff: { label: W.callOffOpen, line: W.callOffLine, removes: true },
  endNow: { label: W.endNowOpen, line: W.endLine, removes: true },
  delete: { label: W.deleteOpen, line: W.deleteLine, removes: true },
};

function Manage({
  keys,
  refFor,
  onManage,
}: {
  keys: readonly ManageKey[];
  refFor: RefFor;
  onManage: (key: ManageKey) => void;
}) {
  return (
    <Section title={W.manage}>
      <View style={styles.manage}>
        {keys.map((key) => (
          <TextAction
            key={key}
            ref={refFor(key)}
            label={MANAGE[key].label}
            consequence={MANAGE[key].line}
            removes={MANAGE[key].removes}
            plain={!MANAGE[key].removes}
            onPress={() => onManage(key)}
            testID={`event.manage.${key}`}
          />
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space5xl },
  left: { flex: 1, minWidth: 0, gap: 18 },
  right: { width: 328, gap: 18 },
  maps: { paddingLeft: 40, marginTop: -tokens.spaceSm, paddingBottom: tokens.spaceXs },
  dashed: {
    gap: tokens.spaceXs,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorControlBorder,
    borderRadius: 18,
  },
  pillAt: { paddingLeft: 40, alignItems: 'flex-start' },
  notLoaded: { gap: tokens.spaceHair },
  notSaved: { paddingTop: tokens.spaceXxs },
  manage: { gap: tokens.spaceSm },
});
