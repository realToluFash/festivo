import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { PassTicket, PrintRecord, Tone } from './PassModel.ts';
import { PW } from './PassWords.ts';

const TONE: Record<Tone, string> = {
  chicken: tokens.optionGreen,
  fish: tokens.optionBlue,
  suya: tokens.optionAmber,
  tofu: tokens.optionPurple,
  none: tokens.optionNone,
};
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

export function PrinterGlyph({
  side = 18,
  ink = tokens.colorInkSecondary,
}: {
  side?: number;
  ink?: string;
}) {
  return (
    <View {...hidden}>
      <Svg
        width={side}
        height={side}
        viewBox="0 0 24 24"
        fill="none"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M6 9V2h12v7" />
        <Path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <Path d="M6 14h12v8H6z" />
      </Svg>
    </View>
  );
}

function WarnGlyph() {
  return (
    <View {...hidden}>
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tokens.colorBroken}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <Path d="M12 9v4" />
        <Path d="M12 17h.01" />
      </Svg>
    </View>
  );
}

export function InfoGlyph() {
  return (
    <View {...hidden}>
      <Svg
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tokens.colorInkSecondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Circle cx={12} cy={12} r={10} />
        <Path d="M12 16v-4" />
        <Path d="M12 8h.01" />
      </Svg>
    </View>
  );
}

export function NewWords() {
  return (
    <View style={styles.newWords}>
      <Text size={tokens.typePill.size} weight="semibold" style={styles.label}>
        New words · [en]
      </Text>
    </View>
  );
}

/** One ticket as page 35 draws it, with sc-4018's Print beside Plates up and the line saying what this device sent. */
export function TicketCard({
  ticket,
  record,
  stale,
  onPrint,
}: {
  ticket: PassTicket;
  record: PrintRecord;
  stale: boolean;
  onPrint: () => void;
}) {
  const late = ticket.wait >= 10;
  const printedAt = record.printed[ticket.table];
  const failedAt = printedAt == null ? record.failed[ticket.table] : undefined;

  return (
    <View style={[styles.card, late && styles.cardLate]} testID={`pass.ticket.${ticket.table}`}>
      <View style={[styles.head, late && styles.headLate]}>
        <Text size={34} weight="bold" style={styles.table}>
          {ticket.table}
        </Text>
        <Text size={17} weight="semibold" style={styles.label}>
          Main · {ticket.covers} covers
        </Text>
        <View style={styles.grow} />
        <View
          style={[
            styles.dot,
            { backgroundColor: late ? tokens.colorAttention : tokens.colorTrack },
          ]}
          {...hidden}
        />
        <Text size={17} weight="bold" style={late ? styles.attention : styles.label}>
          {late ? `Late · ${ticket.wait} min` : `${ticket.wait} min`}
        </Text>
      </View>
      {ticket.allergies.length > 0 && (
        <View style={styles.allergy}>
          <View style={styles.allergyMark} {...hidden}>
            <Text size={15} weight="bold" style={styles.broken} accessible={false}>
              !
            </Text>
          </View>
          <View style={styles.shrink}>
            <Text size={17} weight="bold" style={[styles.broken, styles.caps]}>
              {PW.allergy}
            </Text>
            {ticket.allergies.map((line) => (
              <Text key={line} size={17} weight="semibold">
                {line}
              </Text>
            ))}
          </View>
        </View>
      )}
      <View style={styles.lines}>
        {ticket.lines.map((line, index) => (
          <View key={`${line.dish}.${index}`} style={styles.line}>
            <View style={[styles.dot, { backgroundColor: TONE[line.tone] }]} {...hidden} />
            <Text size={17} weight="bold">
              {line.count} ×
            </Text>
            <Text size={17} weight="medium" style={styles.dish}>
              {line.dish}
            </Text>
            {line.flag != null && (
              <View style={[styles.flag, line.preference ? styles.flagPref : styles.flagAllergy]}>
                <Text
                  size={17}
                  weight="bold"
                  style={line.preference ? styles.label : styles.broken}
                >
                  {line.preference ? '· ' : '! '}
                  {line.flag}
                </Text>
              </View>
            )}
          </View>
        ))}
        {ticket.preference != null && (
          <View style={styles.pref}>
            <View style={styles.prefTag}>
              <Text size={14} weight="semibold" style={styles.label}>
                {PW.preference}
              </Text>
            </View>
            <Text size={17} style={[styles.label, styles.shrink]}>
              {ticket.preference}
            </Text>
          </View>
        )}
      </View>
      {printedAt != null && (
        <View style={styles.printed} testID={`pass.printed.${ticket.table}`}>
          <PrinterGlyph />
          <Text size={17} weight="semibold" style={styles.label}>
            {PW.printed(printedAt)}
          </Text>
        </View>
      )}
      {failedAt != null && (
        <View style={styles.failed} testID={`pass.failed.${ticket.table}`}>
          <WarnGlyph />
          <Text size={17} weight="bold">
            {PW.printFailed(failedAt)}
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.platesUp, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={() => undefined}
          testID={`pass.up.${ticket.table}`}
        >
          <Text size={17} weight="bold" style={styles.onAccent}>
            {PW.platesUp}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.printPill, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={PW.printTicketAria(ticket.table)}
          onPress={onPrint}
          testID={`pass.print.${ticket.table}`}
        >
          <PrinterGlyph />
          <Text size={17} weight="semibold" accessible={false}>
            {PW.print}
          </Text>
        </Pressable>
        {stale && (
          <Text size={13} weight="semibold" style={styles.attention}>
            {PW.asOf}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 356,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusCardDesktop,
    overflow: 'hidden',
  },
  cardLate: { borderWidth: 2, borderColor: tokens.colorAttention },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
    backgroundColor: tokens.colorInset,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  headLate: { backgroundColor: tokens.colorAttentionTint },
  table: { fontVariant: ['tabular-nums'] },
  grow: { flex: 1 },
  shrink: { flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  broken: { color: tokens.colorBroken },
  caps: { textTransform: 'uppercase', letterSpacing: 1 },
  onAccent: { color: tokens.colorInkOnDark },
  allergy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
    borderBottomWidth: 1.5,
    borderBottomColor: tokens.colorBroken,
  },
  allergyMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: tokens.colorBroken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lines: { paddingHorizontal: tokens.spaceXl, paddingVertical: tokens.spaceXxs },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: 40,
    paddingVertical: tokens.spaceXxs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorNeutralFill,
  },
  dish: { flex: 1, minWidth: 120 },
  flag: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderRadius: 15,
    borderWidth: 1.5,
  },
  flagAllergy: { borderColor: tokens.colorBroken },
  flagPref: { borderColor: tokens.colorMarkEmpty },
  pref: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spaceSm,
    minHeight: 40,
  },
  prefTag: {
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: 13,
    backgroundColor: tokens.colorNeutralFill,
  },
  printed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: 36,
    paddingTop: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceXl,
  },
  failed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: 40,
    marginTop: tokens.spaceSm,
    marginHorizontal: tokens.spaceXl,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorBroken,
    borderRadius: tokens.radiusRow,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceMd,
    paddingBottom: tokens.spacePillEnd,
    paddingHorizontal: tokens.spaceXl,
  },
  platesUp: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: tokens.sizeHitPhonePrimary,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentHover,
  },
  printPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHitPhonePrimary,
    paddingHorizontal: 18,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  pressed: { opacity: tokens.opacityPressed },
  newWords: {
    alignSelf: 'flex-start',
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
    borderRadius: 11,
  },
});
