import type { Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { OrgMark } from './OrgMark.tsx';
import { Text } from './Text.tsx';

export const OPENER = { rest: tokens.sizeHit, waiting: 56 } as const;

/** The opener's words: the name, and under it a ring and how many invitations wait. */
export function OpenerWords({
  name,
  waiting,
  onDark = false,
  grow = false,
  wrap = false,
}: {
  name: string;
  /** How many invitations wait, in words, or null when none do. */
  waiting: string | null;
  onDark?: boolean;
  grow?: boolean;
  wrap?: boolean;
}) {
  const ink = { color: onDark ? tokens.colorInkOnDark : tokens.colorInk };

  return (
    <View style={[styles.words, grow && styles.grow]}>
      <Text
        size={15}
        weight="semibold"
        numberOfLines={wrap ? undefined : 1}
        accessible={false}
        style={[styles.name, ink]}
      >
        {name}
      </Text>
      {waiting != null && (
        <View style={styles.waitingLine}>
          <View
            style={[
              styles.waitingRing,
              { borderColor: onDark ? tokens.colorInkOnDark : tokens.colorInk },
            ]}
          />
          <Text size={12.5} weight="semibold" accessible={false} style={[styles.waitingWords, ink]}>
            {waiting}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The organisation switcher on white, at the top of every top-level page; without `onPress` it only names the organisation. */
export function OrgPill({
  id,
  name,
  waiting,
  label,
  expanded,
  onPress,
  bare = false,
  wrap = false,
  testID,
  ref,
}: {
  id: string;
  name: string;
  waiting: string | null;
  label: string;
  expanded?: boolean;
  onPress?: (() => void) | undefined;
  /** At the largest text sizes the tile gives its room to the name. */
  bare?: boolean;
  wrap?: boolean;
  testID?: string;
  ref?: Ref<ViewInstance> | undefined;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={onPress == null}
      style={({ pressed }) => [
        styles.org,
        (waiting != null || wrap) && styles.orgWaiting,
        pressed && styles.orgPressed,
      ]}
      accessibilityRole={onPress == null ? 'text' : 'button'}
      accessibilityLabel={label}
      accessibilityState={onPress == null || expanded == null ? undefined : { expanded }}
      testID={testID}
    >
      {!bare && <OrgMark id={id} name={name} side={28} />}
      <OpenerWords name={name} waiting={waiting} wrap={wrap} />
      {onPress != null && <Glyph name="updown" size={14} ink={tokens.colorInkSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  name: { lineHeight: 15 * 1.25 },
  waitingLine: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  waitingRing: { width: 11, height: 11, borderRadius: 5.5, borderWidth: 2 },
  waitingWords: { lineHeight: 12.5 * 1.3 },
  org: {
    minHeight: OPENER.rest,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingLeft: tokens.spaceSm,
    paddingRight: tokens.spacePillEnd,
    borderRadius: OPENER.rest / 2,
    backgroundColor: tokens.colorInset,
  },
  orgWaiting: { minHeight: OPENER.waiting, borderRadius: OPENER.waiting / 2 },
  orgPressed: { backgroundColor: tokens.colorNeutralFill },
});
