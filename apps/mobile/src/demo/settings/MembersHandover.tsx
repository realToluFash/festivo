import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  type KeyboardEvent,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { ReadOut, useReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS, useWindowOrigin } from '../../components/Screen.tsx';
import { keyboardInWindow } from '../../kit/keyboard.ts';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { useAccessibilitySizes } from '../../layout/useLayout.ts';
import { useReducedMotion } from '../../reducedMotion.ts';
import { tokens } from '../../theme/tokens.ts';
import { EventThumb } from '../../components/EventCard.tsx';
import { Search } from '../../components/OrgDropDown.tsx';
import { startsAWord } from '../OrgSwitcherModel.ts';
import { useShell } from '../../components/settingsShell.ts';
import { firstFew, type LedEvent, searches } from './MembersHandover.ts';
import { HANDOVER_WORDS as W, type HandoverKind } from './MembersHandoverWords.ts';
import type { HandoverStart, Person } from './MembersSample.ts';
import { Avatar } from '../../components/SettingsParts.tsx';
import {
  type Anchor,
  anchorUnder,
  Ask,
  MenuLayer,
  Row,
  RowList,
  Section,
  TextAction,
  TurningMark,
} from '../../components/Summary.tsx';

export const NOBODY = 'nobody';

/** As Organisation's sends; a sending state holds its first answer as long as Personalisation's does. */
const SEND_MS = 500;
const HOLD_MS = 8000;
const MENU_AFTER_MS = 700;
const RETRY_MS = 1200;
const FACE = 34;

const stay = () => {};

function followKeys({ duration, easing }: KeyboardEvent): void {
  if (duration > 0) LayoutAnimation.configureNext({ duration, update: { type: easing } });
}

export interface HandoverWords {
  title: string;
  tail: string;
  keep: { label: string; testID: string };
  verb: { label: string; testID: string; removes: boolean };
}

/** Members' one Ask with the handover in it: who leads what, who takes them, what will move, and what the verb does (sc-614, A). */
export function HandoverAsk({
  open,
  opener,
  kind,
  departing,
  events,
  offered,
  you,
  words,
  start,
  onKeep,
  onDone,
  testID,
}: {
  open: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  kind: HandoverKind;
  departing: string | null;
  events: readonly LedEvent[];
  offered: readonly Person[];
  you: string;
  words: HandoverWords;
  start: HandoverStart | null;
  onKeep: () => void;
  onDone: (taker: string) => void;
  testID: string;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const count = events.length;
  const [taker, setTaker] = useState(start?.taker ?? (kind === 'leave' ? NOBODY : you));
  const [phase, setPhase] = useState(start?.phase ?? 'asking');
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const [query, setQuery] = useState(start?.query ?? '');
  const [cleared, setCleared] = useState(0);
  const [keys, setKeys] = useState<number | null>(null);
  const origin = useWindowOrigin();
  const [centred, setCentred] = useState<number | null>(null);
  const button = useRef<ViewInstance>(null);
  const field = useRef<TextInputInstance>(null);
  const pickedRow = useRef<ViewInstance>(null);
  const answer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sends = useRef(0);
  const curve = useRef<KeyboardEvent | null>(null);
  const sending = phase === 'sending';
  const searching = searches(offered.length);
  const typed = searching ? query.trim() : '';
  const found = offered.filter((one) => startsAWord(one.name, typed));
  const choices =
    kind === 'leave' && typed === ''
      ? [NOBODY, ...found.map(({ id }) => id)]
      : found.map(({ id }) => id);
  const none = typed !== '' && found.length === 0;
  const menuOpen = menuAt != null;
  const lifts = menuOpen && keys != null && shell.layout !== 'portrait';
  const liftTop = insets.top + tokens.spaceLg;
  const shift = lifts && centred != null ? liftTop - centred : 0;

  useReadOut(typed === '' ? null : none ? W.noMatch(typed) : W.matches(found.length), {
    afterTyping: query,
    quietAtMount: true,
  });

  function answerAfter(holds: boolean): void {
    clearTimeout(answer.current);
    answer.current = setTimeout(
      // A failed state fails on arrival and trying again goes through, as the recovery demos do.
      () => onDone(taker),
      holds ? HOLD_MS : SEND_MS,
    );
  }

  function confirm(): void {
    setPhase('sending');
    answerAfter(start?.phase === 'sending' && sends.current === 0);
    sends.current += 1;
  }

  useEffect(() => {
    if (!open || start?.phase !== 'sending' || sends.current > 0) return;
    sends.current = 1;
    answerAfter(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => clearTimeout(answer.current), []);

  function tryLoadingAgain(): void {
    setPhase('checking');
    clearTimeout(answer.current);
    answer.current = setTimeout(() => setPhase('asking'), RETRY_MS);
  }

  useEffect(() => {
    if (!open || start?.menu !== true) return;
    let wait: ReturnType<typeof setTimeout>;
    const tryAt = (tries: number) => {
      wait = setTimeout(() => {
        if (button.current != null) anchorUnder(button, setMenuAt);
        else if (tries > 0) tryAt(tries - 1);
      }, MENU_AFTER_MS);
    };
    tryAt(4);

    return () => clearTimeout(wait);
  }, [open, start]);

  useEffect(() => {
    if (!menuOpen) return;
    const focus = setTimeout(
      () => (query !== '' ? field.current?.focus() : moveScreenReaderFocus(pickedRow.current)),
      SETTLED_MS,
    );

    return () => clearTimeout(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  useEffect(() => {
    if (cleared > 0) field.current?.focus();
  }, [cleared]);

  useEffect(() => {
    if (!menuOpen) return;
    // The Ask follows the keys on their own curve, and is placed at once under Reduce Motion.
    const follow = (event: KeyboardEvent) => {
      curve.current = event;
      if (!reduced) followKeys(event);
    };
    const ios = Platform.OS === 'ios';
    const up = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      follow(event);
      setKeys(event.endCoordinates.screenY);
    });
    const down = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (event) => {
      follow(event);
      setKeys(null);
    });

    return () => {
      up.remove();
      down.remove();
    };
  }, [menuOpen, reduced]);

  function closeMenu(): void {
    if (lifts && !reduced && curve.current != null) followKeys(curve.current);
    setMenuAt(null);
    setQuery('');
    setKeys(null);
    setTimeout(() => moveScreenReaderFocus(button.current), SETTLED_MS);
  }

  function pick(id: string): void {
    setTaker(id);
    closeMenu();
  }

  if (phase === 'checking' || phase === 'notLoaded')
    return (
      <Ask
        open={open}
        opener={opener}
        title={words.title}
        line={words.tail}
        body={phase === 'checking' ? <Checking words={W.checking(departing)} /> : undefined}
        failed={phase === 'notLoaded' ? W.notLoaded(departing) : null}
        keep={words.keep}
        confirm={
          phase === 'notLoaded'
            ? { label: W.tryAgain, testID: `${testID}.tryAgain`, removes: false }
            : null
        }
        onKeep={onKeep}
        onConfirm={tryLoadingAgain}
        testID={testID}
      />
    );

  const failedWords =
    phase === 'failed' ? W.failed[kind] : phase === 'refused' ? W.chooseRecipient : null;
  const person = (id: string) => offered.find((one) => one.id === id) ?? null;
  const takerName = (id: string) => (id === NOBODY ? W.nobody(count) : (person(id)?.name ?? ''));
  const menu =
    menuAt == null
      ? null
      : {
          layer: (
            <MenuLayer
              at={{ ...menuAt, y: menuAt.y + shift }}
              onClose={closeMenu}
              width={menuAt.width}
              align="start"
              below={tokens.spaceXs}
              floor={keys == null ? null : keyboardInWindow(keys, origin) - tokens.spaceSm}
              head={
                searching ? (
                  <View style={styles.searchHead}>
                    <Search
                      key={cleared}
                      start={query}
                      typed={query}
                      field={field}
                      onTyped={setQuery}
                      onClear={() => {
                        setQuery('');
                        setCleared((times) => times + 1);
                      }}
                      words={{ search: W.search, clear: W.clearSearch }}
                      testID={`${testID}.search`}
                    />
                  </View>
                ) : undefined
              }
              testID={`${testID}.menu`}
            >
              {none && (
                <View style={styles.none}>
                  <Text size={15} weight="medium" style={styles.noneWords}>
                    {W.noMatch(typed)}
                  </Text>
                  <TextAction
                    label={W.clearSearch}
                    onPress={() => {
                      setQuery('');
                      setCleared((times) => times + 1);
                    }}
                    testID={`${testID}.search.clearAll`}
                  />
                </View>
              )}
              {choices.map((id) => (
                <Choice
                  key={id}
                  ref={id === taker ? pickedRow : undefined}
                  words={id === you ? W.yours(takerName(id)) : takerName(id)}
                  said={id === you ? W.yoursSaid(takerName(id)) : takerName(id)}
                  face={<Face id={id} person={person(id)} />}
                  on={id === taker}
                  onPress={() => pick(id)}
                  testID={`${testID}.menu.${id === NOBODY ? NOBODY : (person(id)?.initials ?? id)}`}
                />
              ))}
            </MenuLayer>
          ),
          onClose: closeMenu,
        };

  return (
    <Ask
      open={open}
      opener={opener}
      title={words.title}
      line={departing == null ? W.youLead(count) : W.leads(departing, count)}
      body={
        <>
          <Taker
            ref={button}
            words={taker === you ? W.yours(takerName(taker)) : takerName(taker)}
            said={W.handTo(count, taker === you ? W.yoursSaid(takerName(taker)) : takerName(taker))}
            face={<Face id={taker} person={person(taker)} />}
            open={menuOpen}
            off={sending}
            onPress={() => anchorUnder(button, setMenuAt)}
            testID={`${testID}.taker`}
          />
          <WillMove events={events} />
          <Text size={15} weight="medium" style={[styles.secondary, styles.line]}>
            {words.tail}
          </Text>
          {failedWords != null && (
            <ReadOut words={failedWords} interrupts accessibilityRole="alert" style={styles.failed}>
              <View style={styles.failedMark}>
                <Glyph name="alert" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
              </View>
              <Text size={15} weight="medium" style={styles.failedWords}>
                {failedWords}
              </Text>
            </ReadOut>
          )}
        </>
      }
      keep={{ ...words.keep, off: sending }}
      confirm={{ ...words.verb, busy: sending ? W.busy[kind] : undefined }}
      onKeep={sending ? stay : onKeep}
      onConfirm={confirm}
      top={lifts ? liftTop : null}
      onPlaced={(top) => {
        if (!lifts) setCentred(top);
      }}
      over={menu}
      testID={testID}
    />
  );
}

/** The work list on its way: the turning mark and its words, read out once. */
function Checking({ words }: { words: string }) {
  return (
    <ReadOut words={words} style={styles.checking}>
      <TurningMark side={14} />
      <Text size={15} weight="medium" style={[styles.secondary, styles.failedWords]}>
        {words}
      </Text>
    </ReadOut>
  );
}

/** Who takes them: one button with the face, the name and a chevron; it opens Members' menu of people under it. */
function Taker({
  words,
  said,
  face,
  open,
  off,
  onPress,
  testID,
  ref,
}: {
  words: string;
  said: string;
  face: ReactNode;
  open: boolean;
  off: boolean;
  onPress: () => void;
  testID: string;
  ref: Ref<ViewInstance>;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.taker,
        open && styles.takerOpen,
        off && styles.takerOff,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={said}
      accessibilityState={{ expanded: open, disabled: off }}
      testID={testID}
    >
      {face}
      <Text
        size={16}
        weight="semibold"
        accessible={false}
        style={[styles.takerName, off && styles.secondary]}
      >
        {words}
      </Text>
      <Glyph
        name="down"
        size={18}
        ink={off ? tokens.colorInkTertiary : tokens.colorInkSecondary}
        weight={2.4}
      />
    </Pressable>
  );
}

function Face({ id, person }: { id: string; person: Person | null }) {
  if (id === NOBODY || person == null)
    return (
      <View
        style={styles.nobody}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph name="people" size={20} ink={tokens.colorInkSecondary} weight={2.2} />
      </View>
    );

  return <Avatar initials={person.initials} side={FACE} tone={person.tone} />;
}

function Choice({
  words,
  said,
  face,
  on,
  onPress,
  testID,
  ref,
}: {
  words: string;
  said: string;
  face: ReactNode;
  on: boolean;
  onPress: () => void;
  testID: string;
  ref?: Ref<ViewInstance> | undefined;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={said}
      testID={testID}
    >
      <View style={styles.tick}>
        {on && <Glyph name="tick" size={16} ink={tokens.colorAccentText} weight={2.6} />}
      </View>
      {face}
      <Text
        size={16}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={[styles.choiceName, on && styles.accent]}
      >
        {words}
      </Text>
    </Pressable>
  );
}

/** What will move: the first five, soonest first, each its tile and its name, then how many more. */
function WillMove({ events }: { events: readonly LedEvent[] }) {
  const { shown, more } = firstFew(events);
  // From the accessibility sizes on a name wraps in full and the whole Ask scrolls (sc-614, sc-13496).
  const cuts = !useAccessibilitySizes();

  return (
    <View>
      {shown.map((event, index) => (
        <View
          key={event.id}
          style={styles.moving}
          accessible
          accessibilityLabel={
            index === 0 ? `${W.willMove(events.length)}, ${event.name}` : event.name
          }
        >
          <EventThumb event={{ ...event, photo: null }} side={28} radius={8} />
          <Text
            size={15}
            weight="semibold"
            accessible={false}
            numberOfLines={cuts ? 1 : undefined}
            style={styles.movingName}
          >
            {event.name}
          </Text>
        </View>
      ))}
      {more > 0 && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.more]}>
          {W.more(more)}
        </Text>
      )}
    </View>
  );
}

/** A suspended member's page before their work list is in: it can say nothing of what they lead, and Hand over now waits. */
export function LeadsNotIn({
  name,
  failed,
  onRetry,
}: {
  name: string;
  failed: boolean;
  onRetry: () => void;
}) {
  if (!failed) return <Checking words={W.checking(name)} />;

  return (
    <View style={styles.notIn}>
      <ReadOut words={W.notLoaded(name)} accessibilityRole="alert" style={styles.failed}>
        <View style={styles.failedMark}>
          <Glyph name="alert" size={18} ink={tokens.colorInkSecondary} weight={2.2} />
        </View>
        <Text size={15} weight="medium" style={styles.failedWords}>
          {W.notLoaded(name)}
        </Text>
      </ReadOut>
      <TextAction label={W.tryAgain} onPress={onRetry} testID="members.leads.tryAgain" />
    </View>
  );
}

/** "Leads {n} events" on a suspended member's page, with Hand over now for whoever may act on them. */
export function LeadsBlock({
  events,
  onHandOver,
  handRef,
}: {
  events: readonly LedEvent[];
  onHandOver: (() => void) | null;
  handRef: Ref<ViewInstance>;
}) {
  return (
    <Section
      title={W.leadsHead(events.length)}
      right={
        onHandOver == null ? undefined : (
          <TextAction
            ref={handRef}
            label={W.handOverNow}
            onPress={onHandOver}
            testID="members.handOverNow"
          />
        )
      }
    >
      <RowList
        items={events.map((event) => ({
          key: event.id,
          inset: LEAD_TILE + tokens.spaceLg,
          row: (
            <Row
              title={event.name}
              lead={<EventThumb event={{ ...event, photo: null }} side={LEAD_TILE} radius={12} />}
              testID={`members.leads.${event.id}`}
            />
          ),
        }))}
      />
    </Section>
  );
}

const LEAD_TILE = 40;

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  line: { lineHeight: 15 * 1.45 },
  taker: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm - 1.5,
    paddingHorizontal: tokens.spaceLg - 1.5,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  takerOpen: {
    paddingVertical: tokens.spaceSm - 2,
    paddingHorizontal: tokens.spaceLg - 2,
    borderWidth: 2,
    borderColor: tokens.colorAccentText,
  },
  takerOff: { borderColor: tokens.colorBorder },
  takerName: { flex: 1, minWidth: 0, lineHeight: 16 * 1.3 },
  nobody: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  moving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: 5,
  },
  movingName: { flex: 1, minWidth: 0, lineHeight: 15 * 1.3 },
  more: { paddingTop: tokens.spaceHair, paddingLeft: 28 + tokens.spaceMd, lineHeight: 14 * 1.45 },
  failed: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  failedMark: { marginTop: tokens.spaceHair },
  checking: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  notIn: { alignItems: 'flex-start', gap: tokens.spaceXxs },
  failedWords: { flex: 1, minWidth: 0, lineHeight: 15 * 1.45 },
  searchHead: { paddingTop: tokens.spaceXs + tokens.spaceXxs, paddingHorizontal: tokens.spaceSm },
  none: {
    alignItems: 'center',
    gap: tokens.spaceHair,
    paddingTop: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.spaceXxs,
  },
  noneWords: { textAlign: 'center', lineHeight: 15 * 1.4 },
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
  },
  choicePressed: { backgroundColor: tokens.colorInset },
  tick: { width: 18, alignItems: 'center' },
  choiceName: { flex: 1, minWidth: 0, lineHeight: 16 * 1.3 },
});
