import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Confetti, type Piece } from '../../components/Cover.tsx';
import { EventMesh, eventColour } from '../../components/EventMesh.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { useShell } from '../settings/Frame.tsx';
import { CardSays, GlassTag, OnCard, StepButton, SummaryCard } from '../settings/Summary.tsx';
import {
  type CardStep,
  type PhaseMark,
  type Shown,
  cardStep,
  cardTags,
  dayTiles,
  rowLine,
  scrimFor,
} from './EventsModel.ts';
import { W } from './EventsWords.ts';

type Layout = ReturnType<typeof useShell>['layout'];

/** The pieces as each layout's board places them, in points from the card's top right, by share of a box that wide and 200 tall. */
function pieces(width: number, placed: readonly Piece[]) {
  return {
    width,
    pieces: placed.map(([x, y, shape, size, turn, tone]): Piece => [
      x / width,
      y / 200,
      shape,
      size,
      turn,
      tone,
    ]),
  };
}

const PIECES: Record<Layout, { width: number; pieces: readonly Piece[] }> = {
  phone: pieces(350, [
    [236, 8, 'half', 22, -18, 'sun'],
    [290, 16, 'bar', 26, 24, 'white'],
    [336, 30, 'half', 14, 200, 'rose'],
    [282, 108, 'half', 20, 32, 'rose'],
    [322, 122, 'bar', 24, -40, 'sun'],
    [340, 104, 'bar', 14, -60, 'white'],
  ]),
  portrait: pieces(770, [
    [420, 24, 'half', 30, -18, 'sun'],
    [500, 128, 'bar', 34, 24, 'white'],
    [560, 34, 'half', 18, 200, 'rose'],
    [620, 104, 'half', 28, 32, 'rose'],
    [680, 26, 'bar', 30, -40, 'sun'],
    [440, 150, 'half', 16, 150, 'rose'],
    [740, 142, 'bar', 22, 62, 'white'],
    [600, 160, 'bar', 18, -30, 'sun'],
    [380, 70, 'bar', 20, 62, 'white'],
  ]),
  landscape: pieces(512, [
    [330, 16, 'half', 24, -18, 'sun'],
    [420, 30, 'bar', 28, 24, 'white'],
    [486, 92, 'half', 16, 200, 'rose'],
    [396, 118, 'half', 22, 32, 'rose'],
    [466, 150, 'bar', 22, -40, 'sun'],
    [300, 150, 'bar', 16, 62, 'white'],
  ]),
};

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** A gradient over the whole box: a wrapper fills it, since a percentage on an absolute Svg leaves out the padding. */
function Fill({
  id,
  down,
  stops,
}: {
  id: string;
  down: boolean;
  stops: readonly { at: string; colour: string; opacity?: number }[];
}) {
  return (
    <View style={StyleSheet.absoluteFill} {...hidden}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={down ? '0' : '1'} y2="1">
            {stops.map((stop) => (
              <Stop
                key={stop.at}
                offset={stop.at}
                stopColor={stop.colour}
                stopOpacity={stop.opacity ?? 1}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function PhotoFill({ id }: { id: string }) {
  return (
    <Fill
      id={id}
      down={false}
      stops={[
        { at: '0', colour: tokens.colorInkTertiary },
        { at: '0.5', colour: tokens.colorInkSecondary },
        { at: '1', colour: tokens.colorDarkInset },
      ]}
    />
  );
}

/** An event's lead: its photo, or the colour its id gives it. */
export function EventThumb({
  event,
  side = 48,
  radius = 14,
}: {
  event: Pick<Shown, 'id' | 'mesh' | 'photo'>;
  side?: number;
  radius?: number;
}) {
  return (
    <View style={[styles.thumb, { width: side, height: side, borderRadius: radius }]} {...hidden}>
      {event.photo ? (
        <>
          <PhotoFill id={`thumb-${event.id}-${side}`} />
          <Glyph
            name="photo"
            size={Math.round(side * 0.5)}
            ink={tokens.colorInkOnDark}
            weight={1.8}
          />
        </>
      ) : (
        <EventMesh event={{ mesh: event.mesh, photo: null }} />
      )}
    </View>
  );
}

export function CardPieces() {
  const placed = PIECES[useShell().layout];

  return (
    <View style={[styles.pieces, { width: placed.width }]} {...hidden}>
      <Confetti pieces={placed.pieces} />
    </View>
  );
}

/** Under the card's words: the cover or the colour, a scrim measured so white keeps 4.5:1, and Confetti on the colour. */
export function CardBackdrop({ event }: { event: Shown }) {
  const scrim = scrimFor(eventColour(event), event.photo, tokens.colorInk);
  const id = `scrim-${event.id}`;

  return (
    <>
      {event.photo ? (
        <>
          <PhotoFill id={`photo-${event.id}`} />
          <View style={styles.photoMark} {...hidden}>
            <Glyph name="photo" size={64} ink={tokens.colorInkOnDark} weight={1.6} />
          </View>
        </>
      ) : (
        <EventMesh event={{ mesh: event.mesh, photo: null }} />
      )}
      <Fill
        id={id}
        down
        stops={[
          { at: '0', colour: scrim.ink, opacity: scrim.top },
          { at: '0.45', colour: scrim.ink, opacity: scrim.middle },
          { at: '1', colour: scrim.ink, opacity: scrim.foot },
        ]}
      />
      {!event.photo && <CardPieces />}
    </>
  );
}

export function PhaseShape({ mark }: { mark: PhaseMark }) {
  switch (mark) {
    case 'draft':
      return <View style={styles.draftRing} {...hidden} />;
    case 'live':
      return <View style={styles.dot} {...hidden} />;
    case 'now':
      return (
        <View style={styles.dotBox} {...hidden}>
          <View style={styles.halo} />
          <View style={[StyleSheet.absoluteFill, styles.dot]} />
        </View>
      );
    case 'paused':
      return (
        <View style={styles.bars} {...hidden}>
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
      );
    case 'finished':
      return <Glyph name="tick" size={14} ink={tokens.colorInkOnDark} weight={2.8} />;
    case 'calledOff':
      return <Glyph name="x" size={14} ink={tokens.colorInkOnDark} weight={2.8} />;
  }
}

function DayTiles({ event, now, locale }: { event: Shown; now: Date; locale: string }) {
  const tiles = dayTiles(event, now, locale);

  if (tiles == null) return null;

  return (
    <View style={styles.tiles} pointerEvents="none" accessibilityRole="list">
      {tiles.map((tile) => (
        <View
          key={`${tile.weekday}${tile.day}`}
          style={[styles.tile, tile.today && styles.tileToday]}
          accessible
          accessibilityLabel={
            tile.today ? `${W.today}, ${tile.day}` : `${tile.weekday} ${tile.day}`
          }
        >
          {!tile.today && <View style={[StyleSheet.absoluteFill, styles.tileGlass]} />}
          <Text
            size={12}
            weight="bold"
            accessible={false}
            style={[styles.tileWeekday, tile.today ? styles.accent : styles.white]}
          >
            {tile.today ? W.today : tile.weekday}
          </Text>
          <Text
            size={20}
            weight="bold"
            accessible={false}
            style={[styles.tileDay, tile.today ? styles.accent : styles.white]}
          >
            {tile.day}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CardFoot({
  step,
  onStep,
  testID,
}: {
  step: CardStep;
  onStep: (step: Extract<CardStep, { kind: 'button' }>) => void;
  testID: string;
}) {
  if (step.kind === 'next')
    return (
      <View
        style={styles.foot}
        pointerEvents="none"
        accessible
        accessibilityLabel={`${step.title}. ${step.when}`}
      >
        <Text size={15.5} weight="bold" accessible={false} style={[styles.white, styles.next]}>
          {step.title}
        </Text>
        <OnCard text={step.when} />
      </View>
    );

  return (
    <View style={styles.foot} pointerEvents="box-none">
      <View pointerEvents="none">
        <OnCard text={step.line} />
      </View>
      <StepButton label={step.label} onPress={() => onStep(step)} testID={`${testID}.step`} />
    </View>
  );
}

/** The cover summary card, the list's and the page's: phase and how soon on glass, the name, its days and place, a tile a day, one step. */
export function EventCard({
  event,
  now,
  locale,
  wide,
  height = 200,
  onOpen,
  onStep,
  guests = null,
  testID,
}: {
  event: Shown;
  now: Date;
  locale: string;
  wide: boolean;
  height?: number;
  /** On Events, the guests it counts (sc-3786): "96 coming · 25 haven't replied". */
  guests?: string | null;
  /** On the list the card opens the event, its name the link. */
  onOpen?: () => void;
  onStep: (step: Extract<CardStep, { kind: 'button' }>) => void;
  testID: string;
}) {
  const name = <CardSays text={event.name} heading={onOpen == null} />;

  return (
    <SummaryCard
      size={wide ? 'wide' : 'page'}
      height={height}
      backdrop={<CardBackdrop event={event} />}
      testID={testID}
    >
      {onOpen != null && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onOpen}
          accessible={false}
          importantForAccessibility="no"
        />
      )}
      <View style={styles.tags} pointerEvents="none">
        {cardTags(event, now).map((tag) => (
          <GlassTag
            key={tag.word}
            word={tag.word}
            shape={tag.mark == null ? undefined : <PhaseShape mark={tag.mark} />}
          />
        ))}
      </View>
      {onOpen == null ? (
        name
      ) : (
        <Pressable
          onPress={onOpen}
          accessibilityRole="link"
          accessibilityLabel={event.name}
          testID={`${testID}.open`}
        >
          {name}
        </Pressable>
      )}
      <View pointerEvents="none">
        <OnCard text={rowLine(event, locale, false)} />
        {guests != null && <OnCard text={guests} />}
      </View>
      <DayTiles event={event} now={now} locale={locale} />
      <CardFoot step={cardStep(event, now, locale)} onStep={onStep} testID={testID} />
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  white: { color: tokens.colorInkOnDark },
  accent: { color: tokens.colorAccent },
  thumb: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoMark: { position: 'absolute', right: 22, top: 18, opacity: 0.5 },
  pieces: { position: 'absolute', top: 0, right: 0, height: 200 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: tokens.colorInkOnDark },
  dotBox: { width: 9, height: 9 },
  halo: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: tokens.colorBroken,
    opacity: 0.22,
  },
  draftRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkOnDark,
  },
  bars: { flexDirection: 'row', gap: tokens.spaceHair },
  bar: { width: 3, height: 10, borderRadius: 1, backgroundColor: tokens.colorInkOnDark },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  tile: {
    width: 58,
    height: 58,
    borderRadius: tokens.spaceXl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceHair,
  },
  tileGlass: { backgroundColor: tokens.colorInkOnDark, opacity: 0.22 },
  tileToday: { backgroundColor: tokens.colorCard },
  tileWeekday: { textTransform: 'uppercase', letterSpacing: 12 * 0.04 },
  tileDay: { lineHeight: 20, letterSpacing: 20 * -0.02, fontVariant: ['tabular-nums'] },
  foot: { marginTop: 'auto', gap: tokens.spaceSm },
  next: { lineHeight: Math.round(15.5 * 1.35) },
});
