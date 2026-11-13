import { type Ref, type RefObject, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AlertLine } from '../../components/AlertLine.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Pair } from '../../components/SettingsParts.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import {
  type Anchor,
  AnchoredMenu,
  Row,
  TextAction,
  TurningMark,
} from '../../components/Summary.tsx';
import { Text, type TextHandle } from '../../components/Text.tsx';
import type { CoverLayout } from '../../components/TodayCover.tsx';
import { tokens } from '../../theme/tokens.ts';
import { STOP, sayStop } from './MessagesWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

export function MoreActions({
  open,
  onPress,
  buttonRef,
}: {
  open: boolean;
  onPress: () => void;
  buttonRef: Ref<ViewInstance>;
}) {
  return (
    <Pressable
      ref={buttonRef}
      onPress={onPress}
      style={({ pressed }) => [styles.more, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={STOP.moreActions}
      accessibilityState={{ expanded: open }}
      testID="messages.moreActions"
    >
      <Glyph name="dots" size={20} ink={tokens.colorInk} weight={2.4} />
    </Pressable>
  );
}

function NoEntry() {
  return (
    <View style={styles.markTop} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Circle
          cx={12}
          cy={12}
          r={9}
          fill="none"
          stroke={tokens.colorInkSecondary}
          strokeWidth={2.2}
        />
        <Path
          d="M7.5 12h9"
          stroke={tokens.colorInkSecondary}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

function BusyAction({ label, testID }: { label: string; testID: string }) {
  return (
    <Pressable
      disabled
      style={styles.busyAction}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: true, busy: true }}
      testID={testID}
    >
      <TurningMark side={14} />
      <Text size={15} weight="semibold" accessible={false} style={styles.secondary}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Under the conversation's head for as long as the guest is stopped; the words carry it, never colour alone. */
export function StoppedInset({
  line,
  manage,
  saving,
  failed,
  lineRef,
  onLetAgain,
}: {
  line: string;
  manage: boolean;
  saving: boolean;
  failed: boolean;
  lineRef: Ref<TextHandle>;
  onLetAgain: () => void;
}) {
  useReadOut(failed ? STOP.notSaved : null, { quietAtMount: true });

  return (
    <View style={styles.inset} testID="messages.stopped">
      <View style={styles.insetLine}>
        <NoEntry />
        <Text ref={lineRef} size={14} weight="medium" style={[styles.grow, styles.insetWords]}>
          {line}
        </Text>
      </View>
      {manage && (
        <View style={styles.insetActions}>
          {saving ? (
            <BusyAction label={STOP.letThemWriteAgain} testID="messages.letAgain" />
          ) : (
            <TextAction
              label={STOP.letThemWriteAgain}
              onPress={onLetAgain}
              testID="messages.letAgain"
            />
          )}
          {failed && <AlertLine text={STOP.notSaved} />}
        </View>
      )}
    </View>
  );
}

/** The conversation's actions: an action sheet on the phone, a menu under More actions on the iPad. */
export function StopActions({
  open,
  phone,
  at,
  item,
  opener,
  onChoose,
  onClose,
}: {
  open: boolean;
  phone: boolean;
  at: Anchor | null;
  item: string;
  opener: Opener;
  onChoose: () => void;
  onClose: () => void;
}) {
  const itemRef = useRef<ViewInstance>(null);

  useEffect(() => {
    if (!open) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(itemRef.current), 600);

    return () => clearTimeout(later);
  }, [open]);

  const row = (
    <Row
      ref={itemRef}
      title={item}
      pad={tokens.spaceMd}
      onPress={onChoose}
      accessibilityRole="menuitem"
      testID="messages.stopItem"
    />
  );

  if (phone)
    return (
      <Sheet
        open={open}
        onClose={onClose}
        scrimLabel={STOP.cancel}
        opener={opener}
        testID="messages.actionsSheet"
      >
        <View style={styles.sheetBody} accessibilityRole="menu">
          {row}
          <View style={styles.rule} />
          <TextAction label={STOP.cancel} onPress={onClose} testID="messages.actions.cancel" />
        </View>
      </Sheet>
    );

  return (
    <AnchoredMenu
      at={open ? at : null}
      onClose={onClose}
      opener={opener}
      width={300}
      align="end"
      testID="messages.actionsMenu"
    >
      <View style={styles.menuBody} accessibilityRole="menu">
        {row}
      </View>
    </AnchoredMenu>
  );
}

function ConfirmButton({
  label,
  busy,
  phone,
  onPress,
}: {
  label: string;
  busy: boolean;
  phone: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.confirm,
        phone ? styles.confirmPhone : styles.confirmTablet,
        busy && styles.confirmBusy,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      testID="messages.stopAsk.confirm"
    >
      {busy && <TurningMark side={16} />}
      <Text
        size={16}
        weight="semibold"
        accessible={false}
        style={[styles.confirmWords, busy ? styles.secondary : styles.onAccent]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Asked once: a bottom sheet on the phone, a centred card on the iPad; Escape, the scrim and Back keep them writing. */
export function StopAsk({
  open,
  name,
  layout,
  saving,
  failed,
  opener,
  onConfirm,
  onKeep,
}: {
  open: boolean;
  name: string;
  layout: CoverLayout;
  saving: boolean;
  failed: boolean;
  opener: Opener;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const titleRef = useRef<TextHandle>(null);
  const phone = layout === 'phone';
  useReadOut(open && failed ? STOP.notSaved : null, { quietAtMount: true });

  useEffect(() => {
    if (!open) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(titleRef.current), 600);

    return () => clearTimeout(later);
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onKeep}
      scrimLabel={STOP.keepWriting}
      held={saving}
      opener={opener}
      headingTakesFocus
      testID="messages.stopAsk"
    >
      <View style={phone ? styles.sheetBody : styles.askCard}>
        <Text
          ref={titleRef}
          size={20}
          weight="bold"
          accessibilityRole="header"
          style={styles.askTitle}
        >
          {sayStop.title(name)}
        </Text>
        <Text size={15} weight="medium" style={[styles.secondary, styles.askLine]}>
          {STOP.line}
        </Text>
        {failed && <AlertLine text={STOP.notSaved} />}
        <View style={styles.askActions}>
          <Pair
            layout={layout}
            dismiss={
              <View style={phone ? styles.dismissPhone : undefined}>
                <TextAction
                  label={STOP.keepWriting}
                  onPress={onKeep}
                  off={saving}
                  testID="messages.stopAsk.keep"
                />
              </View>
            }
            confirm={
              <ConfirmButton
                label={sayStop.confirm(name)}
                busy={saving}
                phone={phone}
                onPress={onConfirm}
              />
            }
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  onAccent: { color: tokens.colorInkOnDark },
  pressed: { opacity: tokens.opacityPressed },
  more: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markTop: { paddingTop: 1 },
  inset: {
    gap: tokens.spaceXs,
    paddingTop: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    paddingBottom: tokens.spaceXxs,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  insetLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  insetWords: { color: tokens.colorInkSecondary, lineHeight: 14 * 1.45 },
  insetActions: { paddingLeft: 26, paddingBottom: tokens.spaceXs, gap: tokens.spaceXxs },
  busyAction: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: tokens.spaceXs,
  },
  sheetBody: {
    gap: tokens.spaceMd,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.spaceXl,
  },
  menuBody: { paddingVertical: tokens.spaceXs, paddingHorizontal: tokens.spaceLg },
  rule: { height: 1, backgroundColor: tokens.colorBorder },
  askCard: { gap: tokens.spaceMd, padding: tokens.space3xl, paddingBottom: tokens.spaceXl },
  askTitle: { letterSpacing: 20 * -0.01, lineHeight: 20 * 1.25 },
  askLine: { lineHeight: 15 * 1.45 },
  askActions: { paddingTop: tokens.spaceXs },
  dismissPhone: { alignItems: 'center' },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceMd,
    backgroundColor: tokens.colorAccent,
  },
  confirmPhone: {
    alignSelf: 'stretch',
    minHeight: tokens.sizeHitPhoneHero,
    borderRadius: tokens.sizeHitPhoneHero / 2,
    paddingHorizontal: tokens.spaceXxl,
  },
  confirmTablet: {
    minHeight: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    paddingHorizontal: 22,
  },
  confirmBusy: { backgroundColor: tokens.colorNeutralFill },
  confirmWords: { flexShrink: 1, textAlign: 'center', lineHeight: 16 * 1.3 },
});
