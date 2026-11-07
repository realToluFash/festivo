import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { meshFor, type MeshKey } from '../kit/today.ts';
import { scrimFor } from '../kit/scrim.ts';
import { tokens } from '../theme/tokens.ts';
import { EventMesh, eventColour } from './EventMesh.tsx';
import { Initials } from './Initials.tsx';

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

/** An organisation's tile in its own colour: its B cover under a wash that keeps white initials at 4.5:1. */
export function OrgMark({
  id,
  name,
  side,
  glass = false,
  children,
}: {
  id: string;
  name: string;
  side: number;
  glass?: boolean;
  /** Drawn over the tile, as the demo's walk crossfades a new organisation in. */
  children?: ReactNode;
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
      {children}
    </View>
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
