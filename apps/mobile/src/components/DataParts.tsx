import type { ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { TagWord } from '../kit/emailDomains.ts';
import { useAccessibilitySizes } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Glyph } from './Glyph.tsx';
import { Back } from './SettingsParts.tsx';
import { ShapeMark, Tag } from './Summary.tsx';
import { Text, TitleCap } from './Text.tsx';
import { Title, useTitleCap } from './Title.tsx';
import { PANE_TITLE, paneTitle } from './topTitle.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export type LockTag = { kind: 'lock'; word: string };

const DRAWN = {
  history: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  data: [
    'M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3-3.58-3-8-3-8 1.34-8 3',
    'M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6',
    'M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3',
  ],
} as const;

/** Glyphs the product's set has not got, drawn here as the boards draw them. */
export function DrawnGlyph({
  name,
  size,
  ink,
  weight = 2,
}: {
  name: keyof typeof DRAWN;
  size: number;
  ink: string;
  weight?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hidden}
    >
      {DRAWN[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

export function DataTile({ side }: { side: number }) {
  return (
    <View
      style={[styles.tile, { width: side, height: side, borderRadius: Math.round(side * 0.3) }]}
      {...hidden}
    >
      <DrawnGlyph
        name="data"
        size={Math.round(side * 0.52)}
        ink={tokens.colorInkOnDark}
        weight={2.1}
      />
    </View>
  );
}

/** A state tag the product's Tag has no shape for: Not proved's cross, and the Enterprise lock. */
export function DataTag({ tag }: { tag: TagWord | LockTag }) {
  const wraps = useAccessibilitySizes();
  if (tag.kind === 'yes' || tag.kind === 'waiting')
    return <Tag kind={tag.kind} word={tag.word} wraps={wraps} />;
  if (tag.kind === 'kept') return <Tag kind="paused" word={tag.word} wraps={wraps} />;
  const no = tag.kind === 'no';
  const ink = no ? tokens.colorBrokenText : tokens.colorInkSecondary;

  return (
    <View style={[styles.tag, no ? styles.tagNo : styles.tagLock, wraps && styles.tagWraps]}>
      <View style={styles.tagMark} {...hidden}>
        <Glyph name={no ? 'x' : 'lock'} size={no ? 12 : 13} ink={ink} weight={no ? 3 : 2.4} />
      </View>
      <Text size={12.5} weight="semibold" style={{ color: ink }}>
        {tag.word}
      </Text>
    </View>
  );
}

/** A row with a tag the product's Row cannot carry: the lead, the title and its tag, the line, then a trail or a chevron. */
export function TagRow({
  title,
  line,
  lead,
  tag,
  trail,
  opens = false,
  onPress,
  accessibilityLabel,
  testID,
  ref,
}: {
  title: string;
  line: string;
  lead?: ReactNode;
  tag?: TagWord | LockTag | null;
  trail?: ReactNode;
  opens?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  ref?: Ref<ViewInstance>;
}) {
  const label = accessibilityLabel ?? [title, tag?.word, line].filter(Boolean).join('. ');
  const words = (
    <>
      {lead}
      <View style={styles.words}>
        <View style={styles.titleRow}>
          <Text size={16} weight="semibold" accessible={false} style={styles.title}>
            {title}
          </Text>
          {tag != null && <DataTag tag={tag} />}
        </View>
        <Text size={14} weight="medium" accessible={false} style={[styles.secondary, styles.line]}>
          {line}
        </Text>
      </View>
      {opens && <Glyph name="chevron" size={17} ink={tokens.colorInkTertiary} weight={2.3} />}
    </>
  );

  if (onPress == null)
    return (
      <View style={styles.row} testID={testID}>
        <View style={styles.rowWords} accessible accessibilityLabel={label}>
          {words}
        </View>
        {trail}
      </View>
    );

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {words}
    </Pressable>
  );
}

export function Lead({ glyph }: { glyph: 'globe' | 'history' }) {
  return (
    <View style={styles.lead} {...hidden}>
      {glyph === 'globe' ? (
        <Glyph name="globe" size={22} ink={tokens.colorInkSecondary} weight={2} />
      ) : (
        <DrawnGlyph name="history" size={22} ink={tokens.colorInkSecondary} />
      )}
    </View>
  );
}

export function StatusLine({ text }: { text: string }) {
  return (
    <View style={styles.status}>
      <View style={styles.statusMark}>
        <ShapeMark kind="waiting" side={14} ink={tokens.colorAttentionText} />
      </View>
      <Text size={15} weight="medium" style={styles.grow}>
        {text}
      </Text>
    </View>
  );
}

/** On its side, a page one level under a section: its back above its title, drawing no larger than it, nor anything under it (sc-67471). */
export function PaneWithBack({
  title,
  back,
  children,
}: {
  title: string;
  back: { label: string; onPress: () => void };
  children: ReactNode;
}) {
  const { cap, onDrawn } = useTitleCap(`${PANE_TITLE}|${title}`, PANE_TITLE);

  return (
    <TitleCap.Provider value={cap}>
      <View style={styles.paneHead}>
        <Back {...back} />
        <Title
          size={PANE_TITLE}
          accessibilityRole="header"
          style={[styles.paneTitle, paneTitle]}
          onDrawn={onDrawn}
        >
          {title}
        </Title>
      </View>
      {children}
    </TitleCap.Provider>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  pressed: { opacity: tokens.opacityPressed },
  tile: { alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.optionGreen },
  tag: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 5,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: 12,
  },
  tagWraps: { flexShrink: 1 },
  tagNo: { backgroundColor: tokens.colorBrokenTint },
  tagLock: { backgroundColor: tokens.colorNeutralFill },
  tagMark: { alignItems: 'center', justifyContent: 'center' },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: 11,
  },
  rowWords: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  words: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 4,
  },
  title: { flexShrink: 1, lineHeight: 16 * 1.3 },
  line: { lineHeight: 14 * 1.4 },
  lead: { width: 28, alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  statusMark: { paddingTop: 3 },
  paneHead: { gap: tokens.spaceXs },
  paneTitle: { paddingTop: 6, paddingBottom: tokens.spaceXs },
});
