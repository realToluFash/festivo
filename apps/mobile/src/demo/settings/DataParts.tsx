import { type Href, router, useLocalSearchParams } from 'expo-router';
import { createContext, type ReactNode, type Ref, useCallback, useContext } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Back } from '../../components/SettingsParts.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { ShapeMark, Tag } from '../../components/Summary.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { useAccessibilitySizes } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import {
  type DataPage,
  dataHref,
  type DataViewer,
  dataViewerOf,
  hubFor,
  type TagWord,
} from './DataModel.ts';
import { DATA_WORDS, DOMAINS_WORDS } from './DataWords.ts';
import { SummaryPage } from './SummaryPage.tsx';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Which Data and control page is open, so the Settings list lights its row. */
export const DataOpenContext = createContext<DataPage | null>(null);

export function useDataOpen(): DataPage | null {
  return useContext(DataOpenContext);
}

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
export function DataTag({ tag }: { tag: TagWord | { kind: 'lock'; word: string } }) {
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

export const LOCK_TAG = { kind: 'lock', word: DATA_WORDS.enterprise } as const;

/** B's row with a tag the product's Row cannot carry: the lead, the title and its tag, the line, then a trail or a chevron. */
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
  tag?: TagWord | typeof LOCK_TAG | null;
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

/** A code, a reference or an address: Sans with tabular figures, tracked 0.04em. */
export function Code({ text, size = 16 }: { text: string; size?: number }) {
  return (
    <Text
      size={size}
      weight="medium"
      selectable
      style={[styles.code, { letterSpacing: size * 0.04 }]}
    >
      {text}
    </Text>
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

/** Where each Data and control page goes: one level down and back, carrying who looks and the hub's sample. */
export function useDataNav() {
  const shell = useShell();
  const params = useLocalSearchParams<{ as?: string; from?: string; state?: string }>();
  const viewer: DataViewer = dataViewerOf(params.as);
  const landscape = shell.layout === 'landscape';
  const hub = hubFor(params.state, params.from);

  const open = useCallback(
    (page: DataPage, state: string | null, from: typeof hub | null = null) => {
      const href = dataHref(page, { state, as: viewer, from }) as Href;
      // On its side the list stays put, so a page changes beside it rather than stacking.
      if (landscape) router.replace(href);
      else router.push(href);
    },
    [landscape, viewer],
  );
  const toHub = useCallback(() => {
    const href = dataHref('hub', { state: hub === 'hub' ? null : hub, as: viewer }) as Href;
    if (landscape) router.replace(href);
    else router.dismissTo(href);
  }, [landscape, hub, viewer]);

  return { viewer, open, toHub };
}

/** A page one level down: the nav's back to Data and control, and on its side the same back above the title. */
export function DataSubPage({ title, children }: { title: string; children: ReactNode }) {
  const shell = useShell();
  const { toHub } = useDataNav();
  const back = { label: DATA_WORDS.title, onPress: toHub };

  if (shell.layout !== 'landscape')
    return (
      <SummaryPage title={title} back={back}>
        {children}
      </SummaryPage>
    );

  return (
    <SummaryPage>
      <View style={styles.paneHead}>
        <Back {...back} />
        <Text size={28} weight="bold" accessibilityRole="header" style={styles.paneTitle}>
          {title}
        </Text>
      </View>
      {children}
    </SummaryPage>
  );
}

export const DOMAIN_TAG_WORDS = [
  DOMAINS_WORDS.proved,
  DOMAINS_WORDS.waiting,
  DOMAINS_WORDS.notProved,
  DOMAINS_WORDS.missing,
];

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
  code: { fontVariant: ['tabular-nums'] },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  statusMark: { paddingTop: 3 },
  paneHead: { gap: tokens.spaceXs },
  paneTitle: { letterSpacing: 28 * -0.02, paddingTop: 6, paddingBottom: tokens.spaceXs },
});
