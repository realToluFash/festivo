import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { meshFor, type MeshKey } from '../kit/today.ts';
import { scrimFor } from '../kit/scrim.ts';
import { glide } from '../motion.ts';
import { tokens } from '../theme/tokens.ts';
import { DraftTile } from './DraftTile.tsx';
import { EventMesh, eventColour } from './EventMesh.tsx';
import { Initials } from './Initials.tsx';
import { SETTLED_MS } from './Screen.tsx';

interface Wash {
  cover: MeshKey;
  ink: string;
  strength: number;
}

const washes = new Map<string, Wash>();

function washOf(id: string): Wash {
  const known = washes.get(id);
  if (known != null) return known;

  const cover = meshFor(id);
  const scrim = scrimFor(eventColour({ mesh: cover }), false, tokens.colorInk);
  const wash = { cover, ink: scrim.ink, strength: scrim.middle };
  washes.set(id, wash);

  return wash;
}

const arrival = { id: '', at: 0 };
const ARRIVE_MS = 300;
const ARRIVING_MS = SETTLED_MS * 4;

/** A new organisation has its id: each of its tiles drawn soon after crossfades from the draft to its colour. */
export function arrive(id: string): void {
  arrival.id = id;
  arrival.at = Date.now();
}

/** An organisation's tile in its own colour: its B cover under a wash that keeps white initials at 4.5:1. */
export function OrgMark({
  id,
  name,
  side,
  glass = false,
}: {
  id: string;
  name: string;
  side: number;
  glass?: boolean;
}) {
  const wash = washOf(id);
  const big = side >= 40;

  return (
    <View
      style={[
        styles.mark,
        { width: side, height: side, borderRadius: Math.round(side / 3) },
        glass && styles.markGlass,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!glass && <Washed wash={wash} />}
      <Initials
        name={name}
        size={big ? Math.floor(side * 0.42) : 12}
        weight="bold"
        style={{ color: glass ? wash.ink : tokens.colorInkOnDark }}
      />
      <Arrival key={id} id={id} name={name} side={side} big={big} />
    </View>
  );
}

/** Not motion, so Reduce Motion keeps it. */
function Arrival({
  id,
  name,
  side,
  big,
}: {
  id: string;
  name: string;
  side: number;
  big: boolean;
}) {
  const [draft] = useState(() =>
    arrival.id === id && Date.now() - arrival.at < ARRIVING_MS ? new Animated.Value(1) : null,
  );

  useEffect(() => {
    if (draft == null) return;
    const wait = setTimeout(
      () => glide(draft, 0, ARRIVE_MS).start(),
      Math.max(0, arrival.at + SETTLED_MS - Date.now()),
    );

    return () => clearTimeout(wait);
  }, [draft]);

  if (draft == null) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: draft }]} pointerEvents="none">
      <DraftTile
        name={name}
        side={side}
        radius={Math.round(side / 3)}
        initials={big ? Math.floor(side * 0.42) : 12}
      />
    </Animated.View>
  );
}

function Washed({ wash }: { wash: Wash }) {
  return (
    <>
      <EventMesh event={{ mesh: wash.cover, photo: null }} />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: wash.ink, opacity: wash.strength }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  markGlass: { backgroundColor: tokens.colorInkOnDark },
});
