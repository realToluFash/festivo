import { initials } from '@soirely/domain';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  PanResponder,
  type PanResponderGestureState,
  Pressable,
  StyleSheet,
  View,
  type ViewInstance,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { Action } from './SeatingActs.ts';
import {
  CHAIR_HIT,
  CHAIR_R,
  HANDLE_DRAWN,
  HANDLE_HIT,
  type Detail,
  type Point,
  type View as Shown,
  bounds,
  chairPoints,
  clearCorner,
  detailOf,
  extent,
  filled,
  handlePoints,
  heldInside,
  isCircle,
  itemAt,
  overlapping,
  reachOf,
  snapped,
  sideFrom,
  turn,
  usable,
  wordsAt,
  nameAt,
  zoomAbout,
  wordsBox,
} from './SeatingGeometry.ts';
import {
  type Seating,
  accName,
  arrangeable,
  chairWord,
  handlesLive,
  hexOf,
  itemOf,
  length,
  ofWords,
  roomLine,
  sectionOf,
} from './SeatingModel.ts';
import { NO_SECTION_EDGE, type Item, type Person } from './SeatingSample.ts';
import { EMPTY_EDGE, OFF_EDGE, OFF_FILL, SUNK, TAKEN_FILL } from './SeatingParts.tsx';
import { PROPOSED } from './SeatingTokens.ts';
import { say } from './SeatingWords.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;
const TINT = tokens.colorAccentTint;
const VIOLET = tokens.colorAccent;
const AMBER = tokens.colorAttention;
const VIEWS_BAND = tokens.spaceXl + 48;

export interface Look {
  lit?: boolean;
  ring?: Person;
  overlap?: boolean;
  faint?: boolean;
  handles?: number;
}

/** A colleague's initials on the table they have chosen, placed once every word in the room is known (sc-31783). */
interface Badge {
  key: string;
  corners: Point[];
  colour: string;
  words: string;
}

const BADGE_W = 30;
const BADGE_H = 22;

interface Label {
  key: string;
  x: number;
  y: number;
  words: string;
  size: number;
  bold: boolean;
  ink: string;
  start?: boolean;
}

function colourOf(m: Seating, it: Item): string {
  const sec = sectionOf(m, it.sec);
  return sec == null ? NO_SECTION_EDGE : hexOf(sec.colour);
}

export function hasHandles(it: Item): boolean {
  return it.kind === 'round' || it.kind === 'cocktail' || it.kind === 'rect' || it.kind === 'head';
}

/** One item at s px a cm (seating-a-spec §2 and §3): its lit Tint, body, chairs in their states, and the marks of a colleague, overlap and handles. A plain call, not a component: it fills `labels` before the overlay reads them. */
function itemShape({
  m,
  it,
  v,
  detail,
  look,
  chosenChair,
  labels,
  badges,
}: {
  m: Seating;
  it: Item;
  v: Shown;
  detail: Detail;
  look: Look;
  chosenChair: number | null;
  labels: Label[];
  badges: Badge[];
}) {
  const s = v.s;
  const cx = v.ox + it.x * s;
  const cy = v.oy + it.y * s;
  const col = colourOf(m, it);
  const e = extent(it);
  const circle = isCircle(it);
  const out: ReactNode[] = [];
  if (look.lit === true)
    out.push(
      circle ? (
        <Circle key="lit" cx={cx} cy={cy} r={e.x * s + 10} fill={TINT} />
      ) : (
        <Rect
          key="lit"
          x={-e.x * s - 10}
          y={-e.y * s - 10}
          width={2 * e.x * s + 20}
          height={2 * e.y * s + 20}
          rx={12}
          fill={TINT}
          transform={`translate(${cx} ${cy}) rotate(${it.rot})`}
        />
      ),
    );
  const body: ReactNode[] = [];
  if (it.kind === 'round' || it.kind === 'cocktail')
    body.push(
      <Circle
        key="b"
        cx={cx}
        cy={cy}
        r={(it.d / 2) * s}
        fill={tokens.colorCard}
        stroke={col}
        strokeWidth={detail === 'out' ? 2 : 2.2}
      />,
    );
  if (it.kind === 'rect' || it.kind === 'head')
    body.push(
      <Rect
        key="b"
        x={(-it.w / 2) * s}
        y={(-it.l / 2) * s}
        width={it.w * s}
        height={it.l * s}
        rx={Math.min(4, (it.l * s) / 4)}
        fill={tokens.colorCard}
        stroke={col}
        strokeWidth={2.2}
        transform={`translate(${cx} ${cy}) rotate(${it.rot})`}
      />,
    );
  if (it.kind === 'single' && detail === 'out')
    body.push(
      <Circle
        key="b"
        cx={cx}
        cy={cy}
        r={Math.max(5, CHAIR_R * s)}
        fill={tokens.colorCard}
        stroke={col}
        strokeWidth={1.6}
        strokeDasharray="3 2"
      />,
    );
  if (it.kind === 'row') {
    const tab = turn({ x: -((it.chairs.length - 1) / 2) * it.spacing - 52, y: 0 }, it.rot);
    const th = Math.max(20, 2 * CHAIR_R * s);
    body.push(
      <Rect
        key="tab"
        x={cx + tab.x * s - 12}
        y={cy + tab.y * s - th / 2}
        width={24}
        height={th}
        rx={6}
        fill={SUNK}
        stroke={col}
        strokeWidth={1.6}
      />,
    );
    labels.push({
      key: `${it.id}.tab`,
      x: cx + tab.x * s,
      y: cy + tab.y * s,
      words: it.label,
      size: 12,
      bold: true,
      ink: tokens.colorInk,
    });
  }
  if (detail !== 'out') {
    const r = CHAIR_R * s;
    chairPoints(it).forEach((p0, i) => {
      const p = turn(p0, it.rot);
      const x = cx + p.x * s;
      const y = cy + p.y * s;
      const chair = it.chairs[i];
      if (chair == null) return;
      if (chosenChair === i)
        body.unshift(<Circle key={`lit${i}`} cx={x} cy={y} r={Math.max(r + 8, 22)} fill={TINT} />);
      if (it.kind === 'single') {
        body.push(
          <Circle
            key={`c${i}`}
            cx={x}
            cy={y}
            r={r}
            fill={tokens.colorCard}
            stroke={col}
            strokeWidth={1.6}
            strokeDasharray="3 2.5"
          />,
        );
        if (chair.state === 'taken')
          body.push(
            <Circle key={`t${i}`} cx={x} cy={y} r={Math.max(2.5, r - 3)} fill={TAKEN_FILL} />,
          );
        return;
      }
      body.push(
        <ChairShape
          key={`c${i}`}
          x={x}
          y={y}
          r={r}
          state={chair.state}
          square={it.kind === 'cocktail'}
          near={detail === 'near'}
        />,
      );
      if (detail === 'near' && chair.state !== 'held' && chair.state !== 'unusable') {
        const taken = chair.state === 'taken' && chair.who != null;
        labels.push({
          key: `${it.id}.${i}`,
          x,
          y,
          words: taken ? initials(chair.who ?? '') : String(i + 1),
          size: 13,
          bold: taken,
          ink: taken ? tokens.colorInkOnDark : tokens.colorInkSecondary,
        });
      }
    });
  }
  out.push(
    <G key="body" opacity={look.faint === true ? 0.45 : 1}>
      {body}
    </G>,
  );
  if (look.faint !== true) addWords(it, cx, cy, s, v.oy + m.room.l * s, detail, labels);
  if (look.ring != null) {
    const pad = look.lit === true ? 10 : 2;
    const c = look.ring.colour;
    const words = initials(look.ring.name);
    const badge = (corners: Point[]) => {
      badges.push({ key: `${it.id}.ring`, corners, colour: c, words });
    };
    if (circle) {
      const rr = e.x * s + pad + 3.5;
      out.push(
        <Circle
          key="gap"
          cx={cx}
          cy={cy}
          r={rr}
          fill="none"
          stroke={tokens.colorCard}
          strokeWidth={4}
        />,
      );
      out.push(
        <Circle key="ring" cx={cx} cy={cy} r={rr + 1.5} fill="none" stroke={c} strokeWidth={3} />,
      );
      const d = rr * 0.72;
      badge([
        { x: cx - d - 4, y: cy - d - 11 },
        { x: cx + d + 4 - BADGE_W, y: cy - d - 11 },
        { x: cx - d - 4, y: cy + d - 11 },
        { x: cx + d + 4 - BADGE_W, y: cy + d - 11 },
      ]);
    } else {
      const gw = e.x * s + pad + 2;
      const gh = e.y * s + pad + 2;
      out.push(
        <Rect
          key="ring"
          x={-gw - 1.5}
          y={-gh - 1.5}
          width={2 * gw + 3}
          height={2 * gh + 3}
          rx={10}
          fill="none"
          stroke={c}
          strokeWidth={3}
          transform={`translate(${cx} ${cy}) rotate(${it.rot})`}
        />,
      );
      badge([
        { x: cx - gw - 4, y: cy - gh - 11 },
        { x: cx + gw + 4 - BADGE_W, y: cy - gh - 11 },
        { x: cx - gw - 4, y: cy + gh - 11 },
        { x: cx + gw + 4 - BADGE_W, y: cy + gh - 11 },
      ]);
    }
  }
  if (look.overlap === true)
    out.push(
      circle ? (
        <Circle
          key="over"
          cx={cx}
          cy={cy}
          r={e.x * s + 6}
          fill="none"
          stroke={AMBER}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      ) : (
        <Rect
          key="over"
          x={-e.x * s - 6}
          y={-e.y * s - 6}
          width={2 * e.x * s + 12}
          height={2 * e.y * s + 12}
          rx={8}
          fill="none"
          stroke={AMBER}
          strokeWidth={2}
          strokeDasharray="6 4"
          transform={`translate(${cx} ${cy}) rotate(${it.rot})`}
        />
      ),
    );
  if (look.handles != null && hasHandles(it)) {
    const size = look.handles;
    const points = handlePoints(it, s, m);
    if (it.kind === 'round' || it.kind === 'cocktail') {
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      out.push(
        <Rect
          key="frame"
          x={cx + Math.min(...xs)}
          y={cy + Math.min(...ys)}
          width={Math.max(...xs) - Math.min(...xs)}
          height={Math.max(...ys) - Math.min(...ys)}
          fill="none"
          stroke={VIOLET}
          strokeWidth={1.5}
        />,
      );
    }
    points.forEach((p, i) =>
      out.push(
        <Rect
          key={`h${i}`}
          x={cx + p.x - size / 2}
          y={cy + p.y - size / 2}
          width={size}
          height={size}
          rx={size / 4.8}
          fill={tokens.colorCard}
          stroke={VIOLET}
          strokeWidth={2.4}
        />,
      ),
    );
  }
  return <>{out}</>;
}

function ChairShape({
  x,
  y,
  r,
  state,
  square,
  near,
}: {
  x: number;
  y: number;
  r: number;
  state: string;
  square: boolean;
  near: boolean;
}) {
  const sw = near ? 2 : 1.4;
  const shape = (fill: string, stroke: string) =>
    square ? (
      <Rect
        x={x - r}
        y={y - r}
        width={2 * r}
        height={2 * r}
        rx={r * 0.35}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
      />
    ) : (
      <Circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
    );
  if (state === 'taken') return shape(TAKEN_FILL, TAKEN_FILL);
  if (state === 'held')
    return (
      <>
        {shape(tokens.colorCard, TAKEN_FILL)}
        <Path d={`M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}Z`} fill={TAKEN_FILL} />
      </>
    );
  if (state === 'unusable') {
    const k = r * 0.45;
    return (
      <>
        {shape(OFF_FILL, OFF_EDGE)}
        <Path
          d={`M${x - k} ${y - k}L${x + k} ${y + k}M${x + k} ${y - k}L${x - k} ${y + k}`}
          stroke={tokens.colorInkSecondary}
          strokeWidth={near ? 2.4 : 1.4}
          strokeLinecap="round"
        />
      </>
    );
  }
  return shape(tokens.colorCard, EMPTY_EDGE);
}

function addWords(
  it: Item,
  cx: number,
  cy: number,
  s: number,
  floor: number,
  detail: Detail,
  labels: Label[],
) {
  const name = { key: `${it.id}.name`, size: 12, bold: true, ink: tokens.colorInk, words: it.name };
  if (detail === 'out') {
    const by = wordsAt(it, cy, s, floor);
    labels.push({ ...name, x: cx, y: by });
    if (it.kind !== 'single')
      labels.push({
        key: `${it.id}.of`,
        x: cx,
        y: by + 25,
        words: ofWords(it),
        size: 12,
        bold: false,
        ink: tokens.colorInkSecondary,
      });
    return;
  }
  if (it.kind === 'single') {
    labels.push({
      ...name,
      x: cx + CHAIR_R * s + 6,
      y: cy,
      ink: tokens.colorInkSecondary,
      start: true,
    });
    return;
  }
  if (it.kind === 'row') return;
  labels.push({ ...name, x: cx, y: nameAt(it, cy, s, floor) });
}

function Bars({ v, floor, items }: { v: Shown; floor: number; items: readonly Item[] }) {
  if (detailOf(v.s) !== 'out') return null;
  return (
    <>
      {items
        .filter((it) => it.kind !== 'single')
        .map((it) => {
          const cx = v.ox + it.x * v.s;
          const by = wordsAt(it, v.oy + it.y * v.s, v.s, floor) + 10;
          const share = filled(it) / Math.max(1, usable(it));
          return (
            <G key={`bar.${it.id}`}>
              <Rect x={cx - 22} y={by} width={44} height={5} rx={2.5} fill={SUNK} />
              <Rect
                x={cx - 22}
                y={by}
                width={44 * share}
                height={5}
                rx={2.5}
                fill={tokens.colorInkSecondary}
              />
            </G>
          );
        })}
    </>
  );
}

/** The room drawn to scale: a white floor with a 1 m grid (5 m a touch darker), walls 2.5 Ink, then each item, its words laid over it in the app's face. */
export function RoomDrawing({
  m,
  v,
  width,
  height,
  items,
  looks,
  grid = true,
  floor = true,
  children,
}: {
  m: Seating;
  v: Shown;
  width: number;
  height: number;
  items: readonly Item[];
  looks: Record<string, Look>;
  grid?: boolean;
  floor?: boolean;
  children?: ReactNode;
}) {
  const detail = detailOf(v.s);
  const labels: Label[] = [];
  const badges: Badge[] = [];
  const rw = m.room.w * v.s;
  const rl = m.room.l * v.s;
  const lines: ReactNode[] = [];
  if (grid && v.s * 100 >= 6) {
    for (let i = 1; i < m.room.w / 100; i += 1)
      lines.push(
        <Line
          key={`x${i}`}
          x1={v.ox + i * 100 * v.s}
          y1={v.oy}
          x2={v.ox + i * 100 * v.s}
          y2={v.oy + rl}
          stroke={i % 5 === 0 ? PROPOSED.roomGridFive : PROPOSED.roomGrid}
          strokeWidth={1}
        />,
      );
    for (let j = 1; j < m.room.l / 100; j += 1)
      lines.push(
        <Line
          key={`y${j}`}
          x1={v.ox}
          y1={v.oy + j * 100 * v.s}
          x2={v.ox + rw}
          y2={v.oy + j * 100 * v.s}
          stroke={j % 5 === 0 ? PROPOSED.roomGridFive : PROPOSED.roomGrid}
          strokeWidth={1}
        />,
      );
  }
  const shapes = items.map((it) => (
    <G key={it.id}>
      {itemShape({
        m,
        it,
        v,
        detail,
        look: looks[it.id] ?? {},
        chosenChair: m.chosen === it.id ? m.chair : null,
        labels,
        badges,
      })}
    </G>
  ));
  const taken = labels.map((l) => wordsBox(l.x, l.y, l.words, l.size, l.start === true));
  const pills = badges.map((b) => {
    const at = clearCorner(b.corners, BADGE_W, BADGE_H, taken);
    taken.push({ x: at.x, y: at.y, w: BADGE_W, h: BADGE_H });
    labels.push({
      key: b.key,
      x: at.x + BADGE_W / 2,
      y: at.y + BADGE_H / 2,
      words: b.words,
      size: 12,
      bold: true,
      ink: tokens.colorInkOnDark,
    });
    return (
      <Rect
        key={b.key}
        x={at.x}
        y={at.y}
        width={BADGE_W}
        height={BADGE_H}
        rx={BADGE_H / 2}
        fill={b.colour}
      />
    );
  });
  return (
    <>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} {...hidden}>
        {floor && <Rect x={v.ox} y={v.oy} width={rw} height={rl} fill={tokens.colorCard} />}
        {lines}
        {shapes}
        {pills}
        <Bars v={v} floor={v.oy + rl} items={items.filter((it) => looks[it.id]?.faint !== true)} />
        {m.wallAt != null && (
          <Line
            x1={v.ox + m.wallAt * v.s}
            y1={v.oy}
            x2={v.ox + m.wallAt * v.s}
            y2={v.oy + rl}
            stroke={tokens.colorBroken}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
        {floor && (
          <Rect
            x={v.ox}
            y={v.oy}
            width={rw}
            height={rl}
            fill="none"
            stroke={tokens.colorInk}
            strokeWidth={2.5}
          />
        )}
      </Svg>
      <View {...hidden} pointerEvents="none" style={StyleSheet.absoluteFill}>
        {labels.map((label) => (
          <View
            key={label.key}
            style={[
              styles.label,
              label.start === true
                ? { left: label.x, top: label.y - 10, alignItems: 'flex-start' }
                : { left: label.x - 80, top: label.y - 10 },
            ]}
          >
            <Text
              size={label.size}
              weight={label.bold ? 'bold' : 'medium'}
              allowFontScaling={false}
              numberOfLines={1}
              accessible={false}
              style={[{ color: label.ink }, styles.figures]}
            >
              {label.words}
            </Text>
          </View>
        ))}
      </View>
      {children}
    </>
  );
}

export function looksOf(
  m: Seating,
  hover: string | null,
  handles: number | null,
): Record<string, Look> {
  const looks: Record<string, Look> = {};
  const add = (id: string, look: Look) => (looks[id] = { ...looks[id], ...look });
  m.lit.forEach((id) => add(id, { lit: true }));
  if (hover != null) add(hover, { lit: true });
  if (m.chosen != null)
    add(m.chosen, {
      lit: true,
      ...(handles != null && handlesLive(m) ? { handles } : {}),
    });
  Object.entries(m.rings).forEach(([id, person]) => !person.viewer && add(id, { ring: person }));
  m.outside.forEach((id) => add(id, { overlap: true }));
  const chosen = itemOf(m, m.chosen);
  if (chosen != null) {
    const over = overlapping(
      chosen,
      m.items.filter((it) => !it.id.startsWith('ghost-')),
    );
    if (over.length > 0) [chosen, ...over].forEach((it) => add(it.id, { overlap: true }));
  }
  if (m.ghost != null) add(`ghost-${m.ghost.id}`, { faint: true });
  return looks;
}

type Gesture =
  | { kind: 'pan'; view: Shown; start: Point }
  | { kind: 'move'; id: string; from: Point; start: Point }
  | { kind: 'resize'; id: string; handle: number }
  | {
      kind: 'pinch';
      view: Shown;
      d0: number;
      a0: number;
      mid: Point;
      id: string | null;
      rot0: number;
    };

interface Live {
  view?: Shown;
  item?: Item;
  tip?: { words: string; at: Point };
  ghost?: Item;
}

function sizeOf(m: Seating, cm: number): string {
  return m.units === 'us' ? length(m, cm) : `${cm} cm`;
}

/** The finger's part of the room, made once: it reads the latest plan the screen hands it, never during a render. */
function roomGestures(dispatch: (action: Action) => void, show: (live: Live | null) => void) {
  let m: Seating | null = null;
  let origin: Point = { x: 0, y: 0 };
  let gesture: Gesture | null = null;
  let live: Live | null = null;
  const setLive = (next: Live | null) => {
    live = next;
    show(next);
  };
  const local = (e: GestureResponderEvent): Point => ({
    x: e.nativeEvent.pageX - origin.x,
    y: e.nativeEvent.pageY - origin.y,
  });
  const touches = (e: GestureResponderEvent) => e.nativeEvent.touches;
  const twoOf = (e: GestureResponderEvent) => {
    const [a, b] = touches(e);
    if (a == null || b == null) return null;
    return {
      d: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
      a: Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX),
      mid: { x: (a.pageX + b.pageX) / 2 - origin.x, y: (a.pageY + b.pageY) / 2 - origin.y },
    };
  };
  const handleAt = (p: Point): number | null => {
    const it = m == null ? null : itemOf(m, m.chosen);
    const view = m?.shown;
    if (m == null || it == null || view == null || !handlesLive(m)) return null;
    if (!hasHandles(it)) return null;
    const cx = view.ox + it.x * view.s;
    const cy = view.oy + it.y * view.s;
    const i = handlePoints(it, view.s, m).findIndex(
      (h) =>
        Math.abs(cx + h.x - p.x) <= HANDLE_HIT / 2 && Math.abs(cy + h.y - p.y) <= HANDLE_HIT / 2,
    );
    return i < 0 ? null : i;
  };
  const toRoom = (p: Point, view: Shown): Point => ({
    x: (p.x - view.ox) / view.s,
    y: (p.y - view.oy) / view.s,
  });
  const begin = (e: GestureResponderEvent) => {
    const view = live?.view ?? m?.shown;
    if (m == null || view == null) return;
    const two = twoOf(e);
    if (two != null) {
      const chosen = itemOf(m, m.chosen);
      const turns =
        chosen != null && (chosen.kind === 'rect' || chosen.kind === 'head') && arrangeable(m);
      gesture = {
        kind: 'pinch',
        view,
        d0: two.d,
        a0: two.a,
        mid: two.mid,
        id: turns ? chosen.id : null,
        rot0: chosen?.rot ?? 0,
      };
      return;
    }
    const p = local(e);
    const handle = handleAt(p);
    if (handle != null && m.chosen != null) {
      gesture = { kind: 'resize', id: m.chosen, handle };
      return;
    }
    const it = itemAt(m.items, toRoom(p, view), 22 / view.s);
    gesture =
      it != null && arrangeable(m)
        ? { kind: 'move', id: it.id, from: { x: it.x, y: it.y }, start: p }
        : { kind: 'pan', view, start: p };
  };
  const move = (e: GestureResponderEvent, g: PanResponderGestureState) => {
    const two = twoOf(e);
    if (two != null && gesture?.kind !== 'pinch') begin(e);
    const cur = gesture;
    const mm = m;
    if (cur == null || mm?.shown == null) return;
    if (cur.kind === 'pinch') {
      if (two == null) return;
      const turned = ((two.a - cur.a0) * 180) / Math.PI;
      const it = cur.id == null ? null : itemOf(mm, cur.id);
      if (it != null && Math.abs(turned) > 10 && Math.abs(two.d / cur.d0 - 1) < 0.15) {
        setLive({ item: { ...it, rot: Math.round((cur.rot0 + turned) / 15) * 15 } });
        return;
      }
      setLive({ view: zoomAbout(cur.view, two.d / cur.d0, cur.mid.x, cur.mid.y) });
      return;
    }
    if (cur.kind === 'pan') {
      setLive({ view: { ...cur.view, ox: cur.view.ox + g.dx, oy: cur.view.oy + g.dy } });
      return;
    }
    const it = itemOf(mm, cur.id);
    if (it == null) return;
    const s = mm.shown.s;
    if (cur.kind === 'move') {
      const raw = {
        ...it,
        x: snapped(cur.from.x + g.dx / s, mm.snap),
        y: snapped(cur.from.y + g.dy / s, mm.snap),
      };
      const held = { ...raw, ...heldInside(raw, mm.room) };
      setLive({
        item: held,
        ghost: { ...it, id: `ghost-${it.id}` },
        tip: {
          words: say.where(length(mm, held.x), length(mm, held.y)),
          at: { x: held.x, y: held.y },
        },
      });
      return;
    }
    const p = local(e);
    const lp = turn(
      { x: p.x - (mm.shown.ox + it.x * s), y: p.y - (mm.shown.oy + it.y * s) },
      -it.rot,
    );
    const reach = reachOf(it, s, handlePoints(it, s, mm)[cur.handle] ?? { x: 0, y: 0 });
    const round = it.kind === 'round' || it.kind === 'cocktail';
    const next = round
      ? {
          ...it,
          d: sideFrom(Math.max(Math.abs(lp.x), Math.abs(lp.y)), Math.max(reach.x, reach.y), s),
        }
      : {
          ...it,
          w: cur.handle % 4 === 1 ? it.w : sideFrom(lp.x, reach.x, s),
          l: cur.handle % 4 === 3 ? it.l : sideFrom(lp.y, reach.y, s),
        };
    const across = round ? next.d : next.w;
    setLive({
      item: next,
      tip: { words: say.widthTip(sizeOf(mm, across)), at: { x: it.x + across / 2, y: it.y } },
    });
  };
  const end = (_: GestureResponderEvent, g: PanResponderGestureState) => {
    const cur = gesture;
    const shown = live;
    gesture = null;
    setLive(null);
    if (cur == null) return;
    if (cur.kind === 'pan') {
      if (Math.hypot(g.dx, g.dy) < 8)
        dispatch({ type: 'tapFloor', at: toRoom(cur.start, cur.view) });
      else if (shown?.view != null) dispatch({ type: 'view', view: shown.view });
    } else if (cur.kind === 'pinch') {
      if (shown?.view != null) dispatch({ type: 'view', view: shown.view });
      if (shown?.item != null) dispatch({ type: 'turned', id: shown.item.id, rot: shown.item.rot });
    } else if (shown?.item != null) {
      const it = shown.item;
      if (cur.kind === 'move') dispatch({ type: 'moved', id: it.id, at: { x: it.x, y: it.y } });
      else dispatch({ type: 'resized', id: it.id, d: it.d, w: it.w, l: it.l });
    }
  };
  const { panHandlers } = PanResponder.create({
    onStartShouldSetPanResponderCapture: (e) =>
      touches(e).length >= 2 || handleAt(local(e)) != null,
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: (e, g) =>
      touches(e).length >= 2 || Math.hypot(g.dx, g.dy) > 8,
    onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 8,
    onPanResponderGrant: begin,
    onPanResponderMove: move,
    onPanResponderRelease: end,
    onPanResponderTerminate: end,
    onPanResponderTerminationRequest: () => false,
  });
  return {
    panHandlers,
    sync: (next: Seating) => {
      m = next;
    },
    place: (at: Point) => {
      origin = at;
    },
  };
}

/** The iPad's room by finger (sc-5033): a tap chooses or seats, a drag moves and snaps, a handle resizes, two fingers zoom or turn. */
export function RoomSurface({
  m,
  dispatch,
  width,
  height,
  viewsEnd = 0,
  printStart = 0,
  caption: drawCaption = true,
}: {
  m: Seating;
  dispatch: (action: Action) => void;
  width: number;
  height: number;
  viewsEnd?: number;
  printStart?: number;
  caption?: boolean;
}) {
  const box = useRef<ViewInstance>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [gestures] = useState(() => roomGestures(dispatch, setLive));
  useEffect(() => gestures.sync(m), [gestures, m]);
  const measure = () => box.current?.measureInWindow((x, y) => gestures.place({ x, y }));
  const v = live?.view ?? m.shown;

  if (v == null) return <View ref={box} style={styles.fill} onLayout={measure} />;
  const shown = live?.item;
  const ghost = live?.ghost ?? (m.ghost == null ? null : { ...m.ghost, id: `ghost-${m.ghost.id}` });
  const items = [
    ...(ghost == null ? [] : [ghost]),
    ...m.items.map((it) => (shown != null && it.id === shown.id ? shown : it)),
  ];
  const looks = looksOf({ ...m, items }, hover, HANDLE_DRAWN);
  if (ghost != null) looks[ghost.id] = { faint: true };
  const tip = live?.tip ?? m.tip;
  const detail = detailOf(v.s);
  const beside = viewsEnd > 0 && v.oy - 26 < VIEWS_BAND + 4 && v.ox < viewsEnd + tokens.spaceMd;
  const caption = beside
    ? {
        left: viewsEnd + tokens.spaceMd,
        top: tokens.spaceXl + 14,
        maxWidth: (printStart > 0 ? printStart : width) - viewsEnd - 2 * tokens.spaceMd,
      }
    : { left: v.ox, top: v.oy - 26 };
  return (
    <View ref={box} style={styles.fill} onLayout={measure} {...gestures.panHandlers}>
      <RoomDrawing m={m} v={v} width={width} height={height} items={items} looks={looks}>
        {drawCaption && (
          <Text
            size={12.5}
            weight="semibold"
            accessibilityRole="header"
            accessibilityLabel={say.roomLabel(
              m.room.name,
              length(m, m.room.w),
              length(m, m.room.l),
            )}
            numberOfLines={1}
            style={[styles.roomLine, caption]}
          >
            {roomLine(m)}
          </Text>
        )}
        {m.items.map((it) => {
          const b = bounds(it);
          const w = Math.max(48, 2 * b.x * v.s);
          const h = Math.max(48, 2 * b.y * v.s);
          return (
            <Pressable
              key={it.id}
              onPress={() => dispatch({ type: 'tapItem', id: it.id })}
              onPressIn={() => m.picked != null && setHover(it.id)}
              onPressOut={() => setHover(null)}
              style={[
                styles.hit,
                {
                  left: v.ox + it.x * v.s - w / 2,
                  top: v.oy + it.y * v.s - h / 2,
                  width: w,
                  height: h,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: m.chosen === it.id }}
              accessibilityLabel={accName(m, it)}
              testID={`seating.item.${it.id}`}
            />
          );
        })}
        {detail === 'near' &&
          m.items.flatMap((it) =>
            chairPoints(it).map((p0, i) => {
              const p = turn(p0, it.rot);
              return (
                <Pressable
                  key={`${it.id}.${i}`}
                  onPress={() => dispatch({ type: 'tapChair', id: it.id, chair: i })}
                  style={[
                    styles.hit,
                    styles.chair,
                    {
                      left: v.ox + (it.x + p.x) * v.s - CHAIR_HIT / 2,
                      top: v.oy + (it.y + p.y) * v.s - CHAIR_HIT / 2,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.name}, ${say.chairName(i + 1, chairWord(it, i))}`}
                  testID={`seating.chair.${it.id}.${i}`}
                />
              );
            }),
          )}
        {tip != null && (
          <View
            pointerEvents="none"
            {...hidden}
            style={[
              styles.tip,
              { left: v.ox + tip.at.x * v.s + 26, top: v.oy + tip.at.y * v.s + 30 },
            ]}
          >
            <Text
              size={13}
              weight="semibold"
              accessible={false}
              style={[styles.tipText, styles.figures]}
            >
              {tip.words}
            </Text>
          </View>
        )}
      </RoomDrawing>
    </View>
  );
}

/** The small map at 200% and up: the whole room, the view's rectangle in Violet. */
export function MiniMap({
  m,
  v,
  width,
  height,
}: {
  m: Seating;
  v: Shown;
  width: number;
  height: number;
}) {
  const s = Math.min(160 / m.room.w, 120 / m.room.l);
  const map = { s, ox: 0, oy: 0 };
  return (
    <View {...hidden} style={styles.minimap}>
      <Svg width={m.room.w * s} height={m.room.l * s}>
        <Rect x={0} y={0} width={m.room.w * s} height={m.room.l * s} fill={tokens.colorCard} />
        {m.items.map((it) => (
          <G key={it.id}>
            {itemShape({
              m,
              it,
              v: map,
              detail: 'out',
              look: {},
              chosenChair: null,
              labels: [],
              badges: [],
            })}
          </G>
        ))}
        <Rect
          x={0.75}
          y={0.75}
          width={m.room.w * s - 1.5}
          height={m.room.l * s - 1.5}
          fill="none"
          stroke={tokens.colorInk}
          strokeWidth={1.5}
        />
        <Rect
          x={(-v.ox / v.s) * s}
          y={(-v.oy / v.s) * s}
          width={(width / v.s) * s}
          height={(height / v.s) * s}
          fill={VIOLET}
          fillOpacity={0.12}
          stroke={VIOLET}
          strokeWidth={2}
        />
      </Svg>
    </View>
  );
}

/** The iPhone's room card: the zoomed-out drawing to find a table, one labelled image to a screen reader (sc-4027). */
export function RoomCard({ m, lit }: { m: Seating; lit: readonly string[] }) {
  const [width, setWidth] = useState(362);
  const inner = width - 16;
  const s = (inner - 12) / m.room.w;
  const height = Math.round(m.room.l * s) + 12;
  const looks: Record<string, Look> = {};
  lit.forEach((id) => (looks[id] = { lit: true }));
  const freeTables = m.items.filter((it) => lit.includes(it.id)).map((it) => it.name);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${say.roomLabel(m.room.name, length(m, m.room.w), length(m, m.room.l))}${freeTables.length > 0 ? `. ${freeTables.join(', ')}` : ''}`}
      style={styles.card}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
    >
      <View style={{ width: inner, height }}>
        <RoomDrawing
          m={m}
          v={{ s, ox: 6, oy: 6 }}
          width={inner}
          height={height}
          items={m.items}
          looks={looks}
          grid={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  label: {
    position: 'absolute',
    width: 160,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figures: { fontVariant: ['tabular-nums'] },
  roomLine: { position: 'absolute', color: tokens.colorInkSecondary },
  hit: { position: 'absolute' },
  chair: { width: CHAIR_HIT, height: CHAIR_HIT, borderRadius: CHAIR_HIT / 2 },
  tip: {
    position: 'absolute',
    paddingHorizontal: tokens.spaceMd,
    paddingVertical: tokens.spaceXs,
    borderRadius: tokens.spaceMd,
    backgroundColor: tokens.colorInk,
  },
  tipText: { color: tokens.colorInkOnDark },
  minimap: {
    padding: tokens.spaceXs,
    borderRadius: 14,
    backgroundColor: tokens.colorCard,
    ...tokens.elevationNative.raised.ios,
    elevation: 4,
  },
  card: {
    padding: tokens.spaceSm,
    borderRadius: tokens.spaceXxl,
    backgroundColor: tokens.colorInset,
    overflow: 'hidden',
  },
});
