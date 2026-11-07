import { initials, type ZoneRow, zoneLabel } from '@soirely/domain';
import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import { type TextHandle, Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { type CardLine, WORDS, zoneLine } from './AccountModel.ts';
import {
  CardFace,
  OnCard,
  Row,
  RowList,
  Section,
  StatusMark,
  type StepProps,
  SummaryCard,
} from './Summary.tsx';

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

  useReadOut(line?.text ?? null, { quietAtMount: true });

  return (
    <SummaryCard size={wide ? 'wide' : 'page'} height={200} step={step} testID="account.card">
      <View style={styles.you}>
        <CardFace initials={initials(name)} side={face} />
        <View style={styles.words}>
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
      {line?.kind === 'todo' && <OnCard text={line.text} strong />}
      {line?.kind === 'done' && (
        <View style={styles.done} testID="account.said">
          <View style={styles.mark}>
            <StatusMark kind="yes" side={16} ink={tokens.colorInkOnDark} />
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

export function AboutSection({
  name,
  zone,
  nameRef,
  zoneRef,
  onName,
  onZone,
}: {
  name: string;
  zone: ZoneRow;
  nameRef: Ref<ViewInstance>;
  zoneRef: Ref<ViewInstance>;
  onName: () => void;
  onZone: () => void;
}) {
  return (
    <Section title={WORDS.aboutYou}>
      <RowList
        items={[
          {
            key: 'name',
            inset: LEAD_INSET,
            row: (
              <Row
                ref={nameRef}
                title={name}
                line={WORDS.yourName}
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
                title={zoneLabel(zone)}
                line={zoneLine(zone)}
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
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  white: { color: tokens.colorInkOnDark },
  done: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  mark: { marginTop: tokens.spaceHair },
  grow: { flex: 1, minWidth: 0 },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
