import { keyInGroups } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type RefObject, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CodeField, Field } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { SAMPLE } from '../samples.ts';
import {
  CODE_FIGURES,
  Lead,
  Note,
  RowPill,
  StateMark,
  Step,
  StepPill,
  SubHead,
  WhiteBox,
} from './AccountParts.tsx';
import { authenticatorProblem, secondFactorProblem } from './AccountSample.ts';
import { Card, CardHead, Pair, Pill } from './parts.tsx';
import { type SettingsLayout, YOU } from './sample.ts';
import { AUTHENTICATOR_KEY, qrPath, RECOVERY_CODES } from './SecuritySample.ts';

export type TwoFactorStage = 'rest' | 'setup' | 'newCodes' | 'turningOff';

const SETUP_LABEL = 'Enter the 6-digit code the app shows';
const OFF_LABEL = 'Code';
const QR_MODULES = 21;
const TYPE_BODY = 15;
const noOpener: RefObject<null> = { current: null };

export function TwoFactorCard({
  layout,
  on,
  onTurned,
  rule,
  startStage,
  startSaving,
}: {
  layout: SettingsLayout;
  on: boolean;
  onTurned: (on: boolean) => void;
  rule: boolean;
  startStage: TwoFactorStage;
  startSaving: boolean;
}) {
  const [stage, setStage] = useState<TwoFactorStage>(startStage);
  const [saving, setSaving] = useState(startSaving);
  const [unused, setUnused] = useState(startSaving ? RECOVERY_CODES.length : 8);
  const [refused, setRefused] = useState(rule);
  const wide = layout === 'portrait';
  const sheet = (
    <Sheet
      open={saving}
      onClose={() => setSaving(false)}
      opener={noOpener}
      headingTakesFocus
      testID="demo.security.codesSheet"
    >
      {saving && <SavingCodes phone={layout === 'phone'} onFinish={() => setSaving(false)} />}
    </Sheet>
  );

  function codesMade(): void {
    setUnused(RECOVERY_CODES.length);
    setStage('rest');
    setSaving(true);
  }

  if (stage === 'setup')
    return (
      <SettingUp
        layout={layout}
        onCancel={() => setStage('rest')}
        onMatched={() => {
          onTurned(true);
          codesMade();
        }}
      />
    );

  if (stage === 'turningOff')
    return (
      <TurningOff
        layout={layout}
        onKeep={() => setStage('rest')}
        onOff={() => {
          onTurned(false);
          setStage('rest');
        }}
      />
    );

  if (!on)
    return (
      <Card>
        <CardHead title="Two-factor authentication" right={<StateMark on={false} word="Off" />} />
        <Lead text="Asks for a code from an authenticator app every time you sign in, whether with your password, Google or Apple. Your account holds your clients’ guest lists; this keeps a stolen password from being enough." />
        <StepPill layout={layout} label="Turn on two-factor" onPress={() => setStage('setup')} />
        {sheet}
      </Card>
    );

  const codes = (
    <View style={wide ? styles.codesWide : styles.codesStacked}>
      <View style={styles.grow}>
        <Text size={15.5} weight="semibold">
          Recovery codes
        </Text>
        <Note text={`${unused} of ${RECOVERY_CODES.length} unused · each works once`} />
      </View>
      <View style={styles.start}>
        <RowPill label="Make new codes" onPress={() => setStage('newCodes')} />
      </View>
    </View>
  );

  return (
    <Card>
      <CardHead title="Two-factor authentication" right={<StateMark on word="On" />} />
      <Lead text="Every sign-in asks for a code from your authenticator app, with your password, Google or Apple." />
      {stage === 'newCodes' ? (
        <Step>
          <SubHead text="Make new recovery codes?" />
          <Notice
            tone="attention"
            mark="!"
            title="Your current codes stop working"
            body="New codes replace every code you have now, used or not, as soon as they are made."
          />
          <Pair
            layout={layout}
            dismiss={
              <StepPill
                layout={layout}
                label="Keep current codes"
                kind="quiet"
                onPress={() => setStage('rest')}
              />
            }
            confirm={<StepPill layout={layout} label="Make new codes" onPress={codesMade} />}
          />
        </Step>
      ) : (
        <WhiteBox>{codes}</WhiteBox>
      )}
      <View style={styles.start}>
        <RowPill
          label={rule ? 'Turn off two-factor' : 'Turn off two-factor…'}
          kind="dangerQuiet"
          onPress={() => (rule ? setRefused(true) : setStage('turningOff'))}
        />
      </View>
      {refused && (
        <Notice
          tone="attention"
          mark="!"
          body={`${YOU.organisation} requires two-factor, so you cannot turn it off.`}
        />
      )}
      {sheet}
    </Card>
  );
}

function SettingUp({
  layout,
  onCancel,
  onMatched,
}: {
  layout: SettingsLayout;
  onCancel: () => void;
  onMatched: () => void;
}) {
  const phone = layout === 'phone';
  const code = useRef('');
  const [error, setError] = useState<string | null>(null);
  const qr = useMemo(() => qrPath(QR_MODULES), []);

  function check(): void {
    const problem = authenticatorProblem(code.current);
    if (problem == null) {
      onMatched();
      return;
    }
    setError(
      problem === 'blank'
        ? 'Enter the 6-digit code from your app.'
        : problem === 'short'
          ? 'The code is 6 digits.'
          : 'That code does not match. Check the app was set up with the key above, then enter the code it shows now.',
    );
  }

  return (
    <Card>
      <CardHead
        title={
          phone ? 'Add Soirely to your authenticator app' : 'Turn on two-factor authentication'
        }
      />
      <Text size={TYPE_BODY} weight="semibold">
        Scan this code with your authenticator app
      </Text>
      <View
        style={styles.qr}
        accessible
        accessibilityRole="image"
        accessibilityLabel="QR code for your authenticator app"
      >
        <Svg width={168} height={168} viewBox={`0 0 ${QR_MODULES} ${QR_MODULES}`}>
          <Path d={qr} fill={tokens.colorInk} fillRule="evenodd" />
        </Svg>
      </View>
      <Lead
        text={
          phone
            ? 'Scan the code from another screen, or enter this key in the app.'
            : 'Can’t scan it? Enter this key in the app instead.'
        }
      />
      <WhiteBox>
        <Text size={18} weight="semibold" selectable style={styles.key}>
          {keyInGroups(AUTHENTICATOR_KEY)}
        </Text>
      </WhiteBox>
      <Field
        label={SETUP_LABEL}
        error={error}
        help="Two-factor stays off until the code matches, so a setup mistake cannot lock you out."
      >
        <CodeField
          wrong={error != null}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="done"
          onChangeText={(text) => {
            code.current = text;
            if (error != null) setError(null);
          }}
          onSubmitEditing={check}
          submitBehavior="submit"
          accessibilityLabel={SETUP_LABEL}
          testID="demo.security.setupCode"
        />
      </Field>
      <Pair
        layout={layout}
        dismiss={<StepPill layout={layout} label="Cancel" kind="secondary" onPress={onCancel} />}
        confirm={<StepPill layout={layout} label="Check the code" onPress={check} />}
      />
    </Card>
  );
}

function TurningOff({
  layout,
  onKeep,
  onOff,
}: {
  layout: SettingsLayout;
  onKeep: () => void;
  onOff: () => void;
}) {
  const code = useRef('');
  const [error, setError] = useState<string | null>(null);

  function turnOff(): void {
    const problem = secondFactorProblem(code.current);
    if (problem == null) {
      onOff();
      return;
    }
    setError(
      problem === 'blank'
        ? 'Enter a code from your app, or a recovery code.'
        : 'That code did not work. Enter the code your app shows now, or an unused recovery code.',
    );
  }

  return (
    <Card>
      <CardHead title="Turn off two-factor authentication" />
      <Lead text="Enter a code from your authenticator app, or one of your recovery codes." />
      <Field
        label={OFF_LABEL}
        error={error}
        help={`We will email ${SAMPLE.email} to say it was turned off.`}
      >
        <CodeField
          takesRecoveryCode
          wrong={error != null}
          autoFocus
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="done"
          onChangeText={(text) => {
            code.current = text;
            if (error != null) setError(null);
          }}
          onSubmitEditing={turnOff}
          submitBehavior="submit"
          accessibilityLabel={OFF_LABEL}
          testID="demo.security.offCode"
        />
      </Field>
      <Pair
        layout={layout}
        dismiss={<StepPill layout={layout} label="Keep it on" kind="quiet" onPress={onKeep} />}
        confirm={<StepPill layout={layout} label="Turn it off" kind="danger" onPress={turnOff} />}
      />
    </Card>
  );
}

/** The recovery codes, once: the app's Sheet, a bottom sheet on a phone and a centred card on a tablet. */
function SavingCodes({ phone, onFinish }: { phone: boolean; onFinish: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetContent}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
          Save your recovery codes
        </Text>
        <Text size={TYPE_BODY} weight="medium" style={styles.secondary}>
          {phone
            ? 'If you lose your authenticator, each of these signs you in once. This is the only time they are shown. Keep them somewhere other than this phone.'
            : 'If you lose your authenticator, each of these signs you in once. This is the only time they are shown.'}
        </Text>
        <View style={styles.grid}>
          {RECOVERY_CODES.map((code) => (
            <View key={code} style={styles.cell}>
              <Text size={17} weight="semibold" selectable style={styles.code}>
                {code}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.start}>
          <RowPill
            label={copied ? 'Copied' : 'Copy all'}
            glyph={copied ? 'tick' : 'copy'}
            onPress={() => {
              void setStringAsync(RECOVERY_CODES.join('\n')).then(() => setCopied(true));
            }}
            testID="demo.security.copyAll"
          />
        </View>
        {copied && <Note text={`All ${RECOVERY_CODES.length} codes are on your clipboard.`} />}
        <Pressable
          style={styles.checkbox}
          onPress={() => setSaved((now) => !now)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saved }}
          testID="demo.security.savedCodes"
        >
          <View
            style={[styles.box, saved && styles.boxOn]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {saved && <Glyph name="tick" size={15} ink={tokens.colorInkOnDark} weight={3} />}
          </View>
          <Text size={15.5} weight="medium" style={styles.grow}>
            I have saved these codes somewhere safe
          </Text>
        </Pressable>
        <Note
          text={
            saved
              ? 'Two-factor is on. Finish to go back to Security.'
              : 'Two-factor is on. Confirm you have saved the codes to leave this step.'
          }
        />
      </ScrollView>
      <View style={[styles.sheetFooter, !phone && styles.footerEnd]}>
        <Pill
          label="Finish"
          kind={saved ? 'primary' : 'off'}
          full={phone}
          onPress={onFinish}
          testID="demo.security.finish"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  start: { alignItems: 'flex-start' },
  secondary: { color: tokens.colorInkSecondary },
  codesWide: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXl },
  codesStacked: { gap: tokens.spaceLg },
  qr: {
    alignSelf: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  key: { ...CODE_FIGURES, letterSpacing: 1.8, lineHeight: 29 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  cell: {
    flexGrow: 1,
    flexBasis: '45%',
    height: tokens.sizeHit,
    borderRadius: tokens.spaceLg,
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
  sheetBody: { flexShrink: 1 },
  sheetContent: {
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
  },
  sheetFooter: {
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.spaceSm,
    paddingBottom: tokens.space3xl,
  },
  footerEnd: { alignItems: 'flex-end' },
});
