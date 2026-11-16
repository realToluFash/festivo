import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import {
  type Figure,
  type Row,
  type Run,
  type RunItem,
  type TrackView,
  RUN_EVENT_NAME,
  RW,
  figureSaid,
  figureWords,
  finishItem,
  lastsOf,
  nextLine,
  later,
  runAt,
  startItem,
  trackView,
} from './runViewModel.ts';

const PATHS = {
  tick: ['M20 6 9 17l-5-5'],
  clock: ['M12 7v5l3 2'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  warn: [
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
} as const;

export function RunViewRoute() {
  const params = useLocalSearchParams<{ state?: string; as?: string }>();
  const manage = params.as !== 'reader';

  return (
    <RunViewBody
      key={`${params.state ?? ''}|${manage}`}
      first={runAt(params.state)}
      manage={manage}
    />
  );
}

function RunViewBody({ first, manage }: { first: Run; manage: boolean }) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [run, setRun] = useState(first);
  const [trackId, setTrackId] = useState(first.tracks[0]?.id ?? '');
  const views = run.tracks.map((track) => trackView(track, run.clock));
  const phone = kind === 'phone';

  useReadOut(views.map((view) => figureSaid(view.track.name, view.figure)).join('. '), {
    quietAtMount: true,
  });

  const start = (track: string, item: string) => setRun(startItem(run, track, item));
  const finish = (track: string, item: string) => setRun(finishItem(run, track, item));

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
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
          testID="run.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        <View style={styles.head}>
          <View style={styles.grow}>
            <Text size={phone ? 28 : 30} weight="bold" accessibilityRole="header">
              {RW.title}
            </Text>
            <Text size={15} weight="medium" style={styles.secondary}>
              {RUN_EVENT_NAME}
            </Text>
          </View>
          <View style={styles.clock}>
            <Glyph paths={PATHS.clock} ink={tokens.colorInk} side={16} circle />
            <Text size={14} weight="semibold" style={styles.num}>
              Now {run.clock}
            </Text>
          </View>
        </View>
        {!manage && (
          <View style={styles.lock}>
            <Glyph paths={PATHS.lock} ink={tokens.colorInkSecondary} side={16} />
            <Text size={14} style={[styles.secondary, styles.grow]}>
              {RW.lock}
            </Text>
          </View>
        )}
        <DemoOnly title={RW.demoOnly}>
          <SecondaryButton
            label={RW.later}
            onPress={() => setRun(later(run, 5))}
            testID="run.later"
          />
        </DemoOnly>
        {phone ? (
          <PhoneTrack
            views={views}
            trackId={trackId}
            onTrack={setTrackId}
            manage={manage}
            onStart={start}
            onFinish={finish}
          />
        ) : (
          views.map((view) => (
            <TabletTrack
              key={view.track.id}
              view={view}
              narrow={kind === 'tabletPortrait'}
              manage={manage}
              onStart={(item) => start(view.track.id, item)}
              onFinish={(item) => finish(view.track.id, item)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function FigureMark({ figure }: { figure: Figure }) {
  const look =
    figure.kind === 'behind'
      ? styles.figureBehind
      : figure.kind === 'last'
        ? styles.figureLast
        : styles.figureOn;
  const ink =
    figure.kind === 'behind'
      ? tokens.colorAttentionText
      : figure.kind === 'last'
        ? tokens.colorAccentText
        : tokens.colorInkOnDark;

  return (
    <View style={[styles.figure, look]}>
      <Glyph
        paths={
          figure.kind === 'behind' ? PATHS.clock : figure.kind === 'last' ? PATHS.arrow : PATHS.tick
        }
        ink={ink}
        side={14}
        circle={figure.kind === 'behind'}
      />
      <Text size={14} weight="semibold" style={[styles.num, { color: ink }]}>
        {figureWords(figure)}
      </Text>
    </View>
  );
}

function TrackTop({ view }: { view: TrackView }) {
  return (
    <>
      <View
        style={styles.trackTop}
        accessible
        accessibilityLabel={figureSaid(view.track.name, view.figure)}
      >
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {view.track.name}
        </Text>
        {view.figure.kind !== 'done' && <FigureMark figure={view.figure} />}
      </View>
      {view.collisions.map((words) => (
        <View key={words} style={styles.collision}>
          <Glyph paths={PATHS.warn} ink={tokens.colorAttentionText} side={16} />
          <Text size={14} weight="semibold" style={[styles.grow, styles.attention]}>
            {words}
          </Text>
        </View>
      ))}
    </>
  );
}

function TabletTrack({
  view,
  narrow,
  manage,
  onStart,
  onFinish,
}: {
  view: TrackView;
  narrow: boolean;
  manage: boolean;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <TrackTop view={view} />
      <View
        style={styles.tableHead}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {RW.columns.slice(0, 4).map((column, index) => (
          <Text
            key={column}
            accessible={false}
            size={12}
            weight="semibold"
            style={[
              styles.secondary,
              COLUMN[index] ?? styles.grow,
              narrow && index === 3 && styles.ownerNarrow,
            ]}
          >
            {column}
          </Text>
        ))}
        {manage && <View style={styles.actCol} />}
      </View>
      {view.rows.map((row) => (
        <TableRow
          key={row.item.id}
          row={row}
          narrow={narrow}
          manage={manage}
          onStart={onStart}
          onFinish={onFinish}
        />
      ))}
      <Text size={14} style={[styles.secondary, styles.nextLine]}>
        {nextLine(view, manage)}
      </Text>
    </View>
  );
}

function TableRow({
  row,
  narrow,
  manage,
  onStart,
  onFinish,
}: {
  row: Row;
  narrow: boolean;
  manage: boolean;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
}) {
  const { item, second } = row;

  return (
    <View style={[styles.row, item.phase === 'now' && styles.rowNow]}>
      <View style={styles.startsCol} accessible accessibilityLabel={startsSaid(row)}>
        <Text
          size={16}
          weight="semibold"
          style={[styles.num, item.phase === 'done' && styles.secondary]}
        >
          {item.planned}
        </Text>
        {second != null && <Second second={second} size={13} />}
      </View>
      <Text size={14} style={[styles.lastsCol, item.length == null ? styles.none : styles.num]}>
        {row.lasts}
      </Text>
      <View style={styles.grow}>
        <ItemLine item={item} />
        {row.before != null && (
          <Text size={13} style={styles.secondary}>
            {row.before}
          </Text>
        )}
      </View>
      <Text
        size={14}
        style={[styles.ownerCol, narrow && styles.ownerNarrow, item.owner == null && styles.none]}
      >
        {item.owner ?? RW.noOwner}
      </Text>
      {manage && (
        <View style={styles.actCol}>
          <Act item={item} onStart={onStart} onFinish={onFinish} />
        </View>
      )}
    </View>
  );
}

function startsSaid({ item, second }: Row): string {
  return second == null
    ? `Planned ${item.planned}`
    : `Planned ${item.planned}, ${second.kind === 'expected' ? 'about' : 'started'} ${second.time}`;
}

function Second({ second, size }: { second: NonNullable<Row['second']>; size: 12 | 13 }) {
  return (
    <Text
      size={size}
      numberOfLines={1}
      weight="semibold"
      style={[styles.num, second.kind === 'expected' ? styles.attention : styles.secondary]}
    >
      {second.kind === 'expected' ? 'about' : 'started'} {second.time}
    </Text>
  );
}

function ItemLine({ item }: { item: RunItem }) {
  return (
    <View style={styles.itemLine}>
      <Text size={16} weight="semibold" style={item.phase === 'done' && styles.secondary}>
        {item.title}
      </Text>
      {item.phase !== 'waiting' && (
        <View style={[styles.tag, item.phase === 'now' && styles.tagNow]}>
          <Glyph
            paths={item.phase === 'done' ? PATHS.tick : PATHS.arrow}
            ink={item.phase === 'done' ? tokens.colorInkSecondary : tokens.colorAccentText}
            side={12}
          />
          <Text
            size={12}
            weight="semibold"
            style={item.phase === 'done' ? styles.secondary : styles.accentText}
          >
            {item.phase === 'done' ? RW.done : RW.now}
          </Text>
        </View>
      )}
      {item.fixed && (
        <View style={[styles.tag, styles.tagFixed]}>
          <Glyph paths={PATHS.lock} ink={tokens.colorInkSecondary} side={12} />
          <Text size={12} weight="semibold" style={styles.secondary}>
            {RW.fixed}
          </Text>
        </View>
      )}
    </View>
  );
}

function Act({
  item,
  onStart,
  onFinish,
}: {
  item: RunItem;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
}) {
  if (item.phase === 'waiting')
    return (
      <SecondaryButton
        label={RW.start}
        accessibilityLabel={`${RW.start} ${item.title}`}
        onPress={() => onStart(item.id)}
        testID={`run.start.${item.id}`}
      />
    );
  if (item.phase === 'now')
    return (
      <PrimaryButton
        label={RW.finish}
        accessibilityLabel={`${RW.finish} ${item.title}`}
        onPress={() => onFinish(item.id)}
        testID={`run.finish.${item.id}`}
      />
    );

  return null;
}

function PhoneTrack({
  views,
  trackId,
  onTrack,
  manage,
  onStart,
  onFinish,
}: {
  views: readonly TrackView[];
  trackId: string;
  onTrack: (id: string) => void;
  manage: boolean;
  onStart: (track: string, item: string) => void;
  onFinish: (track: string, item: string) => void;
}) {
  const view = views.find((one) => one.track.id === trackId) ?? views[0];

  if (view == null) return null;

  const id = view.track.id;

  return (
    <>
      <View style={styles.segments} accessibilityRole="tablist">
        {views.map((one) => (
          <Pressable
            key={one.track.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: one.track.id === id }}
            onPress={() => onTrack(one.track.id)}
            style={[styles.segment, one.track.id === id && styles.segmentOn]}
            testID={`run.track.${one.track.id}`}
          >
            <Text
              size={15}
              weight="semibold"
              style={one.track.id === id ? styles.accentText : styles.secondary}
            >
              {one.track.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        <TrackTop view={view} />
      </View>
      <View style={styles.card}>
        <Text size={13} weight="semibold" style={styles.secondary}>
          {RW.now.toUpperCase()}
        </Text>
        {view.now.length === 0 ? (
          <Text size={18} weight="semibold" style={styles.secondary}>
            {view.figure.kind === 'done' ? RW.allDone : RW.nothingNow}
          </Text>
        ) : (
          view.now.map(({ item, before }, index) => (
            <View key={item.id} style={[styles.nowItem, index > 0 && styles.nowAlso]}>
              <ItemLine item={item} />
              <Text size={14} style={styles.secondary}>
                {`Started ${item.started ?? item.planned} · planned ${item.planned} · ${lastsOf(item)}`}
              </Text>
              {before != null && (
                <Text size={14} style={styles.secondary}>
                  {before}
                </Text>
              )}
              <Text size={14} style={item.owner == null ? styles.none : styles.secondary}>
                {item.owner ?? RW.noOwner}
              </Text>
              {manage && (
                <Act item={item} onStart={() => undefined} onFinish={(one) => onFinish(id, one)} />
              )}
            </View>
          ))
        )}
      </View>
      {view.next != null && (
        <View style={styles.card}>
          <Text size={13} weight="semibold" style={styles.secondary}>
            {RW.next.toUpperCase()}
          </Text>
          <ItemLine item={view.next.item} />
          <View style={styles.itemLine}>
            <Text size={16} weight="semibold" style={styles.num}>
              {view.next.item.planned}
            </Text>
            {view.next.expected !== view.next.item.planned && (
              <Text size={16} weight="semibold" style={[styles.num, styles.attention]}>
                {`→ about ${view.next.expected}`}
              </Text>
            )}
          </View>
          <Text size={14} style={styles.secondary}>
            {`${lastsOf(view.next.item)} · ${view.next.item.owner ?? RW.noOwner}`}
          </Text>
          {manage && (
            <Act
              item={view.next.item}
              onStart={(item) => onStart(id, item)}
              onFinish={() => undefined}
            />
          )}
        </View>
      )}
      {view.figure.kind !== 'done' && (
        <View style={styles.card}>
          <Text size={13} weight="semibold" style={styles.secondary}>
            {RW.then.toUpperCase()}
          </Text>
          {view.then.length === 0 ? (
            <Text size={15} style={styles.secondary}>
              {RW.nothingThen}
            </Text>
          ) : (
            view.then.map((row) => (
              <View key={row.item.id} style={styles.thenRow}>
                <View style={styles.thenTime} accessible accessibilityLabel={startsSaid(row)}>
                  <Text size={15} weight="semibold" style={styles.num}>
                    {row.item.planned}
                  </Text>
                  {row.second != null && <Second second={row.second} size={12} />}
                </View>
                <View style={styles.grow}>
                  <ItemLine item={row.item} />
                  <Text size={13} style={row.item.length == null ? styles.none : styles.secondary}>
                    {row.lasts}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { gap: tokens.spaceLg },
  bodyPhone: { paddingHorizontal: tokens.spaceLg },
  bodyTablet: { paddingHorizontal: tokens.space3xl },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccent },
  accentText: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  none: { color: tokens.colorInkSecondary, fontStyle: 'italic' },
  num: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceMd },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
    minHeight: tokens.sizePill,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
  },
  trackTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: tokens.spaceMd },
  figure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    minHeight: tokens.sizePill,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
  },
  figureOn: { backgroundColor: tokens.colorAccent, borderColor: tokens.colorAccent },
  figureBehind: {
    backgroundColor: tokens.colorAttentionTint,
    borderColor: tokens.colorAttentionBorder,
  },
  figureLast: {
    backgroundColor: tokens.colorAccentTint,
    borderColor: tokens.colorAccentTintBorder,
  },
  collision: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    padding: tokens.spaceMd,
    borderWidth: 1,
    borderColor: tokens.colorAttentionBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorAttentionTint,
  },
  tableHead: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingBottom: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  rowNow: { backgroundColor: tokens.colorAccentTint, borderRadius: tokens.radiusSmall },
  startsCol: { width: 144 },
  lastsCol: { width: 104 },
  ownerCol: { width: 150 },
  ownerNarrow: { width: 112 },
  actCol: { width: 104, alignItems: 'flex-end' },
  itemLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceHair,
    borderRadius: tokens.radiusPill,
  },
  tagNow: {
    borderWidth: 1,
    borderColor: tokens.colorAccentTintBorder,
    backgroundColor: tokens.colorCard,
  },
  tagFixed: {
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  segments: {
    flexDirection: 'row',
    gap: tokens.spaceHair,
    padding: tokens.spaceHair,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  segment: {
    flex: 1,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
  },
  segmentOn: { backgroundColor: tokens.colorCard },
  thenRow: {
    flexDirection: 'row',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceSm,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  thenTime: { width: 112 },
  nowItem: { gap: tokens.spaceMd },
  nowAlso: {
    paddingTop: tokens.spaceMd,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  nextLine: { paddingTop: tokens.spaceSm },
  lock: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
});

const COLUMN = [styles.startsCol, styles.lastsCol, styles.grow, styles.ownerCol];
