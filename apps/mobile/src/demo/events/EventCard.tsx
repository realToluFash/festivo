import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { CARD_PIECES, Confetti, EventMesh, eventColour } from '../Cover.tsx';
import { Glyph } from '../Glyph.tsx';
import type { EventKey } from '../today.ts';
import { CardSays, GlassTag, OnCard, StepButton, SummaryCard } from '../settings/Summary.tsx';
import {
  type CardStep,
  type Shown,
  cardStep,
  cardTags,
  dayTiles,
  rowLine,
  scrimFor,
} from './EventsModel.ts';
import type { MeshKey } from './EventsSample.ts';
import { W } from './EventsWords.ts';

/** Today's meshes, by the colour main's meshFor gives an event's id. */
export const MESH_EVENT: Record<MeshKey, EventKey> = {
  rose: 'wed',
  teal: 'ireti',
  accent: 'party',
  amber: 'draft',
};

// The step's line runs wider than Settings' words: the piece under it goes.
const PIECES = CARD_PIECES.filter(([x, y]) => x > 0.65 || y < 0.5);

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
        <EventMesh event={MESH_EVENT[event.mesh]} />
      )}
    </View>
  );
}

/** Under the card's words: the cover or the colour, a scrim measured so white keeps 4.5:1, and Confetti on the colour. */
function CardBackdrop({ event, wide }: { event: Shown; wide: boolean }) {
  const scrim = scrimFor(eventColour(MESH_EVENT[event.mesh]), event.photo, tokens.colorInk);
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
        <EventMesh event={MESH_EVENT[event.mesh]} />
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
      {!event.photo && <Confetti pieces={PIECES} scale={wide ? 1.3 : 1} />}
    </>
  );
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
  testID,
}: {
  event: Shown;
  now: Date;
  locale: string;
  wide: boolean;
  height?: number;
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
      backdrop={<CardBackdrop event={event} wide={wide} />}
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
          <GlassTag key={tag.word} word={tag.word} mark={tag.mark} />
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
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
  tileDay: { lineHeight: 22, letterSpacing: 20 * -0.02, fontVariant: ['tabular-nums'] },
  foot: { marginTop: 'auto', gap: tokens.spaceSm },
  next: { lineHeight: Math.round(15.5 * 1.35) },
});
