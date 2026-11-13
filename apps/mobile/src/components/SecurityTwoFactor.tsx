import { keyInGroups } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type ReactNode, type Ref, type RefObject, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { codesLine, type SecurityRules } from '../kit/securityPage.ts';
import { openInAuthenticator } from '../authenticatorApp.ts';
import { typedCodeProblem } from '../kit/twoFactor.ts';
import { tokens } from '../theme/tokens.ts';
import { LEAD_INSET, LineIcon } from './AccountCard.tsx';
import { CODE_FIGURES } from './AccountVerify.tsx';
import { SecondaryButton } from './Buttons.tsx';
import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
} from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import {
  FocusedScreen,
  Line,
  OpenRow,
  Row,
  RowList,
  Section,
  SectionFailed,
  TextAction,
} from './Summary.tsx';
import { Text } from './Text.tsx';

/** The app's checkbox; its state is read by the control it sits in. */
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
  email,
  rules,
  opened,
  error,
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
  email: string;
  rules: SecurityRules;
  opened: string | null;
  /** What the server said to the opened row's offer. */
  error: string | null;
  setupRef: Ref<ViewInstance>;
  turnOffRef: Ref<ViewInstance>;
  newCodesRef: Ref<ViewInstance>;
  onSetup: () => void;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onTurnOff: () => void;
  onNewCodes: () => void;
}) {
  const { t } = useTranslation();
  const shield = <LineIcon name="shield" />;
  const authenticator = t('security.authenticator');

  if (!on)
    return (
      <Section title={t('twoFactorCard.title')} foot={t('security.twoFactorFoot')}>
        <Row
          ref={setupRef}
          title={authenticator}
          line={t('twoFactorCard.off')}
          lead={shield}
          opens
          onPress={onSetup}
          accessibilityLabel={`${authenticator}. ${t('twoFactorCard.off')}`}
          testID="security.authenticator"
        />
      </Section>
    );

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
          {opened === id && error != null && <FieldError message={error} />}
        </OpenRow>
      </View>
    ),
  });

  return (
    <Section title={t('twoFactorCard.title')}>
      <RowList
        items={[
          opening(
            'authenticator',
            authenticator,
            t('security.authenticatorOn'),
            shield,
            rules.twoFactor != null ? (
              <TextAction
                label={t('twoFactorCard.turnOff')}
                off
                onPress={() => undefined}
                consequence={t('twoFactorCard.keptByRule', { organisation: rules.twoFactor })}
                testID="security.turnOff"
              />
            ) : (
              <TextAction
                ref={turnOffRef}
                label={t('twoFactorCard.turnOffAsks')}
                removes
                onPress={onTurnOff}
                consequence={t('security.turnOffNote', { email })}
                accessibilityLabel={t('twoFactorCard.turnOff')}
                testID="security.turnOff"
              />
            ),
          ),
          opening(
            'codes',
            t('twoFactorCard.recoveryCodes'),
            codesLine(codesLeft, t),
            <LineIcon name="lock" />,
            <TextAction
              ref={newCodesRef}
              label={t('twoFactorCard.makeNewCodes')}
              onPress={onNewCodes}
              consequence={t('twoFactorCard.newWarningBody')}
              testID="security.newCodes"
            />,
          ),
        ]}
      />
    </Section>
  );
}

/** What the authenticator was given to scan, drawn in the screen's frame, its key to type instead, and the link that hands it over. */
export interface Enrolment {
  qr: ReactNode;
  secret: string;
  otpauthUri: string;
}

/** Turning on resolves to the codes, or to why the code was not taken. */
export type TurningOn = (code: string) => Promise<{ codes: readonly string[] } | { error: string }>;

/** Set up two-factor, then Save your recovery codes in the same screen; new codes start at the codes. */
export function TwoFactorScreen({
  open,
  enrolment,
  startCodes,
  phone,
  opener,
  onClose,
  onTurnOn,
  onFinished,
  takesLinks,
}: {
  open: boolean;
  /** Null while it is fetched; once it could not be, its failure takes the key's and the field's place. */
  enrolment: Enrolment | { retry: () => void } | null;
  /** New codes already made: the screen starts at them. */
  startCodes: readonly string[] | null;
  phone: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onTurnOn: TurningOn;
  onFinished: () => void;
  /** Some app on the device opens the enrolment's otpauth:// link; with none, the step has no Add to my authenticator app. */
  takesLinks: boolean;
}) {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<readonly string[] | null>(startCodes);
  const [saved, setSaved] = useState(false);
  const code = useRef('');
  const field = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function turnOn(): Promise<void> {
    if (checking) return;
    const problem = typedCodeProblem('app', code.current);
    if (problem != null) {
      setError(t(problem));
      focusChecked(field);
      return;
    }
    keysStayDown();
    setChecking(true);
    const answer = await onTurnOn(code.current);
    setChecking(false);
    if ('codes' in answer) {
      setCodes(answer.codes);
      return;
    }
    setError(answer.error);
    focusRefused(field);
  }

  if (codes != null)
    return (
      <FocusedScreen
        open={open}
        title={t('twoFactorCard.saveTitle')}
        verb={{
          label: t('twoFactorCard.finish'),
          on: saved,
          onPress: onFinished,
          testID: 'security.codes.finish',
        }}
        cancels={false}
        onCancel={() => (saved ? onFinished() : undefined)}
        opener={opener}
        testID="security.codes.screen"
      >
        <CodesBody codes={codes} phone={phone} saved={saved} onSaved={setSaved} />
      </FocusedScreen>
    );

  const ready = enrolment != null && !('retry' in enrolment) ? enrolment : null;

  return (
    <FocusedScreen
      open={open}
      title={t('security.setupTitle')}
      verb={{
        label: t('security.setupVerb'),
        on: ready != null,
        busy: checking,
        onPress: () => void turnOn(),
        testID: 'security.setup.turnOn',
      }}
      waits={checking}
      onCancel={onClose}
      cancelTestID="security.setup.cancel"
      opener={opener}
      testID="security.setup.screen"
    >
      {enrolment != null && 'retry' in enrolment ? (
        <SectionFailed
          title={t('twoFactorCard.failedTitle')}
          line={t('twoFactorCard.failedBody')}
          onRetry={enrolment.retry}
          takesFocus
          testID="security.setup.retry"
        />
      ) : (
        <>
          <Text size={15} weight="semibold">
            {t('twoFactorCard.scan')}
          </Text>
          <View
            style={styles.qr}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('twoFactorCard.qrAlt')}
          >
            <View style={styles.qrSide}>{ready?.qr}</View>
          </View>
          <Line text={phone ? t('twoFactorCard.phoneCantScan') : t('twoFactorCard.cantScan')} />
          <View style={styles.key}>
            <Text
              size={18}
              weight="semibold"
              selectable
              style={styles.keyText}
              testID="security.setup.key"
            >
              {ready == null ? ' ' : keyInGroups(ready.secret)}
            </Text>
          </View>
          {ready != null && takesLinks && (
            <SecondaryButton
              label={t('twoFactorCard.addToApp')}
              stacked
              onPress={() => openInAuthenticator(ready.otpauthUri)}
              testID="security.setup.addToApp"
            />
          )}
          <Field
            label={t('twoFactorCard.enterCode')}
            error={error}
            help={t('twoFactorCard.staysOff')}
          >
            <CodeField
              ref={field}
              wrong={error != null}
              submitting={checking}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="done"
              onChangeText={(text) => {
                code.current = text;
                if (error != null) setError(null);
              }}
              onSubmitEditing={() => void turnOn()}
              submitBehavior="submit"
              accessibilityLabel={t('twoFactorCard.enterCode')}
              testID="security.setup.code"
            />
          </Field>
        </>
      )}
    </FocusedScreen>
  );
}

/** The QR's drawn side inside its frame. */
export const QR_SIDE = 168;

function CodesBody({
  codes,
  phone,
  saved,
  onSaved,
}: {
  codes: readonly string[];
  phone: boolean;
  saved: boolean;
  onSaved: (saved: boolean) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copiedAll = t('twoFactorCard.copiedAll', { count: codes.length });
  useReadOut(copied ? copiedAll : null);

  return (
    <>
      <Line
        text={
          phone
            ? `${t('twoFactorCard.saveIntro')} ${t('twoFactorCard.phoneKeepElsewhere')}`
            : t('twoFactorCard.saveIntro')
        }
      />
      <View style={styles.grid}>
        {codes.map((each) => (
          <View key={each} style={styles.cell}>
            <Text size={17} weight="semibold" selectable style={styles.code}>
              {each}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.start}>
        <TextAction
          label={copied ? t('twoFactorCard.copied') : t('twoFactorCard.copyAll')}
          glyph={copied ? 'tick' : 'copy'}
          onPress={() => {
            void setStringAsync(codes.join('\n')).then(() => setCopied(true));
          }}
          {...(copied ? { consequence: copiedAll } : {})}
          testID="security.codes.copy"
        />
      </View>
      <Pressable
        style={styles.checkbox}
        onPress={() => onSaved(!saved)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: saved }}
        accessibilityLabel={t('twoFactorCard.savedThem')}
        testID="security.codes.saved"
      >
        <CheckMark on={saved} />
        <Text size={15.5} weight="medium" accessible={false} style={styles.grow}>
          {t('twoFactorCard.savedThem')}
        </Text>
      </Pressable>
      <Line
        size={14}
        text={saved ? t('twoFactorCard.finishReady') : t('twoFactorCard.finishLocked')}
      />
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
  qrSide: { width: QR_SIDE, height: QR_SIDE },
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
