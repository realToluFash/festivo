import { keyInGroups } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type ReactNode, type Ref, type RefObject, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CodeField, Field, focusChecked, focusRefused } from '../../components/Field.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { LEAD_INSET, LineIcon } from '../../components/AccountCard.tsx';
import { CODE_FIGURES } from '../../components/AccountVerify.tsx';
import { authenticatorProblem } from './AccountSample.ts';
import { codesLine, type Rules, setupSays, WORDS } from './SecurityModel.ts';
import { AUTHENTICATOR_KEY, qrPath, RECOVERY_CODES } from './SecuritySample.ts';
import {
  FocusedScreen,
  Line,
  OpenRow,
  Row,
  RowList,
  Section,
  TextAction,
} from '../../components/Summary.tsx';

const QR_MODULES = 21;

/** The app's checkbox, as TwoFactorCard draws it; its state is read by the control it sits in. */
export function CheckMark({ on }: { on: boolean }) {
  return (
    <View
      style={[styles.box, on && styles.boxOn]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {on && <Glyph name="tick" size={15} ink={tokens.colorInkOnDark} weight={3} />}
    </View>
  );
}

/** On: the authenticator and the recovery codes, each opening in place. Off: one row that sets it up. */
export function TwoFactorSection({
  on,
  codesLeft,
  rules,
  opened,
  setupRef,
  turnOffRef,
  newCodesRef,
  onSetup,
  onBlock,
  onToggle,
  onTurnOff,
  onNewCodes,
}: {
  on: boolean;
  codesLeft: number;
  rules: Rules;
  opened: string | null;
  setupRef: Ref<ViewInstance>;
  turnOffRef: Ref<ViewInstance>;
  newCodesRef: Ref<ViewInstance>;
  onSetup: () => void;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onTurnOff: () => void;
  onNewCodes: () => void;
}) {
  const shield = <LineIcon name="shield" />;

  if (!on)
    return (
      <Section title={WORDS.twoFactor} foot={WORDS.twoFactorFoot}>
        <Row
          ref={setupRef}
          title={WORDS.authenticator}
          line={WORDS.off}
          lead={shield}
          opens
          onPress={onSetup}
          accessibilityLabel={`${WORDS.authenticator}. ${WORDS.off}`}
          testID="security.authenticator"
        />
      </Section>
    );

  const codes = codesLine(codesLeft);
  const opening = (id: string, title: string, line: string, icon: ReactNode, offer: ReactNode) => ({
    key: id,
    inset: LEAD_INSET,
    selected: opened === id,
    row: (
      <View ref={(block) => onBlock(id, block)} collapsable={false}>
        <OpenRow
          title={title}
          line={line}
          lead={icon}
          weight="semibold"
          lit
          open={opened === id}
          onToggle={() => onToggle(id)}
          accessibilityLabel={`${title}. ${line}`}
          testID={`security.${id}`}
        >
          {offer}
        </OpenRow>
      </View>
    ),
  });

  return (
    <Section title={WORDS.twoFactor}>
      <RowList
        items={[
          opening(
            'authenticator',
            WORDS.authenticator,
            WORDS.authenticatorOn,
            shield,
            rules.twoFactor ? (
              <TextAction
                label={WORDS.turnOffKept}
                off
                onPress={() => undefined}
                consequence={WORDS.turnOffKeptNote}
                testID="security.turnOff"
              />
            ) : (
              <TextAction
                ref={turnOffRef}
                label={WORDS.turnOff}
                removes
                onPress={onTurnOff}
                consequence={WORDS.turnOffNote}
                accessibilityLabel={WORDS.turnOffKept}
                testID="security.turnOff"
              />
            ),
          ),
          opening(
            'codes',
            WORDS.recoveryCodes,
            codes,
            <LineIcon name="lock" />,
            <TextAction
              ref={newCodesRef}
              label={WORDS.newCodes}
              onPress={onNewCodes}
              consequence={WORDS.newCodesNote}
              testID="security.newCodes"
            />,
          ),
        ]}
      />
    </Section>
  );
}

export type TwoFactorStage = 'setup' | 'codes';

/** Set up two-factor, then Save your recovery codes in the same screen; new codes start at the codes. */
export function TwoFactorScreen({
  open,
  start,
  phone,
  opener,
  onClose,
  onTurnedOn,
  onFinished,
}: {
  open: boolean;
  start: TwoFactorStage;
  phone: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onTurnedOn: () => void;
  onFinished: () => void;
}) {
  const [stage, setStage] = useState(start);
  const [saved, setSaved] = useState(false);
  const code = useRef('');
  const field = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const qr = useMemo(() => qrPath(QR_MODULES), []);

  function turnOn(): void {
    const said = setupSays(code.current);
    setError(said);
    if (said == null) {
      onTurnedOn();
      setStage('codes');
    } else if (authenticatorProblem(code.current) === 'wrong') focusRefused(field);
    else focusChecked(field);
  }

  if (stage === 'codes')
    return (
      <FocusedScreen
        open={open}
        title={WORDS.codesTitle}
        verb={{
          label: WORDS.finish,
          on: saved,
          onPress: onFinished,
          testID: 'security.codes.finish',
        }}
        cancels={false}
        onCancel={() => (saved ? onFinished() : undefined)}
        opener={opener}
        testID="security.codes.screen"
      >
        <CodesBody phone={phone} saved={saved} onSaved={setSaved} />
      </FocusedScreen>
    );

  return (
    <FocusedScreen
      open={open}
      title={WORDS.setupTitle}
      verb={{ label: WORDS.setupVerb, on: true, onPress: turnOn, testID: 'security.setup.turnOn' }}
      onCancel={onClose}
      cancelTestID="security.setup.cancel"
      opener={opener}
      testID="security.setup.screen"
    >
      <Text size={15} weight="semibold">
        {WORDS.scan}
      </Text>
      <View
        style={styles.qr}
        accessible
        accessibilityRole="image"
        accessibilityLabel={WORDS.qrLabel}
      >
        <Svg width={168} height={168} viewBox={`0 0 ${QR_MODULES} ${QR_MODULES}`}>
          <Path d={qr} fill={tokens.colorInk} fillRule="evenodd" />
        </Svg>
      </View>
      <Line text={phone ? WORDS.scanPhone : WORDS.scanTablet} />
      <View style={styles.key}>
        <Text
          size={18}
          weight="semibold"
          selectable
          style={styles.keyText}
          testID="security.setup.key"
        >
          {keyInGroups(AUTHENTICATOR_KEY)}
        </Text>
      </View>
      <Field label={WORDS.setupLabel} error={error} help={WORDS.setupHelp}>
        <CodeField
          ref={field}
          wrong={error != null}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="done"
          onChangeText={(text) => {
            code.current = text;
            if (error != null) setError(null);
          }}
          onSubmitEditing={turnOn}
          submitBehavior="submit"
          accessibilityLabel={WORDS.setupLabel}
          testID="security.setup.code"
        />
      </Field>
    </FocusedScreen>
  );
}

function CodesBody({
  phone,
  saved,
  onSaved,
}: {
  phone: boolean;
  saved: boolean;
  onSaved: (saved: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <>
      <Line text={phone ? `${WORDS.codesLead} ${WORDS.codesPhone}` : WORDS.codesLead} />
      <View style={styles.grid}>
        {RECOVERY_CODES.map((each) => (
          <View key={each} style={styles.cell}>
            <Text size={17} weight="semibold" selectable style={styles.code}>
              {each}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.start}>
        <TextAction
          label={copied ? WORDS.copied : WORDS.copyAll}
          glyph={copied ? 'tick' : 'copy'}
          onPress={() => {
            void setStringAsync(RECOVERY_CODES.join('\n')).then(() => setCopied(true));
          }}
          {...(copied ? { consequence: WORDS.copiedLine } : {})}
          testID="security.codes.copy"
        />
      </View>
      <Pressable
        style={styles.checkbox}
        onPress={() => onSaved(!saved)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: saved }}
        accessibilityLabel={WORDS.savedBox}
        testID="security.codes.saved"
      >
        <CheckMark on={saved} />
        <Text size={15.5} weight="medium" accessible={false} style={styles.grow}>
          {WORDS.savedBox}
        </Text>
      </Pressable>
      <Line size={14} text={saved ? WORDS.savedYes : WORDS.savedNot} />
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  start: { alignItems: 'flex-start' },
  qr: {
    alignSelf: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  key: {
    alignItems: 'center',
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  keyText: { ...CODE_FIGURES, letterSpacing: 1.8, lineHeight: 29, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  cell: {
    flexGrow: 1,
    flexBasis: '45%',
    height: tokens.sizeHit,
    borderRadius: 12,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { ...CODE_FIGURES, letterSpacing: 1.4 },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    minHeight: tokens.sizeHit,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
});
