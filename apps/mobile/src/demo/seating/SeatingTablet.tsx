import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { Glyph } from '../../components/Glyph.tsx';
import { useKeyboardTop } from '../../components/keyboardWatch.ts';
import { ReadOut } from '../../components/ReadOut.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { Ask, CardSays, OnCard, SummaryCard } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { Title } from '../../components/Title.tsx';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { useShell } from '../../components/settingsShell.ts';
import { tokens } from '../../theme/tokens.ts';
import { CardBackdrop } from '../../components/EventCard.tsx';
import { EventFrame } from '../events/EventFrame.tsx';
import type { Shown as EventShown } from '../events/EventsModel.ts';
import type { AreaKey } from '../events/EventsSample.ts';
import { Bell } from '../settings/Frame.tsx';
import type { Action } from './SeatingActs.ts';
import { PAD_FRAME, PAD_UNDER_TOOLS, fit, free, pct } from './SeatingGeometry.ts';
import {
  type Seating,
  editable,
  isTable,
  itemOf,
  length,
  partyOf,
  partySize,
  partyWho,
  sectionName,
  sectionOf,
  shapeChoice,
  placedCount,
  roomLine,
  whatGoes,
  SHAPE_CHOICES,
} from './SeatingModel.ts';
import { ArrangePanel, SeatPanel } from './SeatingPanel.tsx';
import {
  ChoiceSheet,
  Face,
  MessageBar,
  Presence,
  SaveLineView,
  SeatIcon,
  Segments,
  ShapeTile,
  SUNK,
} from './SeatingParts.tsx';
import { MiniMap, RoomSurface } from './SeatingRoom.tsx';
import { COLOURS, type Kind, OFFLINE_AT } from './SeatingSample.ts';
import { FailedView, ListView, OfflinePill, PrintSheet, TablesView } from './SeatingViews.tsx';
import { W, say } from './SeatingWords.ts';

type Go = (action: Action) => void;

const VIEWS = [
  { key: 'Floor plan', label: W.floorPlan },
  { key: 'Tables', label: W.tables },
  { key: 'List', label: W.list },
] as const;
const VIEW_GLYPHS = { 'Floor plan': 'map', Tables: 'cards', List: 'list' } as const;
const ADD: readonly [Kind, string][] = [
  ['round', 'Round table · 180 cm · 10 seats'],
  ['rect', 'Rectangular table · 180 × 76 cm · 6 seats'],
  ['head', 'Head table · 240 × 76 cm · 4 seats'],
  ['cocktail', 'Cocktail table · 60 cm · 4 places'],
];

function Tool({
  label,
  onPress,
  on = false,
  off = false,
  after,
  children,
  testID,
}: {
  label: string;
  onPress: () => void;
  on?: boolean;
  off?: boolean;
  after?: boolean;
  children?: ReactNode;
  testID: string;
}) {
  const ink = off ? tokens.colorInkTertiary : on ? tokens.colorAccent : tokens.colorInk;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [styles.tool, on && styles.toolOn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, expanded: after === true ? on : undefined }}
      accessibilityLabel={label}
      testID={testID}
    >
      {children}
      <Text size={14} weight="semibold" accessible={false} style={{ color: ink }}>
        {label}
      </Text>
      {after === true && (
        <SeatIcon name="chevdown" size={15} ink={tokens.colorInkSecondary} weight={2.4} />
      )}
    </Pressable>
  );
}

function RoundTool({
  label,
  glyph,
  onPress,
  testID,
}: {
  label: string;
  glyph: 'minus' | 'plus' | 'fit';
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.roundTool, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <SeatIcon name={glyph} size={19} ink={tokens.colorInk} weight={2.2} />
    </Pressable>
  );
}

function Skeleton({ m }: { m: Seating }) {
  const v = m.size == null ? null : fit(m.size.w, m.size.h, m.room, m.size.pad);
  if (v == null || m.size == null) return null;
  return (
    <Svg
      width={m.size.w}
      height={m.size.h}
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect
        x={v.ox}
        y={v.oy}
        width={m.room.w * v.s}
        height={m.room.l * v.s}
        rx={4}
        fill={tokens.colorCard}
        stroke={SUNK}
        strokeWidth={3}
      />
      {m.items
        .filter((it) => it.kind === 'round')
        .map((it) => (
          <Circle key={it.id} cx={v.ox + it.x * v.s} cy={v.oy + it.y * v.s} r={25} fill={SUNK} />
        ))}
    </Svg>
  );
}

function Pop({ m, go, out }: { m: Seating; go: Go; out: boolean }) {
  const pop = m.pop;
  const v = m.shown;
  if (pop == null || v == null || m.size == null) return null;
  if (pop.kind === 'addMenu')
    return (
      <View style={[styles.menu, styles.addMenu, out && styles.addMenuOut]}>
        {ADD.map(([kind, words]) => (
          <Pressable
            key={kind}
            onPress={() => go({ type: 'startPlacing', kind })}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressedFill]}
            accessibilityRole="menuitem"
            accessibilityLabel={words}
            testID={`seating.add.${kind}`}
          >
            <ShapeTile kind={kind} hex={null} side={36} />
            <Text size={15} weight="semibold" accessible={false} style={styles.grow}>
              {words}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  if (pop.kind === 'people')
    return (
      <View style={[styles.menu, styles.people]}>
        <Text size={16} weight="bold" accessibilityRole="header">
          {W.onThisPlan}
        </Text>
        {m.people.map((person) => (
          <View key={person.name} style={styles.personRow}>
            <Face person={person} side={28} />
            <Text size={15} weight="semibold" style={styles.grow}>
              {person.name}
            </Text>
            {person.viewer && (
              <Text size={13} weight="medium" style={styles.secondary}>
                {W.canView}
              </Text>
            )}
          </View>
        ))}
        <Pill
          label={W.close}
          kind="secondary"
          full={false}
          height={tokens.sizeHit}
          onPress={() => go({ type: 'pop', pop: null })}
          testID="seating.people.close"
        />
      </View>
    );
  if (pop.kind === 'select') return null;
  const it = itemOf(m, pop.id);
  if (it == null) return null;
  const at = {
    left: Math.min(m.size.w - 346, Math.max(16, v.ox + it.x * v.s - 150)),
    top: Math.min(m.size.h - 200, v.oy + it.y * v.s + 50),
  };
  if (pop.kind === 'moveAll') {
    const n = it.chairs.filter((c) => c.state === 'taken').length;
    const tables = m.items.filter((t) => t.id !== it.id && isTable(t) && free(t) >= n);
    return (
      <View style={[styles.menu, styles.moveAll]}>
        <Text size={17} weight="bold" accessibilityRole="header">
          {W.moveEveryone}
        </Text>
        <Text size={13.5} weight="medium" style={styles.secondary}>
          {say.roomForAll(n)}
        </Text>
        {tables.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => go({ type: 'moveAll', id: it.id, to: t.id })}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressedFill]}
            accessibilityRole="button"
            accessibilityLabel={`${t.name}, ${say.freeLine(sectionName(m, t), free(t))}`}
            testID={`seating.moveAll.${t.id}`}
          >
            <ShapeTile
              kind={t.kind}
              hex={
                sectionOf(m, t.sec) == null
                  ? null
                  : (COLOURS.find(([c]) => c === sectionOf(m, t.sec)?.colour)?.[1] ?? null)
              }
              side={36}
            />
            <View style={styles.grow}>
              <Text size={15} weight="semibold" accessible={false}>
                {t.name}
              </Text>
              <Text size={13.5} weight="medium" accessible={false} style={styles.secondary}>
                {say.freeLine(sectionName(m, t), free(t))}
              </Text>
            </View>
          </Pressable>
        ))}
        <Pill
          label={W.cancel}
          kind="secondary"
          full={false}
          height={tokens.sizeHit}
          onPress={() => go({ type: 'pop', pop: null })}
          testID="seating.moveAll.cancel"
        />
      </View>
    );
  }
  const party = partyOf(m, m.picked);
  if (party == null) return null;
  const lead = partyWho(party);
  const short = pop.kind === 'short';
  const who = short ? null : (it.chairs[pop.chair]?.who ?? W.taken);
  return (
    <View style={[styles.menu, styles.popCard, at]}>
      <Text size={15} weight="semibold" style={styles.popText}>
        {short
          ? `${say.short(it.name, free(it))}. ${say.partyIs(lead, partySize(party))}`
          : say.seatIs(it.name, pop.chair + 1, who ?? '')}
      </Text>
      <View style={styles.pair}>
        <Pill
          label={W.cancel}
          kind="secondary"
          full={false}
          height={tokens.sizeHit}
          onPress={() => (short ? go({ type: 'cancelPick' }) : go({ type: 'pop', pop: null }))}
          testID="seating.pop.cancel"
        />
        <Pill
          label={short ? say.seatJust(lead) : say.swapWith(who ?? '')}
          full={false}
          height={tokens.sizeHit}
          onPress={() =>
            short ? go({ type: 'seatJust' }) : go({ type: 'swapDo', id: it.id, chair: pop.chair })
          }
          testID="seating.pop.go"
        />
      </View>
    </View>
  );
}

function ViewSwitch({ m, go }: { m: Seating; go: Go }) {
  return (
    <Segments
      items={VIEWS}
      on={m.view}
      onPick={(view) => (m.load === 'ready' ? go({ type: 'setView', view }) : undefined)}
      height={48}
      glyphs={VIEW_GLYPHS}
      testID="seating.view"
    />
  );
}

function PrintButton({ go }: { go: Go }) {
  return (
    <Pressable
      onPress={() => go({ type: 'sheet', sheet: { kind: 'print' } })}
      style={({ pressed }) => [styles.print, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={W.print}
      testID="seating.print.open"
    >
      <SeatIcon name="print" size={17} ink={tokens.colorInk} />
      <Text size={14} weight="semibold" accessible={false}>
        {W.print}
      </Text>
    </Pressable>
  );
}

function Bars({ m, go }: { m: Seating; go: Go }) {
  if (m.bar == null) return null;
  return (
    <MessageBar
      bar={m.bar}
      onUndo={() => go({ type: 'undo' })}
      onCancel={() => go({ type: 'cancelPick' })}
      onCentre={() => go({ type: 'placeCentre' })}
      onStop={() => go({ type: 'stopPlacing' })}
      testID="seating.bar"
    />
  );
}

function AddTools({ m, go }: { m: Seating; go: Go }) {
  const ink = editable(m) ? tokens.colorInk : tokens.colorInkTertiary;
  return (
    <>
      {m.placing != null && (
        <Pressable
          onPress={() => go({ type: 'another' })}
          style={[styles.pill, styles.another]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: m.placeAnother }}
          accessibilityLabel={W.placeAnother}
          testID="seating.another"
        >
          <View style={[styles.check, m.placeAnother && styles.checkOn]}>
            {m.placeAnother && (
              <Glyph name="tick" size={14} ink={tokens.colorInkOnDark} weight={3} />
            )}
          </View>
          <Text size={14} weight="semibold" accessible={false}>
            {W.placeAnother}
          </Text>
        </Pressable>
      )}
      <View style={[styles.pill, styles.pillWraps]}>
        <Tool
          label={W.addTable}
          on={m.pop?.kind === 'addMenu' || m.placing != null}
          off={!editable(m)}
          after
          onPress={() =>
            go({ type: 'pop', pop: m.pop?.kind === 'addMenu' ? null : { kind: 'addMenu' } })
          }
          testID="seating.addTable"
        >
          <SeatIcon name="plus" size={18} ink={ink} weight={2.2} />
        </Tool>
        <Tool
          label={W.addRow}
          off={!editable(m)}
          onPress={() => go({ type: 'addRow' })}
          testID="seating.addRow"
        >
          <SeatIcon shape="row" size={18} ink={ink} weight={2.2} />
        </Tool>
        <Tool
          label={W.addSeat}
          off={!editable(m)}
          onPress={() => go({ type: 'addSeat' })}
          testID="seating.addSeat"
        >
          <SeatIcon shape="single" size={18} ink={ink} weight={2.2} />
        </Tool>
      </View>
    </>
  );
}

function ZoomTools({ go, p }: { go: Go; p: number }) {
  return (
    <View style={styles.pill}>
      <RoundTool
        label={W.zoomOut}
        glyph="minus"
        onPress={() => go({ type: 'zoomStep', up: false })}
        testID="seating.zoomOut"
      />
      <Text
        size={14}
        weight="semibold"
        accessibilityLabel={say.zoom(p)}
        style={[styles.pct, styles.figures]}
      >
        {`${p}%`}
      </Text>
      <RoundTool
        label={W.zoomIn}
        glyph="plus"
        onPress={() => go({ type: 'zoomStep', up: true })}
        testID="seating.zoomIn"
      />
      <RoundTool
        label={W.fitRoom}
        glyph="fit"
        onPress={() => go({ type: 'fit' })}
        testID="seating.fit"
      />
    </View>
  );
}

/** The room's floating parts: the View switch and Print at its top, the bars under them, Add's bar and the zoom at its foot, the small map from 200%. */
function RoomOverlays({
  m,
  go,
  onViews,
  onPrint,
}: {
  m: Seating;
  go: Go;
  onViews: (end: number) => void;
  onPrint: (start: number) => void;
}) {
  const plan = m.view === 'Floor plan';
  const p = m.shown == null ? null : pct(m.shown.s);
  return (
    <>
      <View
        style={styles.topLeft}
        onLayout={(e) => onViews(Math.ceil(e.nativeEvent.layout.x + e.nativeEvent.layout.width))}
      >
        <ViewSwitch m={m} go={go} />
      </View>
      <View style={styles.topRight} onLayout={(e) => onPrint(Math.floor(e.nativeEvent.layout.x))}>
        <PrintButton go={go} />
      </View>
      {m.bar != null && (
        <View style={styles.bars}>
          <Bars m={m} go={go} />
        </View>
      )}
      {plan && !m.readOnly && (
        <View style={styles.bottomLeft}>
          <AddTools m={m} go={go} />
        </View>
      )}
      {plan && p != null && (
        <View style={styles.bottomRight}>
          {p >= 200 && m.shown != null && m.size != null && (
            <MiniMap m={m} v={m.shown} width={m.size.w} height={m.size.h} />
          )}
          <ZoomTools go={go} p={p} />
        </View>
      )}
      <Pop m={m} go={go} out={false} />
    </>
  );
}

/** From the accessibility text sizes the room's tools leave the room: the View switch, Print, the room's name and the bars above it, Add and the zoom under it, each wrapping, so none covers a wall or another (sc-31783). */
function RoomOutside({
  m,
  go,
  inside,
  onHold,
}: {
  m: Seating;
  go: Go;
  inside: ReactNode;
  onHold: (held: boolean) => void;
}) {
  const ready = m.load === 'ready';
  const plan = ready && m.view === 'Floor plan';
  const p = m.shown == null ? null : pct(m.shown.s);
  const foot = plan && (!m.readOnly || p != null);
  return (
    <>
      {(ready || m.load === 'loading') && (
        <View style={styles.strip}>
          <ViewSwitch m={m} go={go} />
          {ready && <PrintButton go={go} />}
        </View>
      )}
      {plan && (
        <Text
          size={12.5}
          weight="semibold"
          accessibilityRole="header"
          accessibilityLabel={say.roomLabel(m.room.name, length(m, m.room.w), length(m, m.room.l))}
          style={[styles.secondary, styles.stripLine]}
        >
          {roomLine(m)}
        </Text>
      )}
      {ready && m.bar != null && (
        <View style={styles.stripLine}>
          <Bars m={m} go={go} />
        </View>
      )}
      <View
        style={[styles.drawing, m.fields.focus != null && styles.drawingShort]}
        onTouchStart={() => onHold(true)}
        onTouchEnd={(e) => onHold(e.nativeEvent.touches.length > 0)}
        onTouchCancel={() => onHold(false)}
        onLayout={(e) =>
          go({
            type: 'laid',
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
            pad: PAD_FRAME,
          })
        }
      >
        {inside}
        {plan && p != null && p >= 200 && m.shown != null && m.size != null && (
          <View style={styles.bottomRight}>
            <MiniMap m={m} v={m.shown} width={m.size.w} height={m.size.h} />
          </View>
        )}
        {ready && <Pop m={m} go={go} out />}
      </View>
      {foot && (
        <View style={styles.strip}>
          {!m.readOnly && <AddTools m={m} go={go} />}
          {p != null && <ZoomTools go={go} p={p} />}
        </View>
      )}
    </>
  );
}

function RoomArea({
  m,
  go,
  event,
  style,
  onHold,
}: {
  m: Seating;
  go: Go;
  event: EventShown;
  style: object;
  onHold: (held: boolean) => void;
}) {
  const size = m.size;
  const out = atAccessibilitySizes(useWindowDimensions().fontScale);
  const [viewsEnd, setViewsEnd] = useState(0);
  const [printStart, setPrintStart] = useState(0);
  const viewsTop = out ? tokens.spaceXl : m.bar == null ? 76 : 140;
  let inside: ReactNode;
  if (m.load === 'loading') inside = <Skeleton m={m} />;
  else if (m.load === 'failed') inside = <FailedView onTry={() => go({ type: 'retry' })} />;
  else if (m.load === 'noPlan')
    inside = (
      <View style={styles.centred}>
        <View style={styles.noPlan}>
          <SummaryCard
            height={200}
            backdrop={<CardBackdrop event={event} />}
            step={{
              label: W.startPlan,
              onPress: () => go({ type: 'openStart' }),
              testID: 'seating.startPlan',
            }}
          >
            <CardSays text={W.noPlan} heading />
            <OnCard text={W.noPlanLine} />
          </SummaryCard>
        </View>
      </View>
    );
  else if (m.load === 'start')
    inside = (
      <View style={styles.centred}>
        <Text size={15} weight="medium" style={[styles.secondary, styles.hint]}>
          {W.appearsHere}
        </Text>
      </View>
    );
  else if (m.view === 'Tables') inside = <TablesView m={m} go={go} top={viewsTop} />;
  else if (m.view === 'List') inside = <ListView m={m} go={go} top={viewsTop} />;
  else
    inside =
      size == null ? null : (
        <RoomSurface
          m={m}
          dispatch={go}
          width={size.w}
          height={size.h}
          viewsEnd={viewsEnd}
          printStart={printStart}
          caption={!out}
        />
      );
  if (out)
    return (
      <View style={[styles.room, style]}>
        <RoomOutside m={m} go={go} inside={inside} onHold={onHold} />
      </View>
    );
  return (
    <View
      style={[styles.room, style]}
      onLayout={(e) =>
        go({
          type: 'laid',
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
          pad: PAD_UNDER_TOOLS,
        })
      }
    >
      {inside}
      {m.load === 'ready' && (
        <RoomOverlays m={m} go={go} onViews={setViewsEnd} onPrint={setPrintStart} />
      )}
      {m.load === 'loading' && (
        <View style={styles.topLeft}>
          <ViewSwitch m={m} go={go} />
        </View>
      )}
    </View>
  );
}

function PanelBody({ m, go }: { m: Seating; go: Go }) {
  if (m.load === 'loading')
    return (
      <View style={styles.panelGap} accessible accessibilityLabel={W.loading}>
        {[44, 24, 18, 44, 24, 52, 52, 52, 52].map((h, i) => (
          <View
            key={i}
            style={[styles.shape, { height: h, width: i % 3 === 1 ? '45%' : '100%' }]}
          />
        ))}
      </View>
    );
  return (
    <View style={styles.panelGap}>
      {m.load !== 'start' && (
        <Segments
          items={[
            { key: 'Arrange', label: W.arrange },
            { key: 'Seat', label: W.seat },
          ]}
          on={m.tab}
          onPick={(tab) => go({ type: 'tab', tab })}
          height={48}
          testID="seating.tab"
        />
      )}
      {m.tab === 'Arrange' || m.load === 'start' ? (
        <ArrangePanel key={m.chosen ?? 'none'} m={m} go={go} />
      ) : (
        <SeatPanel m={m} go={go} />
      )}
    </View>
  );
}

function HeadParts({ m, go }: { m: Seating; go: Go }) {
  const shell = useShell();
  const quiet =
    m.load === 'noPlan' || m.load === 'loading' || m.load === 'failed' || m.load === 'start';
  return (
    <>
      {m.offline && <OfflinePill at={OFFLINE_AT} />}
      {!m.offline && !quiet && (
        <Presence
          people={m.people}
          reconnecting={m.presence === 'reconnecting'}
          onMore={() => go({ type: 'pop', pop: { kind: 'people' } })}
          line={say.onPlan}
        />
      )}
      {!m.offline && !quiet && (
        <SaveLineView save={m.save} onTryAgain={() => go({ type: 'tryAgain' })} />
      )}
      {m.spoken != null && <ReadOut words={m.spoken} />}
      {shell.layout === 'landscape' && <Bell tell={shell.tell} />}
    </>
  );
}

export function Overlays({ m, go }: { m: Seating; go: Go }) {
  const opener = useRef<ViewInstance>(null);
  const ask = m.ask;
  const it = ask?.kind === 'deleteItem' || ask?.kind === 'swap' ? itemOf(m, ask.id) : null;
  const sec = ask?.kind === 'deleteSection' ? sectionOf(m, ask.key) : null;
  const words =
    ask == null
      ? null
      : ask.kind === 'deletePlan'
        ? {
            title: W.deletePlanAsk,
            line: say.deletePlanBody(whatGoes(m), placedCount(m.items)),
            keep: W.keepPlan,
            confirm: W.deletePlan,
            removes: true,
          }
        : ask.kind === 'deleteSection'
          ? {
              title: say.deleteAsk(sec?.name ?? ''),
              line: say.sectionDeleteBody(
                m.items.filter((t) => t.sec === ask.key && isTable(t)).length,
              ),
              keep: W.keepIt,
              confirm: W.deleteSection,
              removes: true,
            }
          : ask.kind === 'deleteItem'
            ? {
                title: say.deleteAsk(it?.name ?? ''),
                line: say.deleteBody(
                  it == null ? 0 : it.chairs.filter((c) => c.state === 'taken').length,
                ),
                keep: W.keepIt,
                confirm: say.deleteVerb(it?.name ?? ''),
                removes: true,
              }
            : {
                title: say.swapAsk(it?.chairs[ask.chair]?.who ?? ''),
                line: say.swapLine(it?.chairs[ask.chair]?.who ?? ''),
                keep: W.cancel,
                confirm: W.swap,
                removes: false,
              };
  const chosen = itemOf(m, m.chosen);
  const select = m.pop?.kind === 'select' ? m.pop.field : null;
  const choices =
    select === 'Section'
      ? [
          ...m.sections.map((s) => ({
            label: s.name,
            hex: COLOURS.find(([c]) => c === s.colour)?.[1] ?? null,
          })),
          { label: W.noSection, hex: null },
        ]
      : select === 'Shape'
        ? SHAPE_CHOICES.map((label) => ({ label }))
        : Array.from({ length: 24 }, (_, i) => ({ label: `${i * 15}°` }));
  const value =
    chosen == null
      ? ''
      : select === 'Section'
        ? sectionName(m, chosen)
        : select === 'Shape'
          ? shapeChoice(chosen)
          : `${chosen.rot}°`;
  return (
    <>
      <Ask
        open={words != null}
        opener={opener}
        title={words?.title ?? ''}
        line={words?.line ?? ''}
        keep={{ label: words?.keep ?? W.keepIt, testID: 'seating.ask.keep' }}
        confirm={{
          label: words?.confirm ?? '',
          removes: words?.removes ?? false,
          testID: 'seating.ask.confirm',
        }}
        onKeep={() => go({ type: 'ask', ask: null })}
        onConfirm={() => go({ type: 'confirm' })}
        width={400}
        testID="seating.ask"
      />
      <ChoiceSheet
        open={select != null}
        title={select === 'Section' ? W.section : select === 'Shape' ? W.shape : W.rotation}
        choices={choices}
        value={value}
        onPick={(label) => select != null && go({ type: 'choose', field: select, value: label })}
        onClose={() => go({ type: 'pop', pop: null })}
      />
      <PrintSheet m={m} go={go} />
    </>
  );
}

/** Seating on the iPad (seating-a-spec §2): on its side the room beside the panel; upright the room across, the panel under it. */
export function SeatingTablet({
  m,
  go,
  event,
  now,
  more,
  onMore,
  onArea,
}: {
  m: Seating;
  go: Go;
  event: EventShown;
  now: Date;
  more: boolean;
  onMore: (open: boolean) => void;
  onArea: (area: AreaKey) => void;
}) {
  const { layout } = useShell();
  const out = atAccessibilitySizes(useWindowDimensions().fontScale);
  const [held, setHeld] = useState(false);
  const panel = m.load !== 'failed' && m.load !== 'noPlan';
  const panelBody = <PanelBody m={m} go={go} />;
  const keysTop = useKeyboardTop();
  const roomBox = useRef<ViewInstance>(null);
  const panelScroll = useRef<ScrollViewInstance>(null);
  const [roomTop, setRoomTop] = useState(0);
  const [panelNeed, setPanelNeed] = useState(0);
  const formUp =
    keysTop != null &&
    roomTop > 0 &&
    (m.load === 'start' || m.arrange === 'sectionAdd' || m.arrange === 'sectionEdit');
  const roomHeight = formUp
    ? Math.min(UPRIGHT_ROOM, Math.max(UPRIGHT_ROOM_LEAST, keysTop - roomTop - 14 - panelNeed))
    : null;
  useEffect(() => {
    if (roomHeight != null) panelScroll.current?.scrollTo({ y: 0, animated: true });
  }, [roomHeight]);
  if (layout === 'landscape')
    return (
      <EventFrame
        event={event}
        now={now}
        area="seating"
        onArea={onArea}
        more={more}
        onMore={onMore}
        fill
        overlay={<Overlays m={m} go={go} />}
      >
        <View style={styles.side}>
          <View style={styles.head}>
            <Title
              size={out ? SIDE_TITLE_STEPS : 24}
              accessibilityRole="header"
              style={[styles.titleGrow, styles.title24]}
            >
              {W.seating}
            </Title>
            <HeadParts m={m} go={go} />
          </View>
          <View style={styles.body}>
            {out ? (
              <ScrollView
                style={styles.grow}
                contentContainerStyle={styles.roomScroll}
                scrollEnabled={!held}
                keyboardShouldPersistTaps="handled"
                testID="seating.roomScroll"
              >
                <RoomArea m={m} go={go} event={event} style={styles.roomGrows} onHold={setHeld} />
              </ScrollView>
            ) : (
              <RoomArea m={m} go={go} event={event} style={styles.grow} onHold={setHeld} />
            )}
            {panel && (
              <ScrollView
                style={styles.panel}
                contentContainerStyle={styles.panelInside}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
              >
                {panelBody}
              </ScrollView>
            )}
          </View>
        </View>
      </EventFrame>
    );
  const top = (
    <>
      <View style={styles.titleRow}>
        <Title size={30} accessibilityRole="header" style={[styles.titleGrow, styles.title30]}>
          {W.seating}
        </Title>
        <HeadParts m={m} go={go} />
      </View>
      {m.load === 'noPlan' ? (
        <SummaryCard
          height={200}
          backdrop={<CardBackdrop event={event} />}
          step={{
            label: W.startPlan,
            onPress: () => go({ type: 'openStart' }),
            testID: 'seating.startPlan',
          }}
        >
          <CardSays text={W.noPlan} heading />
          <OnCard text={W.noPlanLine} />
        </SummaryCard>
      ) : (
        <View
          ref={roomBox}
          onLayout={() => roomBox.current?.measureInWindow((_, y) => setRoomTop(y))}
        >
          <RoomArea
            m={m}
            go={go}
            event={event}
            style={
              out
                ? styles.uprightGrows
                : [
                    styles.uprightRoom,
                    m.fields.focus != null && styles.uprightShort,
                    roomHeight != null && { height: roomHeight },
                  ]
            }
            onHold={setHeld}
          />
        </View>
      )}
    </>
  );
  return (
    <EventFrame
      event={event}
      now={now}
      area="seating"
      onArea={onArea}
      more={more}
      onMore={onMore}
      fill
      overlay={<Overlays m={m} go={go} />}
    >
      {out ? (
        <ScrollView
          style={styles.upright}
          contentContainerStyle={[styles.uprightAll, styles.uprightPanel]}
          scrollEnabled={!held}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          testID="seating.pageScroll"
        >
          {top}
          {panel && panelBody}
        </ScrollView>
      ) : (
        <View style={[styles.upright, styles.uprightAll]}>
          {top}
          {panel && (
            <ScrollView
              ref={panelScroll}
              style={styles.grow}
              contentContainerStyle={styles.uprightPanel}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              onContentSizeChange={(_, h) => setPanelNeed(h - UPRIGHT_PANEL_END)}
            >
              {panelBody}
            </ScrollView>
          )}
        </View>
      )}
    </EventFrame>
  );
}

// While the keys are up on Start the plan or a section's name, the upright room gives way, to 160 at least, until the whole form and its refusal sit above them (sc-31783).
const UPRIGHT_ROOM = 560;
const UPRIGHT_ROOM_LEAST = 160;
const UPRIGHT_PANEL_END = tokens.space6xl * 3;

// From the accessibility sizes the title on its side takes iOS's Title 1 steps, as upright; 24 has none of its own.
const SIDE_TITLE_STEPS = 30;

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  pressedFill: { backgroundColor: tokens.colorInset },
  side: { flex: 1 },
  head: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: tokens.space3xl,
    paddingRight: tokens.spaceXl,
    paddingVertical: tokens.spaceSm,
    flexWrap: 'wrap',
    rowGap: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  titleGrow: { flexGrow: 1 },
  title24: { letterSpacing: 24 * -0.02 },
  title30: { letterSpacing: 30 * -0.02, lineHeight: 34 },
  body: { flex: 1, flexDirection: 'row' },
  room: { backgroundColor: tokens.colorInset, overflow: 'hidden' },
  panel: { width: 300, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: tokens.colorBorder },
  panelInside: { padding: tokens.spaceXl, paddingBottom: tokens.space6xl * 2 },
  panelGap: { gap: 14 },
  shape: { borderRadius: tokens.spaceMd, backgroundColor: SUNK },
  upright: { flex: 1 },
  uprightAll: { paddingHorizontal: tokens.space3xl, gap: 14 },
  uprightPanel: { paddingBottom: UPRIGHT_PANEL_END },
  titleRow: {
    minHeight: 52,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  uprightRoom: { height: UPRIGHT_ROOM, borderRadius: tokens.spaceXxl },
  uprightShort: { height: 380 },
  uprightGrows: { borderRadius: tokens.spaceXxl },
  roomScroll: { flexGrow: 1 },
  roomGrows: { flexGrow: 1 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.space3xl },
  noPlan: { width: 420, maxWidth: '100%' },
  hint: { maxWidth: 300, textAlign: 'center', lineHeight: 15 * 1.45 },
  topLeft: { position: 'absolute', left: tokens.spaceXl, top: tokens.spaceXl },
  topRight: { position: 'absolute', right: tokens.spaceXl, top: tokens.spaceXl },
  bars: {
    position: 'absolute',
    left: tokens.spaceXl,
    right: tokens.spaceXl,
    top: 76,
    maxWidth: 520,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
    padding: tokens.spaceXl,
  },
  stripLine: { paddingHorizontal: tokens.spaceXl, paddingBottom: tokens.spaceSm },
  drawing: { height: 560, overflow: 'hidden' },
  drawingShort: { height: 380 },
  pillWraps: { flexWrap: 'wrap', flexShrink: 1 },
  bottomLeft: {
    position: 'absolute',
    left: tokens.spaceXl,
    bottom: tokens.spaceXl,
    gap: tokens.spaceSm,
    alignItems: 'flex-start',
  },
  bottomRight: {
    position: 'absolute',
    right: tokens.spaceXl,
    bottom: tokens.spaceXl,
    gap: tokens.spaceSm,
    alignItems: 'flex-end',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceHair,
    padding: tokens.spaceXxs,
    borderRadius: 26,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.raised.ios,
    elevation: tokens.elevationNative.raised.android.elevation,
  },
  another: { minHeight: 52, paddingHorizontal: tokens.spaceMd, gap: tokens.spaceSm },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
  },
  checkOn: { backgroundColor: tokens.colorAccent, borderColor: tokens.colorAccent },
  tool: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 24,
  },
  toolOn: { backgroundColor: tokens.colorAccentTint },
  roundTool: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: { minWidth: 52, textAlign: 'center' },
  print: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingLeft: tokens.spaceLg,
    paddingRight: 14,
    borderRadius: 22,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.card.ios,
    elevation: 1,
  },
  menu: {
    position: 'absolute',
    padding: tokens.spaceXs,
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.raised.ios,
    elevation: 8,
  },
  addMenu: { left: tokens.spaceXl, bottom: 84, width: 380 },
  addMenuOut: { bottom: tokens.spaceXl, maxWidth: '90%' },
  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.spaceLg,
  },
  people: {
    left: tokens.spaceXl,
    top: 76,
    width: 280,
    padding: tokens.spaceXl,
    gap: tokens.spaceXs,
  },
  personRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  moveAll: {
    right: tokens.spaceXl,
    top: 140,
    width: 300,
    padding: tokens.spaceXl,
    gap: tokens.spaceMd,
  },
  popCard: { width: 330, padding: tokens.spaceXl, gap: tokens.spaceMd },
  popText: { lineHeight: 15 * 1.4 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
});
