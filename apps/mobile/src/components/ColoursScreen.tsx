import { type RefObject, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  type Colours,
  nameOf,
  notSavedLine,
  saveOn,
  statusLine,
  swatchName,
} from '../kit/personalisation.ts';
import { lookOf, SCHEME_ORDER } from '../kit/schemes.ts';
import type { Scheme } from '../theme/tokens.ts';
import { tokens } from '../theme/tokens.ts';
import { useShellLayout } from './settingsShell.ts';
import { FocusedScreen } from './SummaryOverlays.tsx';
import { Glyph } from './Glyph.tsx';
import { RadioMark } from './RadioMark.tsx';
import { useReadOut } from './ReadOut.tsx';
import { PreviewCard, SchemeGround, swatchSpots } from './SchemeParts.tsx';
import { SETTLED_MS } from './Screen.tsx';
import { moveScreenReaderFocus, type ScreenReaderTarget } from './screenReaderFocus.ts';
import { Text } from './Text.tsx';
import { Tag, TextAction } from './SummaryRows.tsx';

/** Colours: the card in the pick, what the pick means, the restart line, then the lead line as the heading of the eight swatches; Cancel leaves without asking. */
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
  const { t } = useTranslation();
  const phone = useShellLayout() === 'phone';
  const checked = useRef<ViewInstance>(null);
  const saving = colours.phase === 'saving';
  const refusal = colours.phase === 'failed' || colours.phase === 'offline' ? colours.phase : null;
  const status = statusLine(t, colours.picked, current);

  const notSaved = refusal == null ? null : notSavedLine(t, refusal, colours.picked, current);

  useReadOut(notSaved);

  useEffect(() => {
    if (!open) return;
    const wait = setTimeout(() => moveScreenReaderFocus(checked.current), SETTLED_MS);

    return () => clearTimeout(wait);
  }, [open]);

  return (
    <FocusedScreen
      open={open}
      title={t('personalisation.colours')}
      verb={{
        label: saving ? t('personalisation.saving') : t('personalisation.save'),
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
      <View style={styles.pick}>
        <PreviewCard scheme={colours.picked} />
        {notSaved == null ? (
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
                {notSaved}
              </Text>
            </View>
            <TextAction
              label={t('personalisation.tryAgain')}
              onPress={onSave}
              testID="personalisation.tryAgain"
            />
          </View>
        )}
      </View>
      <View style={styles.restart}>
        <View style={styles.mark}>
          <Glyph name="info" size={16} ink={tokens.colorInkSecondary} weight={2.2} />
        </View>
        <Text size={14} weight="medium" style={[styles.words, styles.quiet]}>
          {t('personalisation.restart')}
        </Text>
      </View>
      {/* The swatches' group name: a View that is not accessible has no label a reader speaks, so the heading just before the first swatch names it. */}
      <Text size={15} weight="medium" accessibilityRole="header">
        {t('personalisation.lead')}
      </Text>
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
  const { t } = useTranslation();
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
              name={swatchName(t, scheme, current)}
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
  const { t } = useTranslation();
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
                <Tag kind="yes" word={t('personalisation.current')} />
              </View>
            )}
          </View>
          <View style={styles.swatchRow}>
            <RadioMark on={picked} />
            <Text size={15.5} weight="semibold" accessible={false} style={styles.swatchName}>
              {nameOf(t, scheme)}
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
    flex: 1,
    margin: -(RING + RING_GAP),
    padding: RING_GAP,
    borderWidth: RING,
    borderColor: 'transparent',
    borderRadius: 18 + RING + RING_GAP,
  },
  ringPicked: { borderColor: tokens.colorAccent },
  swatch: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: tokens.colorCard,
  },
  edge: { borderRadius: 18, borderWidth: 1 },
  swatchEdge: { borderColor: tokens.colorBorder },
  swatchPicked: { borderColor: tokens.colorCard },
  current: { position: 'absolute', top: 10, left: 10 },
  swatchRow: {
    flex: 1,
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
  },
  swatchName: { flexShrink: 1 },
});
