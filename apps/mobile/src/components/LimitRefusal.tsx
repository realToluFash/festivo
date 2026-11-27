import {
  type InvitationOutcome,
  type LimitRefusal,
  limitRefusalOf,
  type LimitWay,
} from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { SheetLayer } from './FormLayers.tsx';
import { Glyph } from './Glyph.tsx';
import { Pill } from './SettingsParts.tsx';
import { Sheet, SheetScrollView } from './Sheet.tsx';
import { TextAction } from './SummaryRows.tsx';
import { Text } from './Text.tsx';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';

interface RefusalProps {
  refusal: LimitRefusal;
  /** Holds billing.manage, so a plan limit says the plan cannot be changed here. */
  billing: boolean;
  /** Remove a guest's link, closing the refusal onto the guest list. */
  onGuestList?: (() => void) | undefined;
  /** Withdraw an invitation's and Remove a member's rows, closing the refusal onto Members. */
  onMembers?: (() => void) | undefined;
  onBack: () => void;
  testID?: string | undefined;
}

/** sc-3930 in the app: a plan's hard limit, or the ceiling, refused in a bottom sheet on a phone and a centred card on a tablet. */
export function LimitRefusalSheet({
  refusal,
  opener,
  ...props
}: Omit<RefusalProps, 'refusal'> & {
  refusal: LimitRefusal | null;
  opener: RefObject<ScreenReaderTarget | null>;
}) {
  return (
    <Sheet
      open={refusal != null}
      onClose={props.onBack}
      opener={opener}
      {...(props.testID == null ? {} : { testID: props.testID })}
    >
      {refusal != null && <LimitRefusalBody refusal={refusal} {...props} />}
    </Sheet>
  );
}

/** A join the seats refused, from an invitation's row: Not now closes it, and the next Accept that meets them opens it again. */
export function SeatsFullSheet({
  outcome,
  testID,
}: {
  outcome: InvitationOutcome | undefined;
  testID?: string | undefined;
}) {
  const { t } = useTranslation();
  const [shut, setShut] = useState<InvitationOutcome | null>(null);
  const opener = useRef<ScreenReaderTarget>(null);
  const refusal =
    outcome?.kind === 'seatsFull' && outcome !== shut
      ? limitRefusalOf(outcome.error, 'seatAccept', t, dateLocale())
      : null;

  return (
    <LimitRefusalSheet
      refusal={refusal}
      billing={false}
      opener={opener}
      onBack={() => setShut(outcome ?? null)}
      testID={testID}
    />
  );
}

/** The same refusal over a focused screen, in that screen's window: its `over` layer. */
export function LimitRefusalLayer(props: RefusalProps) {
  return (
    <SheetLayer label={props.refusal.back} alert onClose={props.onBack}>
      <LimitRefusalBody {...props} />
    </SheetLayer>
  );
}

function LimitRefusalBody({
  refusal,
  billing,
  onGuestList,
  onMembers,
  onBack,
  testID = 'limitReached',
}: RefusalProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.sheet} accessibilityRole="alert">
      <View style={styles.titleRow}>
        <View style={styles.hard}>
          <Glyph name="x" size={14} ink={tokens.colorInk} weight={2.6} />
        </View>
        <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
          {refusal.title}
        </Text>
      </View>
      <SheetScrollView contentContainerStyle={styles.lines}>
        {refusal.line != null && <Text size={15.5}>{refusal.line}</Text>}
        {refusal.figure != null && (
          <Text size={14} style={[styles.secondary, styles.figures]}>
            {refusal.figure}
          </Text>
        )}
        <View style={styles.safe}>
          <Glyph name="shield" size={16} ink={tokens.colorAccentText} weight={2.2} />
          <Text size={14.5} weight="semibold" style={[styles.grow, styles.safeInk]}>
            {refusal.safe}
          </Text>
        </View>
        {refusal.goLive != null && (
          <View style={styles.inset}>
            <Glyph name="clock" size={16} ink={tokens.colorInk} weight={2.2} />
            <Text size={15} style={styles.grow}>
              {refusal.goLive}
            </Text>
          </View>
        )}
        {refusal.ways.includes('removeGuest') && (
          <View style={styles.row}>
            <Text size={15} weight="semibold">
              {t('limitReached.removeGuest')}
            </Text>
            <Text size={14} style={styles.secondary}>
              {t('limitReached.removeGuestLine')}
            </Text>
            {onGuestList != null && (
              <TextAction
                label={t('limitReached.toGuestList')}
                onPress={onGuestList}
                testID={`${testID}.guestList`}
              />
            )}
          </View>
        )}
        {onMembers != null &&
          refusal.ways
            .filter((way) => way === 'withdraw' || way === 'removeMember')
            .map((way) => (
              <SeatWay key={way} way={way} onPress={onMembers} testID={`${testID}.${way}`} />
            ))}
        {refusal.planLimit && billing && (
          <Text size={15} weight="medium" testID={`${testID}.inApp`}>
            {t('limitReached.inApp')}
          </Text>
        )}
      </SheetScrollView>
      <Pill
        label={refusal.back}
        kind="secondary"
        height={tokens.sizeHitPhonePrimary}
        onPress={onBack}
        testID={`${testID}.back`}
      />
    </View>
  );
}

function SeatWay({
  way,
  onPress,
  testID,
}: {
  way: Extract<LimitWay, 'withdraw' | 'removeMember'>;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={[styles.row, styles.rowLink]}
      accessibilityRole="link"
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.grow}>
        <Text size={15} weight="semibold">
          {t(`limitReached.${way}`)}
        </Text>
        <Text size={14} style={styles.secondary}>
          {t(`limitReached.${way}Line`)}
        </Text>
      </View>
      <Glyph name="chevron" size={16} ink={tokens.colorInkSecondary} weight={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 22, paddingBottom: 34 },
  lines: { gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hard: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  safe: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: tokens.colorAccentTint,
  },
  safeInk: { color: tokens.colorAccentText },
  inset: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  row: {
    gap: 2,
    minHeight: tokens.sizeHit,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  rowLink: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
