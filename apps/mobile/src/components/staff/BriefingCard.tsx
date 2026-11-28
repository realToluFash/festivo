import type { StaffBriefing, StaffEntry } from '@soirely/api-client';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { BRIEFING_STATES, BRIEFING_WORDS, tallyOf } from '../../kit/staffBriefing.ts';
import { tokens } from '../../theme/tokens.ts';
import { QuietButton, SecondaryButton } from '../Buttons.tsx';
import { Glyph } from '../Glyph.tsx';
import { ShapeMark } from '../StatusMark.tsx';
import { Text } from '../Text.tsx';

/** A briefing state as a shape beside its word, never colour alone: a filled tick, a half ring, an amber ring, a dashed ring. */
export function BriefMark({ briefing, side = 14 }: { briefing: StaffBriefing; side?: number }) {
  if (briefing === 'none')
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.dashed, { width: side, height: side, borderRadius: side / 2 }]}
      />
    );
  const kind = briefing === 'read' ? 'yes' : briefing === 'sent' ? 'waiting' : 'notyet';

  return (
    <ShapeMark
      kind={kind}
      side={side}
      ink={briefing === 'changed' ? tokens.colorAttention : tokens.colorAccent}
    />
  );
}

export function BriefWord({
  briefing,
  size = 14,
  weight = 'semibold',
}: {
  briefing: StaffBriefing;
  size?: number;
  weight?: 'medium' | 'semibold';
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.word}>
      <BriefMark briefing={briefing} side={size} />
      <Text size={size} weight={weight} accessible={false} style={styles.shrink}>
        {t(BRIEFING_WORDS[briefing])}
      </Text>
    </View>
  );
}

/** The Briefing card above the roster (sc-95654), as /demo/events/evt-wed-4?area=staff draws it: the tally counted from the rows, Copy link, Edit the rules (House rules with staff.read only) and Preview as. Sending by text is sc-95657's. */
export function BriefingCard({
  people,
  acts,
  manages,
  openCopy,
  openRules,
  openPreview,
  openCopyRef,
  openRulesRef,
  openPreviewRef,
}: {
  people: readonly StaffEntry[];
  /** staff.manage, on an event not yet finished. */
  acts: boolean;
  /** staff.manage, finished or not: only a person without it reads the lock. */
  manages: boolean;
  openCopy: () => void;
  openRules: () => void;
  openPreview: (() => void) | null;
  openCopyRef: Ref<ViewInstance>;
  openRulesRef: Ref<ViewInstance>;
  openPreviewRef: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const tally = tallyOf(people);

  return (
    <View style={styles.card} testID="briefing.card">
      <Text size={19} weight="bold" accessibilityRole="header">
        {t('briefing.card')}
      </Text>
      <Text size={15} style={styles.secondary}>
        {t('briefing.cardSub')}
      </Text>
      {!manages && (
        <View style={styles.lock} testID="briefing.readOnly">
          <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
          <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
            {t('briefing.lock')}
          </Text>
        </View>
      )}
      <View
        style={styles.tally}
        accessible
        accessibilityLabel={`${t('briefing.tally')}: ${BRIEFING_STATES.map(
          (state) => `${t(BRIEFING_WORDS[state])} ${tally[state]}`,
        ).join(', ')}`}
        testID="briefing.tally"
      >
        {BRIEFING_STATES.map((state) => (
          <View key={state} style={styles.tallyOne} testID={`briefing.tally.${state}`}>
            <BriefWord briefing={state} size={15} weight="medium" />
            <Text size={15} weight="bold" style={styles.figure}>
              {tally[state]}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.acts}>
        {acts && (
          <SecondaryButton
            ref={openCopyRef}
            label={t('staffLink.copy')}
            onPress={openCopy}
            testID="briefing.copy"
          />
        )}
        <QuietButton
          ref={openRulesRef}
          label={acts ? t('briefing.editRules') : t('briefing.rules')}
          onPress={openRules}
          testID="briefing.rules"
        />
        {openPreview != null && (
          <QuietButton
            ref={openPreviewRef}
            label={t('briefing.previewAs')}
            onPress={openPreview}
            testID="briefing.preview"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  secondary: { color: tokens.colorInkSecondary },
  shrink: { flexShrink: 1 },
  figure: { fontVariant: ['tabular-nums'] },
  lock: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  tally: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: tokens.spaceXl,
    rowGap: tokens.spaceSm,
  },
  tallyOne: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  word: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceMd },
  dashed: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkSecondary,
  },
});
