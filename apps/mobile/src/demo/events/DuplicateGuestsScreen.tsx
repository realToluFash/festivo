import { type LimitRefusal, copyEndsLine, limitRefusalOf } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AlertLine } from '../../components/AlertLine.tsx';
import { EventNotice } from '../../components/EventNotice.tsx';
import { SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { MomentBox, type Picking, PickerLayer, pick } from '../../components/MomentPick.tsx';
import { SETTLED_MS } from '../../components/Screen.tsx';
import { CheckMark } from '../../components/SecurityTwoFactor.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { SheetScrollView } from '../../components/Sheet.tsx';
import { FocusedScreen, SectionHead } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { useShellLayout } from '../../components/settingsShell.ts';
import { dateLocale } from '../../i18n/index.ts';
import type { DuplicateRun, Starts } from '../../kit/eventDuplicate.ts';
import { tokens } from '../../theme/tokens.ts';
import { type CopyOver, GW, copyLists, copyProblem, createdLine } from './DuplicateGuests.ts';

type Opener = RefObject<ScreenReaderTarget | null>;
type Original = { name: string; startsAt: string; endsAt: string; timeZone: string };

/** The box is a whole row, 44 pt on iOS and 48 dp on Android. */
const BOX_HEIGHT = Platform.OS === 'android' ? tokens.sizeHitPhonePrimary : tokens.sizeHit;

/** The refusal the app reads from the API's answer to a list too big to copy. */
export function copyRefusal(
  over: CopyOver,
  people: number,
  t: Parameters<typeof limitRefusalOf>[2],
): LimitRefusal | null {
  return limitRefusalOf(copyProblem(over, people), 'copy', t, dateLocale());
}

/** sc-48601's Duplicate with sc-101394's box: the product's screen, plus Also copy the guest list under when the copy ends. */
export function DuplicateGuestsScreen({
  open,
  event,
  locale,
  run,
  refusals,
  guests,
  ticked,
  copied,
  refusal,
  billing,
  opener,
  onClose,
  onPick,
  onTick,
  onCreate,
  onBack,
  testID,
}: {
  open: boolean;
  event: Original;
  locale: string;
  run: DuplicateRun;
  refusals: number;
  guests: number | null;
  ticked: boolean;
  copied: number | null;
  refusal: LimitRefusal | null;
  /** Holds billing.manage, so a plan limit says the plan cannot be changed here, as `LimitRefusalBody` has it. */
  billing: boolean;
  opener: Opener;
  onClose: () => void;
  onPick: (starts: Starts) => void;
  onTick: () => void;
  onCreate: () => void;
  onBack: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const { starts, status, error } = run;
  const [picking, setPicking] = useState<Picking | null>(null);
  const date = useRef<ViewInstance>(null);
  const time = useRef<ViewInstance>(null);
  const busy = status === 'creating' || status === 'created';
  const gap = useShellLayout() === 'phone' ? tokens.spaceXl : tokens.spaceLg;
  const startsLabel = t('eventDuplicate.starts');
  const lists = copyLists(guests != null && ticked, guests ?? 0, t);
  const choose = (mode: 'date' | 'time') =>
    pick(
      {
        title: t('eventForm.timesIn', { zone: event.timeZone }),
        mode,
        field: starts,
        take: onPick,
      },
      setPicking,
    );

  useEffect(() => {
    if (refusals === 0 || !open) return undefined;
    const later = setTimeout(
      () => moveScreenReaderFocus((run.focus === 'time' ? time : date).current),
      SETTLED_MS,
    );

    return () => clearTimeout(later);
  }, [refusals, open, run.focus]);

  const layer =
    refusal != null
      ? {
          layer: (
            <CopyRefusalLayer
              refusal={refusal}
              billing={billing}
              onBack={onBack}
              testID={`${testID}.limit`}
            />
          ),
          onClose: onBack,
        }
      : picking != null
        ? {
            layer: (
              <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
            ),
            onClose: () => setPicking(null),
          }
        : null;

  return (
    <FocusedScreen
      gap={gap}
      open={open}
      title={t('eventDuplicate.open')}
      verb={{
        label: t('eventDuplicate.create'),
        on: true,
        busy,
        onPress: () => {
          if (!busy) onCreate();
        },
        testID: `${testID}.create`,
      }}
      waits={busy}
      onCancel={onClose}
      cancelTestID={`${testID}.cancel`}
      opener={opener}
      toast={status === 'created' ? { words: createdLine(copied, t), onClose: () => {} } : null}
      over={layer}
      testID={testID}
    >
      {status === 'failed' && (
        <EventNotice tone="broken" words={t('eventDuplicate.notCreated')} interrupts />
      )}
      <Text size={22} weight="bold" accessibilityRole="header" style={styles.title}>
        {t('eventDuplicate.title', { event: event.name })}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('eventDuplicate.body')}
      </Text>
      <Listed title={t('eventDuplicate.copied')} items={lists.copied} />
      <Listed title={t('eventDuplicate.notCopied')} items={lists.notCopied} />
      <View style={styles.starts}>
        <Text size={14} weight="semibold" style={styles.label}>
          {startsLabel}
        </Text>
        <View style={styles.pair}>
          <MomentBox
            ref={date}
            label={`${startsLabel}, ${t('eventForm.date')}`}
            mode="date"
            value={starts.date}
            locale={locale}
            wrong={error != null && (starts.date === '' || run.focus === 'date')}
            onPress={() => choose('date')}
            testID={`${testID}.date`}
          />
          <MomentBox
            ref={time}
            label={`${startsLabel}, ${t('eventForm.time')}`}
            mode="time"
            value={starts.time}
            locale={locale}
            width={104}
            wrong={error != null && starts.time === ''}
            onPress={() => choose('time')}
            testID={`${testID}.time`}
          />
        </View>
        {error != null && <AlertLine text={error} />}
      </View>
      <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
        {copyEndsLine(starts.date, starts.time, event, locale, t)}
      </Text>
      {guests != null && (
        <Pressable
          style={[styles.box, { minHeight: BOX_HEIGHT }]}
          disabled={busy}
          onPress={onTick}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ticked, disabled: busy }}
          accessibilityLabel={GW.copyGuests(guests)}
          accessibilityHint={GW.copyGuestsHint}
          testID={`${testID}.guests`}
        >
          <CheckMark on={ticked} />
          <View style={styles.grow}>
            <Text size={15.5} weight="semibold" accessible={false} style={styles.lines}>
              {GW.copyGuests(guests)}
            </Text>
            <Text size={14} accessible={false} style={[styles.secondary, styles.said]}>
              {GW.copyGuestsHint}
            </Text>
          </View>
        </Pressable>
      )}
    </FocusedScreen>
  );
}

function Listed({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <View>
      <SectionHead title={title} />
      {items.map((item) => (
        <Text key={item} size={15} weight="medium" style={styles.bullet}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  );
}

/** sc-3930's refusal in the app's guest shape, for a copy: no Remove a guest, its one way the untick line, and Back to the form keeping the start and the tick. */
function CopyRefusalLayer({
  refusal,
  billing,
  onBack,
  testID,
}: {
  refusal: LimitRefusal;
  billing: boolean;
  onBack: () => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <SheetLayer label={refusal.back} alert onClose={onBack}>
      <View style={styles.sheet} accessibilityRole="alert" testID={testID}>
        <View style={styles.titleRow}>
          <View style={styles.hard}>
            <Glyph name="x" size={14} ink={tokens.colorInk} weight={2.6} />
          </View>
          <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
            {refusal.title}
          </Text>
        </View>
        <SheetScrollView contentContainerStyle={styles.refusalLines}>
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
          {refusal.untick != null && (
            <Text size={15} weight="medium" testID={`${testID}.untick`}>
              {refusal.untick}
            </Text>
          )}
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
    </SheetLayer>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  title: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  bullet: { lineHeight: 15 * 1.45 },
  lines: { lineHeight: 15 * 1.45 },
  label: { lineHeight: 14 * 1.3 },
  said: { lineHeight: 14 * 1.45 },
  starts: { gap: 7 },
  pair: { flexDirection: 'row', gap: tokens.spaceSm },
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg, paddingVertical: 10 },
  grow: { flex: 1, minWidth: 0 },
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 22, paddingBottom: 34 },
  refusalLines: { gap: 14 },
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
});
