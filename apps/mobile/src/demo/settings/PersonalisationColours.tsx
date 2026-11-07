import { type RefObject, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import {
  moveScreenReaderFocus,
  type ScreenReaderTarget,
} from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import type { Scheme } from '../../theme/tokens.ts';
import { tokens } from '../../theme/tokens.ts';
import {
  type Colours,
  nameOf,
  notSavedLine,
  saveOn,
  statusLine,
  swatchName,
  WORDS,
} from './PersonalisationModel.ts';
import { PreviewCard, SchemeGround, swatchSpots } from './PersonalisationParts.tsx';
import { lookOf, SCHEME_ORDER } from './PersonalisationSchemes.ts';
import { useShell } from '../../components/settingsShell.ts';
import { FocusedScreen, Tag, TextAction } from '../../components/Summary.tsx';

/** Colours: the card in the pick, what the pick means, the restart line and the eight swatches; Cancel leaves without asking. */
export function ColoursScreen({
  open,
  colours,
  current,
  opener,
  onPick,
  onSave,
  onCancel,
}: {
  open: boolean;
  colours: Colours;
  current: Scheme;
  opener: RefObject<ScreenReaderTarget | null>;
  onPick: (scheme: Scheme) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { layout } = useShell();
  const phone = layout === 'phone';
  const checked = useRef<ViewInstance>(null);
  const saving = colours.phase === 'saving';
  const refusal = colours.phase === 'failed' || colours.phase === 'offline' ? colours.phase : null;
  const status = statusLine(colours.picked, current);

  useReadOut(refusal == null ? null : notSavedLine(refusal, colours.picked, current));

  useEffect(() => {
    if (!open) return;
    const wait = setTimeout(() => moveScreenReaderFocus(checked.current), SETTLED_MS);

    return () => clearTimeout(wait);
  }, [open]);

  return (
    <FocusedScreen
      open={open}
      title={WORDS.colours}
      verb={{
        label: saving ? WORDS.saving : WORDS.save,
        on: saveOn(colours, current),
        busy: saving,
        onPress: onSave,
        testID: 'personalisation.save',
      }}
      waits={saving}
      onCancel={onCancel}
      cancelTestID="personalisation.cancel"
      opener={opener}
      gap={tokens.spaceLg}
      testID="personalisation.colours"
    >
      <Text size={15} weight="medium">
        {WORDS.lead}
      </Text>
      <View style={styles.pick}>
        <PreviewCard scheme={colours.picked} />
        {refusal == null ? (
          <StatusLine text={status} />
        ) : (
          <View>
            <View accessible accessibilityRole="alert" style={styles.notSaved}>
              <View style={styles.mark}>
                <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.2} />
              </View>
              <Text
                size={13.5}
                weight="medium"
                accessible={false}
                style={[styles.words, styles.broken]}
              >
                {notSavedLine(refusal, colours.picked, current)}
              </Text>
            </View>
            <TextAction label={WORDS.tryAgain} onPress={onSave} testID="personalisation.tryAgain" />
          </View>
        )}
      </View>
      <View style={styles.restart}>
        <View style={styles.mark}>
          <Glyph name="info" size={16} ink={tokens.colorInkSecondary} weight={2.2} />
        </View>
        <Text size={14} weight="medium" style={[styles.words, styles.quiet]}>
          {WORDS.restart}
        </Text>
      </View>
      <Swatches
        picked={colours.picked}
        current={current}
        across={phone ? 2 : 3}
        meshHeight={phone ? 44 : 48}
        waits={saving}
        checkedRef={checked}
        onPick={onPick}
      />
    </FocusedScreen>
  );
}

/** What the pick means, said again as it changes. */
function StatusLine({ text }: { text: string }) {
  useReadOut(text, { quietAtMount: true });

  return (
    <Text size={14} weight="medium" style={styles.quiet} testID="personalisation.status">
      {text}
    </Text>
  );
}

/** The eight schemes as one radio group: two across on a phone, three in the iPad's sheet; while a save is out they wait, drawn as they were. */
function Swatches({
  picked,
  current,
  across,
  meshHeight,
  waits,
  checkedRef,
  onPick,
}: {
  picked: Scheme;
  current: Scheme;
  across: number;
  meshHeight: number;
  waits: boolean;
  checkedRef: RefObject<ViewInstance | null>;
  onPick: (scheme: Scheme) => void;
}) {
  const rows = Array.from({ length: Math.ceil(SCHEME_ORDER.length / across) }, (_, row) =>
    SCHEME_ORDER.slice(row * across, row * across + across),
  );
  const gap = across === 2 ? tokens.spaceMd : tokens.spaceLg;

  return (
    <View accessibilityRole="radiogroup" style={{ gap }}>
      {rows.map((row) => (
        <View key={row.join()} style={[styles.row, { gap }]}>
          {row.map((scheme) => (
            <Swatch
              key={scheme}
              scheme={scheme}
              picked={scheme === picked}
              name={swatchName(scheme, current)}
              current={scheme === current}
              meshHeight={meshHeight}
              waits={waits}
              ref={scheme === picked ? checkedRef : undefined}
              onPick={() => onPick(scheme)}
            />
          ))}
          {Array.from({ length: across - row.length }, (_, index) => (
            <View key={index} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Swatch({
  scheme,
  name,
  picked,
  current,
  meshHeight,
  waits,
  ref,
  onPick,
}: {
  scheme: Scheme;
  name: string;
  picked: boolean;
  current: boolean;
  meshHeight: number;
  waits: boolean;
  ref: RefObject<ViewInstance | null> | undefined;
  onPick: () => void;
}) {
  const look = lookOf(scheme);

  return (
    <View style={styles.cell}>
      <Pressable
        ref={ref}
        onPress={onPick}
        disabled={waits}
        style={[styles.ring, picked && styles.ringPicked]}
        accessibilityRole="radio"
        accessibilityLabel={name}
        accessibilityState={{ checked: picked, disabled: waits }}
        testID={`personalisation.swatch.${scheme}`}
      >
        <View style={styles.swatch}>
          <View style={{ height: meshHeight, backgroundColor: look.ground.base }}>
            <SchemeGround look={look} washed={false} spots={swatchSpots(meshHeight)} from="right" />
            {current && (
              <View style={styles.current}>
                <Tag kind="yes" word={WORDS.current} />
              </View>
            )}
          </View>
          <View style={styles.swatchRow}>
            <RadioMark on={picked} />
            <Text size={15.5} weight="semibold" numberOfLines={1} accessible={false}>
              {nameOf(scheme)}
            </Text>
          </View>
          {/* The edge lies over the swatch, as the board's shadow does, so it adds no height. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.edge,
              picked ? styles.swatchPicked : styles.swatchEdge,
            ]}
            pointerEvents="none"
          />
        </View>
      </Pressable>
    </View>
  );
}

const RING = 2.5;
const RING_GAP = 2;

const styles = StyleSheet.create({
  pick: { gap: tokens.spaceMd },
  words: { flex: 1, minWidth: 0 },
  quiet: { lineHeight: Math.round(14 * 1.45), color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBroken },
  notSaved: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceXs },
  restart: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { marginTop: tokens.spaceHair },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0 },
  ring: {
    margin: -(RING + RING_GAP),
    padding: RING_GAP,
    borderWidth: RING,
    borderColor: 'transparent',
    borderRadius: 18 + RING + RING_GAP,
  },
  ringPicked: { borderColor: tokens.colorAccent },
  swatch: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
  },
  edge: { borderRadius: 18, borderWidth: 1 },
  swatchEdge: { borderColor: tokens.colorBorder },
  swatchPicked: { borderColor: tokens.colorCard },
  current: { position: 'absolute', top: 10, left: 10 },
  swatchRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
  },
});
