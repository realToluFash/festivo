import { keyInGroups } from '@soirely/domain';
import { setStringAsync } from 'expo-clipboard';
import { type RefObject, useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CODE_FIGURES } from '../../components/AccountVerify.tsx';
import { SecondaryButton } from '../../components/Buttons.tsx';
import {
  CodeField,
  Field,
  focusChecked,
  focusRefused,
  keysStayDown,
} from '../../components/Field.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import {
  CheckMark,
  type Enrolment,
  QR_SIDE,
  type TurningOn,
} from '../../components/SecurityTwoFactor.tsx';
import { FocusedScreen, Line, SectionFailed, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { typedCodeProblem } from '../../kit/twoFactor.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';

/** The enrolment with the link the API already sends beside the secret and the QR. */
export type DemoEnrolment = Enrolment & { otpauthUri: string };

/** The product's TwoFactorScreen with Add to my authenticator app under the key, where a device has an app for otpauth:// links. */
export function DemoTwoFactorScreen({
  open,
  enrolment,
  startCodes,
  phone,
  opener,
  onClose,
  onTurnOn,
  onFinished,
  takesLinks,
  startTyped = '',
  startError = null,
  startHanded = false,
}: {
  open: boolean;
  /** Null while it is fetched; once it could not be, its failure takes the key's and the field's place. */
  enrolment: DemoEnrolment | { retry: () => void } | null;
  /** New codes already made: the screen starts at them. */
  startCodes: readonly string[] | null;
  phone: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onTurnOn: TurningOn;
  onFinished: () => void;
  /** Some app on the device opens otpauth:// links; with none, the step is the product's as it is. */
  takesLinks: boolean;
  /** What the code field held when the step was last seen, as when coming back from the authenticator. */
  startTyped?: string;
  startError?: string | null;
  startHanded?: boolean;
}) {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<readonly string[] | null>(startCodes);
  const [saved, setSaved] = useState(false);
  const code = useRef(startTyped);
  const field = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(startError);
  const [checking, setChecking] = useState(false);
  const [handed, setHanded] = useState(startHanded);

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
              label="Add to my authenticator app"
              stacked
              onPress={() => setHanded(true)}
              testID="security.setup.addToApp"
            />
          )}
          {ready != null && takesLinks && handed && (
            <DemoOnly
              title={`Stand-in for the authenticator. The product opens ${ready.otpauthUri} in the app that takes otpauth:// links (Passwords on iOS; the authenticator, or Android’s chooser), offering Soirely · ${SAMPLE.email} with the key above. The demo opens nothing and copies nothing. The code that entry would show: ${SAMPLE.authenticator}.`}
            >
              {null}
            </DemoOnly>
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
              defaultValue={startTyped}
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
});
