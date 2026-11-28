import { setStringAsync } from 'expo-clipboard';
import type { ReactNode, RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { SheetBody } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import {
  GlassTag,
  Row,
  RowList,
  ShapeMark,
  TextAction,
  TurningMark,
} from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { Code, TagRow } from './DataParts.tsx';
import {
  type CardMark,
  type Came,
  type Protocol,
  protocolWord,
  SOIRELY_VALUES,
  type StandingRow,
} from './SingleSignOnModel.ts';
import { SSO_WORDS as W } from './SingleSignOnWords.ts';

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The card's state as a shape and its word, in glass on Confetti. */
export function CardTag({ mark, word }: { mark: CardMark; word: string }) {
  const ink = tokens.colorInkOnDark;
  const shape =
    mark === 'turning' ? (
      <TurningMark side={13} />
    ) : mark === 'alert' ? (
      <View {...hidden}>
        <Glyph name="alert" size={14} ink={ink} weight={2.4} />
      </View>
    ) : mark === 'lock' ? (
      <View {...hidden}>
        <Glyph name="lock" size={14} ink={ink} weight={2.4} />
      </View>
    ) : (
      <ShapeMark kind={mark} side={13} ink={ink} />
    );

  return <GlassTag word={word} shape={shape} testID="sso.card.tag" />;
}

/** The two ways a provider connects, as two radio cards. */
export function ProtocolCards({
  picked,
  off,
  onPick,
}: {
  picked: Protocol | null;
  off: boolean;
  onPick: (protocol: Protocol) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.cards}>
      {(['saml', 'oidc'] as const).map((protocol) => {
        const on = picked === protocol;

        return (
          <Pressable
            key={protocol}
            onPress={() => onPick(protocol)}
            disabled={off}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: off }}
            accessibilityLabel={`${W[protocol].title}. ${W[protocol].line}`}
            style={({ pressed }) => [
              styles.card,
              on && styles.cardOn,
              pressed && !off && styles.pressed,
            ]}
            testID={`sso.protocol.${protocol}`}
          >
            <View style={styles.radio} {...hidden}>
              <RadioMark on={on} />
            </View>
            <View style={styles.words}>
              <Text size={16} weight="semibold" accessible={false}>
                {W[protocol].title}
              </Text>
              <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
                {W[protocol].line}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** What Soirely gives the provider: each value in the code face, with Copy, which says Copied only once the clipboard has it. */
export function OurValues({
  protocol,
  tell,
}: {
  protocol: Protocol;
  tell: (words: string) => void;
}) {
  const values =
    protocol === 'saml'
      ? [
          { label: W.entityId, value: SOIRELY_VALUES.entityId },
          { label: W.replyUrl, value: SOIRELY_VALUES.replyUrl },
          { label: W.metadataUrl, value: SOIRELY_VALUES.metadataUrl },
        ]
      : [{ label: W.redirectUrl, value: SOIRELY_VALUES.redirectUrl }];
  const copy = (value: string) => {
    setStringAsync(value).then(
      (done) => tell(done === false ? W.copyFailed : W.copied),
      () => tell(W.copyFailed),
    );
  };

  return (
    <View style={styles.values}>
      <Text size={15} weight="bold" accessibilityRole="header">
        {values.length === 1 ? W.giveThis : W.giveThese}
      </Text>
      <RowList
        items={values.map(({ label, value }) => ({
          key: label,
          row: (
            <View style={styles.value}>
              <View style={styles.words}>
                <Text size={14} weight="medium" style={styles.secondary}>
                  {label}
                </Text>
                <Code text={value} size={14} />
              </View>
              <TextAction
                label={W.copy}
                glyph="copy"
                onPress={() => copy(value)}
                accessibilityLabel={W.copyLabel(label)}
                testID={`sso.copy.${label}`}
              />
            </View>
          ),
        }))}
      />
    </View>
  );
}

/** Where the product hands over to the system browser (RFC 8252): a sheet on a phone, centred upright, docked on its side. */
export function BrowserStandIn({
  open,
  title,
  name,
  opener,
  stop,
  checks = false,
  onCame,
  onStop,
}: {
  open: boolean;
  title: string;
  name: string;
  opener: RefObject<ScreenReaderTarget | null>;
  stop: string;
  checks?: boolean;
  onCame: (came: Came) => void;
  onStop: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onStop}
      scrimLabel={stop}
      opener={opener}
      headingTakesFocus
      docked
      testID="sso.browser"
    >
      <SheetBody title={title} close={stop} onClose={onStop} closeTestID="sso.browser.stop">
        <DemoOnly title={W.browserDemo(name)}>
          <SecondaryButton label={W.worked} onPress={() => onCame('worked')} testID="sso.worked" />
          <SecondaryButton
            label={W.didNotWork}
            onPress={() => onCame('failed')}
            testID="sso.didNotWork"
          />
          {checks && (
            <SecondaryButton
              label={W.failedChecks}
              onPress={() => onCame('checksFailed')}
              testID="sso.failedChecks"
            />
          )}
        </DemoOnly>
      </SheetBody>
    </Sheet>
  );
}

/** A refusal under the control it refuses, with the one step that lets it go ahead. */
export function Refusal({
  words,
  step,
  testID,
}: {
  words: string;
  step?: { label: string; onPress: () => void } | null;
  testID: string;
}) {
  return (
    <View style={styles.refusal} testID={testID}>
      <View style={styles.refusalLine} accessibilityRole="alert">
        <View style={styles.refusalMark} {...hidden}>
          <Glyph name="alert" size={16} ink={tokens.colorBrokenText} weight={2.4} />
        </View>
        <Text size={15} weight="medium" style={styles.broken}>
          {words}
        </Text>
      </View>
      {step != null && (
        <TextAction label={step.label} onPress={step.onPress} testID={`${testID}.step`} />
      )}
    </View>
  );
}

/** Single sign-on where it stands, as a row of Sign-in rules: the mark and its word, the line, and it opens the page. */
export function StandingLine({ row, onPress }: { row: StandingRow; onPress: () => void }) {
  const { tag } = row;

  if (tag.kind === 'lock')
    return (
      <TagRow
        title={W.rowTitle}
        tag={{ kind: 'lock', word: tag.word }}
        line={row.line}
        opens
        onPress={onPress}
        testID="signInRules.sso"
      />
    );

  return (
    <Row
      title={W.rowTitle}
      tag={{ kind: tag.kind, word: tag.word }}
      line={row.line}
      opens
      onPress={onPress}
      testID="signInRules.sso"
    />
  );
}

export function ProtocolLine({ protocol, source }: { protocol: Protocol; source: string }) {
  return (
    <View style={styles.words}>
      <Text size={14} weight="medium" style={styles.secondary}>
        {protocolWord(protocol)}
      </Text>
      <Code text={source} size={14} />
    </View>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

const styles = StyleSheet.create({
  cards: { gap: tokens.spaceSm },
  card: {
    minHeight: tokens.sizeHit + tokens.spaceXl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceMd,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  cardOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccentTint },
  radio: { alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0, gap: 2 },
  secondary: { color: tokens.colorInkSecondary },
  broken: { flex: 1, color: tokens.colorBrokenText },
  pressed: { opacity: tokens.opacityPressed },
  values: { gap: tokens.spaceXs },
  value: {
    minHeight: tokens.sizeListRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
  },
  refusal: { gap: tokens.spaceXxs },
  refusalLine: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  refusalMark: { paddingTop: 2 },
  stack: { gap: tokens.spaceLg },
});
