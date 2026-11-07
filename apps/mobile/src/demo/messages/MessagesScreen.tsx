import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { focusChecked } from '../../components/Field.tsx';
import { useKeysUp } from '../../components/keyboardWatch.ts';
import { readOut } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { type AreaBadge, EventFrame } from '../events/EventFrame.tsx';
import type { Shown } from '../events/EventsModel.ts';
import type { AreaKey } from '../events/EventsSample.ts';
import { Bell, PHONE_TAB_BAR, useShell } from '../settings/Frame.tsx';
import { Back } from '../settings/parts.tsx';
import { type Anchor, anchorUnder } from '../settings/Summary.tsx';
import { MiniComposer } from './Composers.tsx';
import { type Talk, partsOf } from './Conversation.tsx';
import { MessagesList, rowName } from './MessagesList.tsx';
import {
  type Action,
  type Messages,
  type Open,
  type ReachedOf,
  type RowId,
  anyOnItsWay,
  badgeOf,
  blankDraft,
  channelsWords,
  checkOf,
  dayWords,
  draftTitle,
  resultOf,
  sectionsOf,
  spokenAt,
  toChip,
} from './MessagesModel.ts';
import {
  BellPlace,
  InsertMenu,
  MatchPicker,
  ToPicker,
  TopToast,
  WhenItGoes,
} from './MessagesOverlays.tsx';
import {
  FIXED_ADDRESS,
  GUESTS,
  type GuestKey,
  NOT_REACHED,
  type NotReached,
  PARKING,
  SCHEDULE_AT,
  DAYS,
  INVITE_TIME,
  PARKING_TIME,
  RESEND,
} from './MessagesSample.ts';
import { CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';
import { FixEmail, WhoReached, reachViewOf } from './WhoReached.tsx';

const SAMPLE_CHANNELS: readonly ChannelKey[] = ['email', 'sms'];

function reachedLine(m: Messages, of: ReachedOf, locale: string): string {
  const told = channelsWords(SAMPLE_CHANNELS, locale);
  if (of === 'parking')
    return [
      W.allGuests,
      say.onPageTold(told),
      say.dayTime(dayWords(DAYS.parking, locale), PARKING_TIME),
    ].join(' · ');
  if (of === 'invite')
    return [W.toAllGuests, told, say.dayTime(dayWords(DAYS.invite, locale), INVITE_TIME)].join(
      ' · ',
    );
  const draft = m.draft ?? blankDraft();
  const ticked = (['email', 'sms', 'wa'] as const).filter((key) => draft.channels[key]);

  return [
    say.toGroup(toChip(draft.to)),
    say.onPageTold(channelsWords(ticked, locale)),
    draft.time,
  ].join(' · ');
}

function reachedTitle(m: Messages, of: ReachedOf): string {
  if (of === 'parking') return PARKING;
  if (of === 'invite') return W.invitation;

  return m.draft == null ? W.newMessage : draftTitle(m.draft, m.thread);
}

export function badgeFor(m: Messages): AreaBadge | null {
  const badge = badgeOf(m);

  return badge == null
    ? null
    : {
        count: badge.total,
        name: say.badgeName(badge.waiting, badge.notMatched),
        words: say.counts(badge.waiting, badge.notMatched),
      };
}

/** Messages B in the event: the list and a conversation pushed over it on the phone, the two side by side on the iPad. */
export function MessagesScreen({
  m,
  dispatch,
  event,
  now,
  more,
  onMore,
  onArea,
  start,
  extra,
}: {
  m: Messages;
  dispatch: (action: Action) => void;
  event: Shown;
  now: Date;
  more: boolean;
  onMore: (open: boolean) => void;
  onArea: (area: AreaKey) => void;
  start: { fix: boolean; push: boolean; keys: boolean };
  extra?: ReactNode;
}) {
  const shell = useShell();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const phone = shell.layout === 'phone';
  const wide = !phone;
  const insets = useSafeAreaInsets();
  const refs = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const headRef = useRef<TextHandle>(null);
  const checkRef = useRef<TextHandle>(null);
  const bodyRef = useRef<TextInputInstance>(null);
  const answerRef = useRef<TextInputInstance>(null);
  const bellRef = useRef<ViewInstance>(null);
  const opener = useRef<ScreenReaderTarget | null>(null);
  const openerRef = useMemo(
    () => ({
      get current() {
        return opener.current;
      },
    }),
    [],
  );
  const caret = useRef<number | null>(null);
  const focusBody = useRef(start.keys);
  const [typed, setTyped] = useState<Partial<Record<GuestKey, string>>>(m.typed);
  const [toAt, setToAt] = useState<Anchor | null>(null);
  const [insertAt, setInsertAt] = useState<Anchor | null>(null);
  const [bellAt, setBellAt] = useState<Anchor | null>(null);
  const [fix, setFix] = useState(() => {
    const person = NOT_REACHED[0];
    return {
      key: person?.key ?? ('tomas' as const),
      name: person?.name ?? '',
      bounced: person?.bounced ?? '',
      start: start.fix ? FIXED_ADDRESS : (person?.bounced ?? ''),
    };
  });
  const refFor = useCallback(
    (key: string) => (node: ViewInstance | null) => {
      refs.current[key] = node;
    },
    [],
  );
  const from = (key: string) => {
    opener.current = refs.current[key] ?? null;
  };
  const ownDesign = (what: string) => dispatch({ type: 'told', words: say.ownDesign(what) });
  const draft = m.draft;
  const step = draft?.step;
  const seconds = draft?.seconds;
  const count = draft == null ? 0 : resultOf(draft).count;

  // A second at a time while any message counts down or is on its way; the countdown is said at 10, 5 and 0 only.
  const ticking = anyOnItsWay(m);
  useEffect(() => {
    if (!ticking) return undefined;
    const tick = setInterval(() => dispatch({ type: 'tick' }), 1000);

    return () => clearInterval(tick);
  }, [ticking, dispatch]);
  useEffect(() => {
    if (step === 'countdown' && seconds != null) {
      const words = spokenAt(seconds, count);
      if (words != null) readOut(words);
    } else if (step === 'sending' && seconds === 0) readOut(say.queued(count));
  }, [step, seconds, count]);

  useEffect(() => {
    const later = setTimeout(() => {
      if (step === 'check') moveScreenReaderFocus(checkRef.current);
      else if (step === 'countdown') moveScreenReaderFocus(refs.current.cancel ?? null);
      else if (step === 'failed') moveScreenReaderFocus(refs.current.retry ?? null);
    }, 350);

    return () => clearTimeout(later);
  }, [step]);

  const asking = m.draft?.asking === true;
  useEffect(() => {
    if (!asking) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(refs.current.keep ?? null), 350);

    return () => clearTimeout(later);
  }, [asking]);

  useEffect(() => {
    if (m.resending) {
      const later = setTimeout(() => moveScreenReaderFocus(checkRef.current), 350);
      return () => clearTimeout(later);
    }
    return undefined;
  }, [m.resending]);

  const openKey = m.open == null ? null : JSON.stringify(m.open);
  useEffect(() => {
    if (openKey == null) return undefined;
    const later = setTimeout(() => {
      if (focusBody.current) {
        focusBody.current = false;
        bodyRef.current?.focus();
      } else moveScreenReaderFocus(headRef.current);
    }, 400);

    return () => clearTimeout(later);
  }, [openKey]);

  useEffect(() => {
    if (!m.picking || phone) return undefined;
    const later = setTimeout(() => {
      const chip = refs.current.to;
      if (chip != null) anchorUnder({ current: chip }, setToAt);
    }, 300);

    return () => clearTimeout(later);
  }, [m.picking, phone]);

  useEffect(() => {
    if (!m.bell || phone) return undefined;
    const later = setTimeout(() => anchorUnder(bellRef, setBellAt), 300);

    return () => clearTimeout(later);
  }, [m.bell, phone]);

  const open = (id: RowId) => {
    from(`row.${rowName(id)}`);
    if (id.kind === 'guest' && id.key === 'unknown') {
      ownDesign(W.notMatched);
      return;
    }
    if (id.kind === 'draft') dispatch({ type: 'openThread', id: id.id });
    else dispatch({ type: 'open', open: id });
  };
  const onNew = (picking: boolean) => {
    dispatch({ type: 'newMessage' });
    focusBody.current = !picking;
    if (picking) dispatch({ type: 'picking', open: true });
  };
  const onDone = (key: GuestKey) => {
    dispatch({ type: 'markDone', key });
    readOut(W.doneSaid);
    if (!wide) return;
    const next = sectionsOf({ ...m, done: [key, ...m.done] }).needs[0];
    const node = next == null ? null : refs.current[`row.${rowName(next)}`];
    setTimeout(() => moveScreenReaderFocus(node ?? null), 300);
  };
  const talk: Talk = {
    m,
    locale,
    dispatch,
    wide,
    columns: shell.layout === 'landscape',
    refFor,
    headRef,
    checkRef,
    bodyRef,
    answerRef,
    typed: m.open?.kind === 'guest' ? (typed[m.open.key] ?? '') : '',
    onTyped: (text) => {
      const at = m.open;
      if (at?.kind === 'guest') setTyped((now) => ({ ...now, [at.key]: text }));
    },
    onAnswer: (key) => {
      const text = (typed[key] ?? '').trim();
      if (text === '') return;
      dispatch({ type: 'answer', key, text });
      setTyped((now) => ({ ...now, [key]: '' }));
    },
    onDone,
    onTo: () => {
      from('to');
      dispatch({ type: 'picking', open: true });
    },
    onInsert: () => {
      from('insert');
      const node = refs.current.insert;
      if (node != null) anchorUnder({ current: node }, setInsertAt);
    },
    onCaret: (at) => {
      caret.current = at;
    },
    onWho: () => dispatch({ type: 'open', open: { kind: 'reached', of: 'parking' } }),
    onWhoSent: () => dispatch({ type: 'open', open: { kind: 'reached', of: 'draft' } }),
    onWhoInvited: () => dispatch({ type: 'open', open: { kind: 'reached', of: 'invite' } }),
    onMatch: () => dispatch({ type: 'matching', open: true }),
    onChannel: (key) => {
      dispatch({ type: 'channel', key });
      if (draft?.step !== 'check') return;
      const check = checkOf({
        ...draft,
        channels: { ...draft.channels, [key]: !draft.channels[key] },
      });
      const told = check.told.map((one) => `${CHANNEL_WORD[one.key]} · ${one.count}`);
      readOut([...told, say.cantTell(check.cantTell)].join('. '));
    },
    onLater: () => {
      from('go');
      dispatch({ type: 'when', open: true });
    },
    onSaveScheduled: () => {
      if (draft == null || draft.body.trim() === '') return;
      dispatch({ type: 'saveScheduled' });
      readOut(W.savedSaid);
    },
    onCancelScheduled: () => {
      dispatch({ type: 'cancelScheduled' });
      readOut(W.cancelledSaid);
      setTimeout(() => moveScreenReaderFocus(headRef.current), 350);
    },
    onFollowUp: (base) => {
      dispatch({ type: 'followUp', base });
      setTimeout(() => bodyRef.current?.focus(), 400);
    },
    onRetry: () => dispatch({ type: 'retry' }),
    onConfirm: () => dispatch({ type: 'confirm' }),
    onCancelCountdown: () => {
      dispatch({ type: 'cancelCountdown' });
      if (phone) dispatch({ type: 'told', words: W.cancelled });
      else readOut(W.cancelled);
      setTimeout(() => focusChecked(bodyRef), 350);
    },
    onChangeIt: () => {
      dispatch({ type: 'changeIt' });
      setTimeout(() => moveScreenReaderFocus(refs.current.send ?? null), 350);
    },
    onSend: () => dispatch({ type: 'send' }),
    onResent: () => {
      dispatch({ type: 'resent' });
      dispatch({ type: 'told', words: say.queued(RESEND.count) });
    },
    ownDesign,
  };

  const insert = (token: string) => {
    if (draft == null) return;
    const at = caret.current ?? draft.body.length;
    dispatch({ type: 'body', text: `${draft.body.slice(0, at)}{${token}}${draft.body.slice(at)}` });
    setInsertAt(null);
  };
  const list = (
    <MessagesList
      m={m}
      wide={wide}
      locale={locale}
      head={
        shell.layout === 'landscape' ? (
          <Bell
            tell={shell.tell}
            ref={bellRef}
            onPress={() => dispatch({ type: 'bell', open: true })}
          />
        ) : null
      }
      refFor={refFor}
      onOpen={open}
      onNew={() => {
        from('new');
        onNew(false);
      }}
      onTell={() => dispatch({ type: 'telling', open: true })}
      onDismiss={() => dispatch({ type: 'dismissUntold' })}
    />
  );
  const sendAgain = (person: NotReached) => {
    dispatch({ type: 'sendAgain', key: person.key });
    setTimeout(() => moveScreenReaderFocus(refs.current[`person.${person.key}`] ?? null), 350);
  };
  const fixPerson = (person: NotReached, fixing: string) => {
    from(`${person.key}.${fixing}`);
    if (fixing === W.fixEmail && person.bounced != null) {
      setFix({
        key: person.key,
        name: person.name,
        bounced: person.bounced,
        start: person.bounced,
      });
      dispatch({ type: 'fixing', open: true });
    } else ownDesign(fixing);
  };
  const resendFrom = (of: ReachedOf) => {
    if (of !== 'parking') {
      ownDesign(say.resend(reachViewOf(m, of).resend));
      return;
    }
    dispatch({ type: 'open', open: { kind: 'many', key: 'parking' } });
    dispatch({ type: 'resending', open: true });
  };
  const reached = (of: ReachedOf, back: ReactNode, title: ReactNode, bottom: number) => (
    <WhoReached
      view={reachViewOf(m, of)}
      m={m}
      onSendAgain={sendAgain}
      head={
        <>
          {back}
          {title}
        </>
      }
      refFor={refFor}
      bottom={bottom}
      onFix={fixPerson}
      onFilter={() => ownDesign(W.filter)}
      onResend={() => resendFrom(of)}
    />
  );
  const overlays = (
    <>
      <ToPicker
        open={m.picking && (phone || toAt != null)}
        to={draft?.to ?? 'all'}
        phone={phone}
        at={m.picking ? toAt : null}
        opener={openerRef}
        onChoose={(to) => dispatch({ type: 'chooseTo', to })}
        onClose={() => dispatch({ type: 'picking', open: false })}
      />
      <InsertMenu
        at={insertAt}
        opener={openerRef}
        onInsert={insert}
        onClose={() => setInsertAt(null)}
      />
      <FixEmail
        key={`${fix.name}:${fix.start}:${String(m.fixing)}`}
        open={m.fixing}
        name={fix.name}
        bounced={fix.bounced}
        start={fix.start}
        opener={openerRef}
        onCancel={() => dispatch({ type: 'fixing', open: false })}
        onSaved={(address) => {
          dispatch({ type: 'fixed', key: fix.key, address });
          setTimeout(() => moveScreenReaderFocus(refs.current[`${fix.key}.again`] ?? null), 500);
        }}
      />
      <BellPlace
        open={m.bell}
        phone={phone}
        at={m.bell ? bellAt : null}
        opener={bellRef}
        push={start.push}
        onClose={() => dispatch({ type: 'bell', open: false })}
        onSettings={() => shell.openSection('notifications')}
        onItem={(key) => {
          dispatch({ type: 'bell', open: false });
          if (key === 'missed')
            dispatch({ type: 'open', open: { kind: 'reached', of: 'parking' } });
          else if (key === 'change') onArea('overview');
          else if (phone) dispatch({ type: 'open', open: null });
        }}
      />
      <MatchPicker
        key={`match:${String(m.matching)}`}
        open={m.matching}
        phone={phone}
        address={GUESTS.unknown.head}
        opener={openerRef}
        onClose={() => dispatch({ type: 'matching', open: false })}
        onMatch={(name) => {
          dispatch({ type: 'match', name });
          readOut(say.matchedSaid(name));
          setTimeout(() => moveScreenReaderFocus(headRef.current), 500);
        }}
      />
      <WhenItGoes
        key={`when:${String(m.when)}`}
        open={m.when}
        phone={phone}
        start={draft?.at ?? SCHEDULE_AT}
        locale={locale}
        opener={openerRef}
        onClose={() => dispatch({ type: 'when', open: false })}
        onNow={() => dispatch({ type: 'when', open: false })}
        onSchedule={(at) => {
          dispatch({ type: 'schedule', at });
          readOut(say.scheduledSaid(dayWords(at.date, locale), at.time));
          setTimeout(() => moveScreenReaderFocus(headRef.current), 500);
        }}
      />
      {extra}
    </>
  );

  if (phone)
    return (
      <EventFrame
        event={event}
        now={now}
        area="messages"
        onArea={onArea}
        more={more}
        onMore={onMore}
        fill
        badge={badgeFor(m)}
        onBell={() => dispatch({ type: 'bell', open: true })}
        overlay={
          <>
            {m.open != null && (
              <Pushed key={m.open.kind === 'draft' ? 'draft' : JSON.stringify(m.open)}>
                {m.open.kind === 'reached' ? (
                  <View style={[styles.fill, { paddingTop: insets.top }]}>
                    {reached(
                      m.open.of,
                      <View style={styles.reachedTop}>
                        <Back label={W.back} onPress={() => dispatch({ type: 'back' })} />
                      </View>,
                      <View style={styles.reachedTitle}>
                        <Text
                          ref={headRef}
                          size={26}
                          weight="bold"
                          accessibilityRole="header"
                          style={styles.title}
                        >
                          {reachedTitle(m, m.open.of)}
                        </Text>
                        <Text size={15} weight="medium" style={styles.secondary}>
                          {reachedLine(m, m.open.of, locale)}
                        </Text>
                      </View>,
                      Math.max(insets.bottom, tokens.spaceLg),
                    )}
                  </View>
                ) : (
                  <PhoneConversation
                    talk={talk}
                    open={m.open}
                    headRef={headRef}
                    onBack={() => dispatch({ type: 'back' })}
                  />
                )}
              </Pushed>
            )}
            {overlays}
            {m.told != null && (
              <TopToast words={m.told} onClose={() => dispatch({ type: 'told', words: null })} />
            )}
          </>
        }
      >
        <PhoneList list={list} onNew={onNew} />
      </EventFrame>
    );

  const landscape = shell.layout === 'landscape';
  let pane: ReactNode;
  if (m.phase === 'loading') pane = <LoadingPane />;
  else if (m.open == null)
    pane = (
      <View style={styles.fill}>
        <View style={styles.centred}>
          <Text size={14.5} weight="medium" style={[styles.secondary, styles.middle]}>
            {m.phase === 'first' ? W.noneLine : W.pickOne}
          </Text>
        </View>
        <MiniComposer to={toChip('all')} placeholder={W.writeToGuests} onOpen={onNew} />
      </View>
    );
  else if (m.open.kind === 'reached')
    pane = reached(
      m.open.of,
      <Back label={reachedTitle(m, m.open.of)} onPress={() => dispatch({ type: 'back' })} />,
      null,
      0,
    );
  else pane = <PaneConversation talk={talk} open={m.open} headRef={headRef} />;

  return (
    <EventFrame
      event={event}
      now={now}
      area="messages"
      onArea={onArea}
      more={more}
      onMore={onMore}
      fill
      badge={badgeFor(m)}
      bellRef={bellRef}
      onBell={() => dispatch({ type: 'bell', open: true })}
      toast={
        m.told == null
          ? null
          : { words: m.told, onClose: () => dispatch({ type: 'told', words: null }) }
      }
      overlay={overlays}
    >
      <View style={[styles.panes, !landscape && styles.panesUp]}>
        <ScrollView
          style={[styles.listPane, { width: landscape ? 330 : 320 }]}
          contentContainerStyle={styles.listBody}
          showsVerticalScrollIndicator={false}
        >
          {list}
        </ScrollView>
        <View
          style={[
            styles.pane,
            { paddingHorizontal: landscape ? 28 : 24, paddingBottom: Math.max(insets.bottom, 22) },
          ]}
        >
          {pane}
        </View>
      </View>
    </EventFrame>
  );
}

function PhoneList({ list, onNew }: { list: ReactNode; onNew: (picking: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);
  const pinned = foot + PHONE_TAB_BAR + tokens.spaceXl;

  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.phoneList,
          { paddingBottom: pinned + 116 + tokens.space3xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {list}
      </ScrollView>
      <View style={[styles.pinned, { bottom: pinned }]}>
        <MiniComposer to={toChip('all')} placeholder={W.writeToGuests} onOpen={onNew} />
      </View>
    </View>
  );
}

/** A conversation pushed over the list: the platform's push, or a cross-fade with Reduce Motion. */
function Pushed({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [shift] = useState(() => new Animated.Value(reduced ? 0 : width));
  const [shown] = useState(() => new Animated.Value(reduced ? 0 : 1));

  useEffect(() => {
    const run = reduced
      ? Animated.timing(shown, { toValue: 1, duration: 150, useNativeDriver: true })
      : Animated.timing(shift, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
    run.start();

    return () => run.stop();
  }, [reduced, shift, shown]);

  return (
    <Animated.View style={[styles.pushed, { opacity: shown, transform: [{ translateX: shift }] }]}>
      {children}
    </Animated.View>
  );
}

type Opened = Exclude<Open, null | { kind: 'reached' }>;

function PhoneConversation({
  talk,
  open,
  headRef,
  onBack,
}: {
  talk: Talk;
  open: Opened;
  headRef: RefObject<TextHandle | null>;
  onBack: () => void;
}) {
  const parts = partsOf(talk, open);
  const insets = useSafeAreaInsets();
  const keysUp = useKeysUp();
  const stream = useRef<ScrollViewInstance>(null);
  const [sides, setSides] = useState({ left: 0, right: 0 });

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <View
          onLayout={(event) =>
            setSides((now) => ({ ...now, left: event.nativeEvent.layout.width }))
          }
        >
          <Back label={W.messages} onPress={onBack} />
        </View>
        <View
          style={[
            styles.navTitle,
            {
              left: sides.left + tokens.spaceXl,
              right: Math.max(sides.left, sides.right) + tokens.spaceXl,
            },
          ]}
          pointerEvents="none"
        >
          <Text ref={headRef} size={17} weight="bold" numberOfLines={1} accessibilityRole="header">
            {parts.title}
          </Text>
        </View>
        <View style={styles.grow} />
        <View
          onLayout={(event) =>
            setSides((now) => ({ ...now, right: event.nativeEvent.layout.width }))
          }
        >
          {parts.right}
        </View>
      </View>
      {(parts.head != null || parts.line != null) && (
        <View style={styles.phoneHead}>
          {parts.head ?? (
            <Text size={14} weight="semibold" style={[styles.secondary, styles.headLine]}>
              {parts.line}
            </Text>
          )}
        </View>
      )}
      <ScrollView
        ref={stream}
        style={styles.fill}
        contentContainerStyle={[
          styles.streamBody,
          parts.align === 'end' ? styles.toFoot : styles.toTop,
        ]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (parts.align === 'end') stream.current?.scrollToEnd({ animated: false });
        }}
      >
        {parts.stream}
      </ScrollView>
      {parts.foot != null && (
        <View
          style={
            keysUp
              ? styles.footBar
              : [styles.footFloat, { paddingBottom: insets.bottom + tokens.spaceXs }]
          }
        >
          {parts.foot}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function PaneConversation({
  talk,
  open,
  headRef,
}: {
  talk: Talk;
  open: Opened;
  headRef: RefObject<TextHandle | null>;
}) {
  const parts = partsOf(talk, open);
  const stream = useRef<ScrollViewInstance>(null);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      {parts.bare !== true && (
        <View style={styles.paneHead}>
          {parts.head ?? (
            <View style={styles.paneHeadRow}>
              {parts.lead}
              <View style={styles.grow}>
                <Text
                  ref={headRef}
                  size={18}
                  weight="bold"
                  accessibilityRole="header"
                  numberOfLines={parts.titleLines}
                  style={styles.paneTitle}
                >
                  {parts.title}
                </Text>
                {parts.line != null && (
                  <Text size={13.5} weight="medium" style={[styles.secondary, styles.headLine]}>
                    {parts.line}
                  </Text>
                )}
              </View>
              {parts.right}
            </View>
          )}
        </View>
      )}
      <ScrollView
        ref={stream}
        style={styles.fill}
        contentContainerStyle={[
          styles.paneStream,
          parts.align === 'end' ? styles.toFoot : styles.toTop,
        ]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (parts.align === 'end') stream.current?.scrollToEnd({ animated: false });
        }}
      >
        {parts.stream}
      </ScrollView>
      {parts.foot != null && <View style={styles.paneFoot}>{parts.foot}</View>}
    </KeyboardAvoidingView>
  );
}

function LoadingPane() {
  return (
    <View
      style={[styles.fill, styles.toFoot, styles.shapes]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[
            styles.shape,
            {
              alignSelf: index % 2 === 0 ? 'flex-end' : 'flex-start',
              width: `${50 + ((index * 17) % 30)}%`,
              height: 44 + (index % 3) * 18,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  middle: { textAlign: 'center', lineHeight: 14.5 * 1.45 },
  title: { letterSpacing: -0.5, lineHeight: 26 * 1.15 },
  phoneList: { paddingHorizontal: tokens.spaceXxl, paddingTop: 14 },
  pinned: { position: 'absolute', left: 14, right: 14 },
  pushed: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.colorCard,
  },
  nav: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  navTitle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneHead: {
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  headLine: { lineHeight: 14 * 1.4 },
  streamBody: {
    flexGrow: 1,
    gap: 14,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXxl,
  },
  toFoot: { justifyContent: 'flex-end' },
  toTop: { justifyContent: 'flex-start' },
  footBar: {
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  footFloat: { paddingHorizontal: 14, paddingTop: tokens.spaceXs },
  reachedTop: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  reachedTitle: { gap: tokens.spaceXxs },
  panes: { flex: 1, flexDirection: 'row' },
  panesUp: { borderTopWidth: 1, borderTopColor: tokens.colorBorder, marginTop: tokens.spaceSm },
  listPane: { flexGrow: 0, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  listBody: { paddingTop: 22, paddingHorizontal: tokens.spaceXxl, paddingBottom: 14 },
  pane: { flex: 1, minWidth: 0, paddingTop: 22 },
  paneHead: {
    paddingBottom: tokens.spaceLg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  paneHeadRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  paneTitle: { lineHeight: 18 * 1.25 },
  paneStream: { flexGrow: 1, gap: 14, paddingVertical: 14 },
  paneFoot: { paddingTop: 14 },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
  },
  shapes: { gap: 14 },
  shape: { borderRadius: 18, backgroundColor: tokens.colorInset },
});
