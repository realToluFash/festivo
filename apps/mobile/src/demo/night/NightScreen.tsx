import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { useModalOpen } from '../../updateRequired.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import { RUN_EVENT } from '../runView/runViewModel.ts';
import { RunCardView } from './LockScreenCard.tsx';
import {
  CW,
  type HeldCards,
  afterPress,
  afterSend,
  cardsOf,
  heldAtStart,
  systemAge,
} from './lockCard.ts';
import {
  type LaterRow,
  type Night,
  type NightStart,
  type TrackView,
  NIGHT_EVENT_NAME,
  NW,
  dismiss,
  headerWords,
  nextSaid,
  nightAt,
  pickerTracks,
  pressDone,
  pressSkip,
  pressStart,
  queuedWords,
  timeIn,
  trackView,
  tryNow,
} from './nightModel.ts';

const PATHS = {
  tick: ['M20 6 9 17l-5-5'],
  clock: ['M12 7v5l3 2'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  pause: ['M10 9v6', 'M14 9v6'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  chevron: ['m6 9 6 6 6-6'],
  strike: ['M5.6 18.4 18.4 5.6'],
  calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
} as const;

export function NightRoute() {
  const params = useLocalSearchParams<{
    state?: string;
    tracks?: string;
    locale?: string;
    as?: string;
    track?: string;
  }>();
  const locale = params.locale ?? 'en-US';

  return (
    <NightBody
      key={`${params.state ?? ''}|${params.tracks ?? ''}|${locale}|${params.as ?? ''}|${params.track ?? ''}`}
      first={opened(
        nightAt(params.state, { oneTrack: params.tracks === 'one', as: params.as }),
        params.track,
      )}
      locale={locale}
    />
  );
}

/** Opened from a lock-screen card: on that card's track, where the night has it (sc-66580). */
function opened(first: NightStart, track: string | undefined): NightStart {
  return track != null && first.night.tracks.some((one) => one.id === track)
    ? { ...first, trackId: track }
    : first;
}

const CARD_NOTE = `The lock-screen card (sc-66580), as this device would show it: one per track pressed on, replaced at each press, with no signal needed. A tap on it picks its track here. Its words are ${CW.settled}.`;

type Layout = 'phone' | 'tabletPortrait' | 'tabletLandscape';

function NightBody({ first, locale }: { first: NightStart; locale: string }) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [night, setNight] = useState<Night>(first.night);
  const [trackId, setTrackId] = useState(first.trackId);
  const [chosen, setChosen] = useState<string | null>(first.chosen);
  const [moving, setMoving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(first.menuOpen);
  const tracks = pickerTracks(night);
  const track = tracks.find((one) => one.id === trackId) ?? tracks[0];
  const view = track == null ? null : trackView(night, track, locale);
  const chosenRow = view?.later.find((row) => row.item.id === chosen) ?? null;
  const sheetShown = useModalOpen(kind !== 'tabletLandscape' && chosenRow != null);
  const rows = useRef(new Map<string, ViewInstance>());
  const [back, setBack] = useState<{ id: string } | null>(null);
  const [held, setHeld] = useState<HeldCards>(() => heldAtStart(first.night));
  const [pushOn, setPushOn] = useState(true);

  useEffect(() => {
    if (back == null) return;
    const later = setTimeout(
      () => moveScreenReaderFocus(rows.current.get(back.id) ?? null),
      SETTLED_MS,
    );
    return () => clearTimeout(later);
  }, [back]);

  useReadOut(night.said === '' ? null : night.said, { quietAtMount: true, answer: night.clock });

  const press = (next: Night) => {
    setHeld(afterPress(held, track?.id ?? '', night, next));
    setNight(next);
    setChosen(null);
    setMoving(false);
  };
  const close = () => {
    if (chosen != null) setBack({ id: chosen });
    setChosen(null);
    setMoving(false);
  };
  const id = track?.id ?? '';
  const acts: Acts = {
    done: (item) => press(pressDone(night, id, item)),
    skip: (item) => {
      if (item === chosen) setBack({ id: item });
      press(pressSkip(night, id, item));
    },
    start: (item) => press(pressStart(night, id, item)),
    choose: (item) => {
      setChosen(item);
      setMoving(false);
    },
    row: (item, node) => {
      if (node == null) rows.current.delete(item);
      else rows.current.set(item, node);
    },
  };
  const phone = kind === 'phone';

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.split}>
        <ScrollView
          style={styles.grow}
          contentContainerStyle={[
            styles.body,
            phone ? styles.bodyPhone : styles.bodyTablet,
            { paddingBottom: insets.bottom + tokens.space4xl },
          ]}
        >
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            style={styles.back}
            testID="night.back"
          >
            <Text size={15} weight="semibold" style={styles.accent}>
              Back
            </Text>
          </Pressable>
          <Head
            night={night}
            view={first.loading ? null : view}
            locale={locale}
            many={tracks.length > 1}
            menuOpen={menuOpen}
            onMenu={() => setMenuOpen(!menuOpen)}
          />
          {menuOpen && view != null && tracks.length > 1 && (
            <View style={styles.menu} accessibilityRole="menu">
              {tracks.map((one) => {
                const label = trackView(night, one, locale).label;
                const on = one.id === view.track.id;

                return (
                  <Pressable
                    key={one.id}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setTrackId(one.id);
                      setMenuOpen(false);
                      close();
                    }}
                    style={styles.menuRow}
                    testID={`night.track.${one.id}`}
                  >
                    <Text size={16} weight={on ? 'semibold' : 'regular'} style={styles.grow}>
                      {label}
                    </Text>
                    {on && <Glyph paths={PATHS.tick} ink={tokens.colorAccentText} side={18} />}
                  </Pressable>
                );
              })}
            </View>
          )}
          {!first.loading && (
            <Strip
              night={night}
              onTry={() => {
                const sent = tryNow(night);
                setHeld(afterSend(held, sent.clock));
                setNight(sent);
              }}
            />
          )}
          {!first.loading && !night.manage && (
            <View style={styles.viewOnly}>
              <View style={styles.pill}>
                <Glyph paths={PATHS.eye} ink={tokens.colorInkSecondary} side={14} />
                <Text size={13} weight="semibold" style={styles.secondary}>
                  {NW.viewOnly}
                </Text>
              </View>
              <Text size={14} style={[styles.secondary, styles.grow]}>
                {NW.viewOnlyLine}
              </Text>
            </View>
          )}
          {night.lost != null && (
            <View style={styles.alert} accessibilityRole="alert">
              <View style={styles.grow}>
                <Text size={15} weight="bold">
                  {night.lost.title}
                </Text>
                <Text size={14} weight="semibold" style={styles.attention}>
                  {night.lost.by == null
                    ? night.lost.said
                    : `Already started by ${night.lost.by} at ${timeIn(locale, night.lost.at)}.`}
                </Text>
              </View>
              <SecondaryButton
                label={NW.dismiss}
                onPress={() => setNight(dismiss(night))}
                testID="night.dismiss"
              />
            </View>
          )}
          <Cards
            first={first}
            night={night}
            view={view}
            layout={kind}
            locale={locale}
            chosen={chosen}
            acts={acts}
          />
          <DemoOnly title={NW.demoOnly}>
            <Text size={14} style={styles.secondary}>
              {`${NW.readOutNote}: ${night.said === '' ? 'nothing yet' : night.said}`}
            </Text>
            {night.online && (
              <SecondaryButton
                label="Lose the connection"
                onPress={() => setNight({ ...night, online: false, age: 1 })}
                testID="night.offline"
              />
            )}
          </DemoOnly>
          {night.manage && (
            <DemoOnly title={CARD_NOTE}>
              <View style={styles.lock}>
                {!pushOn ? (
                  <Text size={14} style={styles.onDarkSecondary}>
                    {CW.noCard}
                  </Text>
                ) : (
                  cardsOf(night, held, locale).map((card) => (
                    <RunCardView
                      key={card.trackId}
                      card={card}
                      age={systemAge(night.clock, held[card.trackId]?.asOf ?? night.clock)}
                      onPress={(one) => {
                        setTrackId(one.trackId);
                        setMenuOpen(false);
                        close();
                      }}
                    />
                  ))
                )}
              </View>
              <SecondaryButton
                label={pushOn ? 'Turn Event day push off' : 'Turn Event day push on'}
                onPress={() => setPushOn(!pushOn)}
                testID="night.eventDayPush"
              />
            </DemoOnly>
          )}
        </ScrollView>
        {kind === 'tabletLandscape' && chosenRow != null && (
          <View style={[styles.docked, { paddingBottom: insets.bottom }]}>
            <Chosen
              row={chosenRow}
              view={view}
              manage={night.manage}
              moving={moving}
              onMove={setMoving}
              onClose={close}
              acts={acts}
            />
          </View>
        )}
      </View>
      {kind !== 'tabletLandscape' && (
        <Modal
          transparent
          visible={sheetShown}
          animationType={phone ? 'slide' : 'fade'}
          statusBarTranslucent
          navigationBarTranslucent
          supportedOrientations={['landscape', 'portrait']}
          onRequestClose={close}
        >
          <View
            style={[styles.scrim, phone ? styles.scrimPhone : styles.scrimDialog]}
            accessibilityViewIsModal
            onAccessibilityEscape={close}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            {chosenRow != null && (
              <View
                style={[
                  phone ? styles.sheet : styles.dialog,
                  phone && { paddingBottom: insets.bottom + tokens.spaceXl },
                ]}
              >
                <Chosen
                  row={chosenRow}
                  view={view}
                  manage={night.manage}
                  moving={moving}
                  onMove={setMoving}
                  onClose={close}
                  acts={acts}
                />
              </View>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

interface Acts {
  done: (item: string) => void;
  skip: (item: string) => void;
  start: (item: string) => void;
  choose: (item: string) => void;
  row: (item: string, node: ViewInstance | null) => void;
}

function Head({
  night,
  view,
  locale,
  many,
  menuOpen,
  onMenu,
}: {
  night: Night;
  view: TrackView | null;
  locale: string;
  many: boolean;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const words = view == null ? null : headerWords(view.header);

  return (
    <View style={styles.head}>
      <View style={styles.headTop}>
        <View style={styles.grow}>
          <Text size={28} weight="bold" accessibilityRole="header">
            {NW.title}
          </Text>
          <Text size={15} weight="medium" style={styles.secondary}>
            {`${NIGHT_EVENT_NAME} · ${timeIn(locale, night.clock)}`}
          </Text>
        </View>
        {words != null && view != null && (
          <View
            style={[styles.pill, view.header.kind === 'behind' ? styles.behind : styles.onTime]}
          >
            {view.header.kind === 'behind' ? (
              <Glyph paths={[]} ink={tokens.colorAttentionText} side={14} circle />
            ) : (
              <View style={styles.dot} />
            )}
            <Text
              size={14}
              weight="semibold"
              style={view.header.kind === 'behind' ? styles.attention : styles.accentText}
            >
              {words}
            </Text>
          </View>
        )}
      </View>
      {view != null && (
        <View style={styles.headLine}>
          {many ? (
            <Pressable
              onPress={onMenu}
              accessibilityRole="button"
              accessibilityState={{ expanded: menuOpen }}
              accessibilityLabel={`Track: ${view.label}`}
              style={styles.picker}
              testID="night.picker"
            >
              <Text size={15} weight="semibold" style={styles.shrink}>
                {view.label}
              </Text>
              <Glyph paths={PATHS.chevron} ink={tokens.colorInk} side={16} />
            </Pressable>
          ) : (
            <Text size={15} weight="semibold">
              {view.label}
            </Text>
          )}
          <Text size={14} style={[styles.secondary, styles.num]}>
            {view.sub}
          </Text>
        </View>
      )}
    </View>
  );
}

function Strip({ night, onTry }: { night: Night; onTry: () => void }) {
  if (night.online)
    return (
      <View style={styles.strip}>
        <View style={styles.dot} />
        <Text size={13} weight="semibold" style={styles.secondary}>
          {NW.live}
        </Text>
      </View>
    );

  return (
    <View style={[styles.strip, styles.stripOff]}>
      <Glyph paths={[]} ink={tokens.colorAttentionText} side={14} circle />
      <View style={styles.grow}>
        <Text size={14} weight="semibold" style={styles.attention}>
          {`Reconnecting · ${night.age} min old`}
        </Text>
        {night.queued > 0 && (
          <Text size={14} style={styles.attention}>
            {queuedWords(night.queued)}
          </Text>
        )}
      </View>
      <SecondaryButton label={NW.tryNow} onPress={onTry} testID="night.try" />
    </View>
  );
}

function Cards({
  first,
  night,
  view,
  layout,
  locale,
  chosen,
  acts,
}: {
  first: NightStart;
  night: Night;
  view: TrackView | null;
  layout: Layout;
  locale: string;
  chosen: string | null;
  acts: Acts;
}) {
  if (first.loading) return <Skeleton layout={layout} />;
  if (view == null)
    return (
      <View style={styles.card}>
        <Glyph paths={PATHS.calendar} ink={tokens.colorInkSecondary} side={24} />
        <Text size={18} weight="semibold">
          {NW.nothingToday}
        </Text>
        <Text size={15} style={styles.secondary}>
          {NW.addedOnWeb}
        </Text>
      </View>
    );
  if (view.finished != null)
    return (
      <View style={[styles.card, styles.endCard]}>
        <View style={styles.endTick}>
          <Glyph paths={PATHS.tick} ink={tokens.colorInkOnDark} side={22} />
        </View>
        <Text size={22} weight="bold">
          {NW.everything}
        </Text>
        {view.finished.sentence != null && (
          <Text size={17} weight="semibold">
            {view.finished.sentence}
          </Text>
        )}
        {view.finished.workedOut != null && (
          <Text size={14} style={styles.secondary}>
            {view.finished.workedOut}
          </Text>
        )}
        {view.finished.endNow && (
          <Pressable
            accessibilityRole="link"
            style={styles.link}
            onPress={() => router.push(`/demo/events/${RUN_EVENT}?state=endNow`)}
            testID="night.endNow"
          >
            <Text size={15} weight="semibold" style={styles.accentText}>
              {NW.endNow}
            </Text>
          </Pressable>
        )}
      </View>
    );

  const now = <NowCard view={view} locale={locale} manage={night.manage} acts={acts} />;
  const next = <NextCard view={view} manage={night.manage} acts={acts} />;
  const later = <LaterCard view={view} manage={night.manage} chosen={chosen} acts={acts} />;

  if (layout === 'tabletLandscape')
    return (
      <View style={styles.row}>
        <View style={styles.column}>
          {now}
          {next}
        </View>
        <View style={styles.grow}>{later}</View>
      </View>
    );
  if (layout === 'tabletPortrait')
    return (
      <>
        <View style={styles.row}>
          <View style={styles.grow}>{now}</View>
          <View style={styles.grow}>{next}</View>
        </View>
        {later}
      </>
    );

  return (
    <>
      {now}
      {next}
      {later}
    </>
  );
}

function NowCard({
  view,
  locale,
  manage,
  acts,
}: {
  view: TrackView;
  locale: string;
  manage: boolean;
  acts: Acts;
}) {
  const { now, elapsed } = view;

  if (now == null || elapsed == null)
    return (
      <View style={[styles.card, styles.dark]}>
        <Text size={13} weight="semibold" style={styles.onDarkSecondary}>
          {NW.now.toUpperCase()}
        </Text>
        <Text size={22} weight="bold" style={styles.onDark}>
          {NW.nothingOn}
        </Text>
        {view.lastFinished != null && (
          <Text size={15} style={styles.onDarkSecondary}>
            {view.lastFinished}
          </Text>
        )}
      </View>
    );

  return (
    <View style={[styles.card, styles.dark]}>
      <Text size={13} weight="semibold" style={styles.onDarkSecondary}>
        {`${NW.now.toUpperCase()} · since ${timeIn(locale, now.started ?? now.planned)}`}
      </Text>
      <Text size={24} weight="bold" style={styles.onDark}>
        {now.title}
      </Text>
      <Text size={15} style={styles.onDarkSecondary}>
        {`${now.owner ?? NW.noOwner} · ${view.label}`}
      </Text>
      {view.nowBefore != null && (
        <Text size={14} style={styles.onDarkSecondary}>
          {view.nowBefore}
        </Text>
      )}
      <View style={styles.elapsed}>
        <Glyph
          paths={elapsed.over ? [] : PATHS.clock}
          ink={elapsed.over ? tokens.colorAttentionOnDark : tokens.colorInkOnDark}
          side={18}
          circle
        />
        <Text
          size={18}
          weight="bold"
          style={[styles.num, elapsed.over ? styles.overOnDark : styles.onDark]}
        >
          {elapsed.words}
        </Text>
      </View>
      {now.length == null ? (
        <Text size={14} style={styles.onDarkSecondary}>
          {NW.noLength}
        </Text>
      ) : (
        <View style={styles.lasts}>
          <Text size={14} style={styles.onDarkSecondary}>
            {`Lasts ${now.length} min`}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { flex: elapsed.share ?? 0 }]} />
            <View style={{ flex: 1 - (elapsed.share ?? 0) }} />
          </View>
        </View>
      )}
      {manage && (
        <View style={styles.pair}>
          <Big
            label={NW.done}
            said={`${NW.done}: ${now.title}`}
            onPress={() => acts.done(now.id)}
            testID={`night.done.${now.id}`}
            wide
          />
          <Big
            label={NW.skip}
            said={`${NW.skip}: ${now.title}`}
            onPress={() => acts.skip(now.id)}
            testID={`night.skip.${now.id}`}
            outlined
            onDark
          />
        </View>
      )}
    </View>
  );
}

function NextCard({ view, manage, acts }: { view: TrackView; manage: boolean; acts: Acts }) {
  const { next } = view;

  return (
    <View style={styles.card}>
      <Text size={13} weight="semibold" style={styles.secondary}>
        {NW.next.toUpperCase()}
      </Text>
      {next == null ? (
        <Text size={15} style={styles.secondary}>
          {NW.nothingElse(view.track.place)}
        </Text>
      ) : (
        <>
          <View style={styles.time} accessible accessibilityLabel={nextSaid(next)}>
            <Text size={17} weight="semibold" style={styles.num}>
              {next.planned}
            </Text>
            {next.expected != null && (
              <>
                <Glyph paths={PATHS.arrow} ink={tokens.colorAttentionText} side={16} />
                <Text size={17} weight="semibold" style={[styles.num, styles.attention]}>
                  {`about ${next.expected}`}
                </Text>
              </>
            )}
          </View>
          <Text size={20} weight="bold">
            {next.item.title}
          </Text>
          <Text size={14} style={styles.secondary}>
            {`${next.item.owner ?? NW.noOwner} · ${next.item.length == null ? NW.noLength : `Lasts ${next.item.length} min`}`}
          </Text>
          {manage &&
            (view.now == null ? (
              <Big
                label={NW.startNow}
                said={`${NW.startNow}: ${next.item.title}`}
                onPress={() => acts.start(next.item.id)}
                testID={`night.start.${next.item.id}`}
              />
            ) : (
              <FinishFirst />
            ))}
        </>
      )}
    </View>
  );
}

function FinishFirst() {
  return (
    <View style={styles.inset}>
      <Glyph paths={PATHS.pause} ink={tokens.colorInkSecondary} side={18} circle />
      <Text size={15} weight="semibold" style={[styles.secondary, styles.grow]}>
        {NW.finishFirst}
      </Text>
    </View>
  );
}

function LaterCard({
  view,
  manage,
  chosen,
  acts,
}: {
  view: TrackView;
  manage: boolean;
  chosen: string | null;
  acts: Acts;
}) {
  return (
    <View style={styles.card}>
      <View>
        <Text size={13} weight="semibold" style={styles.secondary} accessibilityRole="header">
          {NW.later.toUpperCase()}
        </Text>
        <Text size={13} style={styles.secondary}>
          {NW.laterNote}
        </Text>
      </View>
      {view.later.length === 0 ? (
        <Text size={15} style={styles.secondary}>
          {NW.nothingElse(view.track.place)}
        </Text>
      ) : (
        view.later.map((row) => (
          <LaterLine
            key={row.item.id}
            row={row}
            on={row.item.id === chosen}
            choosable={manage && row.mark === 'notStarted'}
            onChoose={() => acts.choose(row.item.id)}
            onRef={(node) => acts.row(row.item.id, node)}
          />
        ))
      )}
    </View>
  );
}

const MARK_WORD = { done: NW.done, skipped: NW.skipped, notStarted: NW.notStarted } as const;

function LaterLine({
  row,
  on,
  choosable,
  onChoose,
  onRef,
}: {
  row: LaterRow;
  on: boolean;
  choosable: boolean;
  onChoose: () => void;
  onRef: (node: ViewInstance | null) => void;
}) {
  const inner = (
    <>
      <View style={styles.markCol}>
        {row.mark === 'done' ? (
          <View style={styles.markDone}>
            <Glyph paths={PATHS.tick} ink={tokens.colorInkOnDark} side={12} />
          </View>
        ) : (
          <Glyph
            paths={row.mark === 'skipped' ? PATHS.strike : []}
            ink={tokens.colorInkSecondary}
            side={20}
            circle
          />
        )}
      </View>
      <View style={styles.grow}>
        <Text
          size={16}
          weight="semibold"
          style={row.mark === 'skipped' ? [styles.secondary, styles.struck] : undefined}
        >
          {row.item.title}
        </Text>
        <Text size={13} style={[styles.secondary, styles.num]}>
          {[MARK_WORD[row.mark], row.time].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {choosable && <Glyph paths={['m9 6 6 6-6 6']} ink={tokens.colorInkSecondary} side={16} />}
    </>
  );

  return choosable ? (
    <Pressable
      onPress={onChoose}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.laterRow, on && styles.laterOn]}
      testID={`night.later.${row.item.id}`}
      ref={onRef}
    >
      {inner}
    </Pressable>
  ) : (
    <View style={styles.laterRow} accessible ref={onRef}>
      {inner}
    </View>
  );
}

function Chosen({
  row,
  view,
  manage,
  moving,
  onMove,
  onClose,
  acts,
}: {
  row: LaterRow;
  view: TrackView | null;
  manage: boolean;
  moving: boolean;
  onMove: (moving: boolean) => void;
  onClose: () => void;
  acts: Acts;
}) {
  const { item } = row;

  if (moving)
    return (
      <Panel title={`${NW.move}: ${item.title}`} onClose={onClose}>
        <DemoOnly title={NW.moveStub}>
          <SecondaryButton
            label={NW.leaveIt}
            onPress={() => onMove(false)}
            testID="night.leaveIt"
            stacked
          />
        </DemoOnly>
      </Panel>
    );

  return (
    <Panel title={item.title} onClose={onClose}>
      <Text size={15} style={[styles.secondary, styles.num]}>
        {`${row.time ?? ''} · ${item.owner ?? NW.noOwner} · ${item.length == null ? NW.noLength : `Lasts ${item.length} min`}`}
      </Text>
      {manage &&
        (view?.now == null ? (
          <Big
            label={NW.startNow}
            said={`${NW.startNow}: ${item.title}`}
            onPress={() => acts.start(item.id)}
            testID={`night.chosen.start.${item.id}`}
          />
        ) : (
          <FinishFirst />
        ))}
      <Big
        label={NW.skip}
        said={`${NW.skip}: ${item.title}`}
        onPress={() => acts.skip(item.id)}
        testID={`night.chosen.skip.${item.id}`}
        outlined
      />
      <Big
        label={NW.move}
        said={`${NW.move}: ${item.title}`}
        onPress={() => onMove(true)}
        testID={`night.chosen.move.${item.id}`}
        outlined
      />
    </Panel>
  );
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}
          testID="night.close"
        >
          <Glyph paths={['M6 6l12 12', 'M18 6 6 18']} ink={tokens.colorInk} side={20} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function Big({
  label,
  said,
  onPress,
  testID,
  outlined = false,
  onDark = false,
  wide = false,
}: {
  label: string;
  said: string;
  onPress: () => void;
  testID: string;
  outlined?: boolean;
  onDark?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={said}
      style={({ pressed }) => [
        styles.big,
        outlined ? styles.bigOutlined : styles.bigFilled,
        onDark && styles.bigOnDark,
        wide && styles.bigWide,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Text size={17} weight="bold" style={outlined && !onDark ? undefined : styles.onDark}>
        {label}
      </Text>
    </Pressable>
  );
}

function Skeleton({ layout }: { layout: Layout }) {
  const block = (height: number, dark = false) => (
    <View style={[styles.card, dark ? styles.dark : null, { height }]}>
      <View style={[styles.bone, dark && styles.boneDark]} />
      <View style={[styles.bone, styles.boneShort, dark && styles.boneDark]} />
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={NW.loading}
      accessibilityRole="progressbar"
      style={layout === 'tabletLandscape' ? styles.row : styles.stack}
    >
      <View style={layout === 'tabletLandscape' ? styles.column : styles.stack}>
        {block(240, true)}
        {block(160)}
      </View>
      <View style={styles.grow}>{block(320)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  split: { flex: 1, flexDirection: 'row' },
  body: { gap: tokens.spaceLg },
  bodyPhone: { paddingHorizontal: tokens.spaceLg },
  bodyTablet: { paddingHorizontal: tokens.space3xl },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccent },
  accentText: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  onDark: { color: tokens.colorInkOnDark },
  onDarkSecondary: { color: tokens.colorInkOnDarkSecondary },
  lock: {
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorDark,
  },
  overOnDark: { color: tokens.colorAttentionOnDark },
  num: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  struck: { textDecorationLine: 'line-through' },
  head: { gap: tokens.spaceSm },
  headTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  headLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizePill,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  onTime: { backgroundColor: tokens.colorAccentTint, borderColor: tokens.colorAccentTintBorder },
  behind: { backgroundColor: tokens.colorAttentionTint, borderColor: tokens.colorAttentionBorder },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colorAccent,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  menu: {
    alignSelf: 'flex-start',
    minWidth: 240,
    paddingVertical: tokens.spaceXs,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  stripOff: {
    padding: tokens.spaceMd,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorAttentionTint,
  },
  viewOnly: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  alert: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorAttentionTint,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  column: { width: '42%', gap: tokens.spaceLg },
  stack: { gap: tokens.spaceLg },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
  },
  dark: { backgroundColor: tokens.colorDark, borderColor: tokens.colorDark },
  endCard: { alignItems: 'flex-start' },
  endTick: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentHover,
  },
  link: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  elapsed: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  lasts: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  bar: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: tokens.colorDarkInset,
  },
  barFill: { backgroundColor: tokens.colorInkOnDark },
  pair: { flexDirection: 'row', gap: tokens.spaceMd, marginTop: tokens.spaceXs },
  time: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceXs },
  inset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  laterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: tokens.sizeListRow,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXs,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  laterOn: { backgroundColor: tokens.colorRowSelected, borderRadius: tokens.radiusSmall },
  markCol: { width: 24, alignItems: 'center' },
  markDone: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkSecondary,
  },
  big: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 28,
  },
  bigFilled: { backgroundColor: tokens.colorAccentHover },
  bigOutlined: {
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  bigOnDark: {
    flex: 1,
    backgroundColor: tokens.colorDark,
    borderColor: tokens.colorInkOnDarkSecondary,
  },
  bigWide: { flex: 2 },
  pressed: { opacity: 0.8 },
  docked: {
    width: tokens.sizePanel,
    borderLeftWidth: 1,
    borderLeftColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  scrim: { flex: 1 },
  scrimPhone: { justifyContent: 'flex-end', backgroundColor: tokens.scrimSheet },
  scrimDialog: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.scrimDialog,
  },
  sheet: {
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
    backgroundColor: tokens.colorCard,
  },
  dialog: {
    width: 480,
    maxWidth: '90%',
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorCard,
  },
  panel: { gap: tokens.spaceMd, padding: tokens.spaceXl },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bone: { height: 14, borderRadius: 7, backgroundColor: tokens.colorInset },
  boneShort: { width: '60%' },
  boneDark: { backgroundColor: tokens.colorDarkInset },
});
