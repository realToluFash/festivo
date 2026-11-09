import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { CardLine } from '../kit/accountPage.ts';
import { tokens } from '../theme/tokens.ts';
import { useCardWords } from './Cover.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import {
  CardFace,
  OnCard,
  Row,
  RowList,
  Section,
  ShapeMark,
  type StepProps,
  SummaryCard,
} from './Summary.tsx';
import { type TextHandle, Text } from './Text.tsx';

/** Where a row's hairline starts: past its 28 pt icon and the gap beside it. */
export const LEAD_INSET = 40;

/** You on Confetti: your face, name and primary address, then what just happened or what is left to verify. */
export function YouCard({
  name,
  email,
  line,
  wide,
  step,
  nameRef,
}: {
  name: string;
  email: string;
  line: CardLine;
  wide: boolean;
  step: StepProps | null;
  nameRef: Ref<TextHandle>;
}) {
  const face = wide ? 64 : 56;
  const size = wide ? 24 : 22;
  const words = useCardWords(line?.kind ?? null);

  useReadOut(line?.text ?? null, { quietAtMount: true });

  return (
    <SummaryCard
      size={wide ? 'wide' : 'page'}
      height={200}
      step={step}
      words={words.boxes}
      testID="account.card"
    >
      <View style={styles.you} onLayout={words.onArea}>
        <CardFace name={name} side={face} />
        <View style={styles.words} onLayout={words.onWords}>
          <Text
            ref={nameRef}
            size={size}
            weight="bold"
            accessibilityRole="header"
            style={[
              styles.white,
              { lineHeight: Math.round(size * 1.15), letterSpacing: size * -0.015 },
            ]}
          >
            {name}
          </Text>
          <OnCard text={email} />
        </View>
      </View>
      {line?.kind === 'todo' && (
        <View style={styles.line} onLayout={words.onLine}>
          <OnCard text={line.text} strong />
        </View>
      )}
      {line?.kind === 'done' && (
        <View style={styles.done} onLayout={words.onLine} testID="account.said">
          <View style={styles.mark}>
            <ShapeMark kind="yes" side={16} ink={tokens.colorInkOnDark} />
          </View>
          <View style={styles.grow}>
            <OnCard text={line.text} strong />
          </View>
        </View>
      )}
    </SummaryCard>
  );
}

export function LineIcon({ name }: { name: GlyphName }) {
  return (
    <View style={styles.icon}>
      <Glyph name={name} size={22} ink={tokens.colorInkSecondary} weight={2} />
    </View>
  );
}

/** Your name and your time zone, each opening its own screen. */
export function AboutSection({
  name,
  zone,
  nameRef,
  zoneRef,
  onName,
  onZone,
}: {
  name: string;
  zone: { title: string; line: string };
  nameRef: Ref<ViewInstance>;
  zoneRef: Ref<ViewInstance>;
  onName: () => void;
  onZone: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Section title={t('account.aboutYou')}>
      <RowList
        items={[
          {
            key: 'name',
            inset: LEAD_INSET,
            row: (
              <Row
                ref={nameRef}
                title={name}
                line={t('account.yourName')}
                lead={<LineIcon name="user" />}
                opens
                onPress={onName}
                testID="account.name"
              />
            ),
          },
          {
            key: 'zone',
            inset: LEAD_INSET,
            row: (
              <Row
                ref={zoneRef}
                title={zone.title}
                line={zone.line}
                lead={<LineIcon name="globe" />}
                opens
                onPress={onZone}
                testID="account.zone"
              />
            ),
          },
        ]}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  you: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  white: { color: tokens.colorInkOnDark },
  line: { alignSelf: 'flex-start' },
  done: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    gap: tokens.spaceSm,
  },
  mark: { marginTop: tokens.spaceHair },
  grow: { flexShrink: 1, minWidth: 0 },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
