import { type SecondFactor } from '@soirely/api-client';
import { formatTimeOfDay, shapeRecovery } from '@soirely/domain';
import { type Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Footnote, PrimaryButton, QuietButton } from '../components/Buttons.tsx';
import { focusChecked, focusRefused, keysStayDown } from '../components/Field.tsx';
import { Notice } from '../components/Notice.tsx';
import { dateLocale } from '../i18n/index.ts';
import { type CodeMode, codeRefusal, typedCodeProblem } from '../kit/twoFactor.ts';
import { tokens } from '../theme/tokens.ts';
import { CodeBoxes, type CodeBoxesHandle } from './CodeBoxes.tsx';
import { NEXT_STEP_MS } from './CodeStep.tsx';
import { tap } from './haptics.ts';
import { InsideField } from './InsideField.tsx';
import { Confirmed, Heading, Plain, Says } from './Lines.tsx';
import { useShake } from './shake.ts';
import { NavBar, StepScreen } from './StepScreen.tsx';

type Status =
  | { kind: 'ready' }
  | { kind: 'checking' }
  | { kind: 'blank'; message: string }
  | { kind: 'wrong'; message: string }
  | { kind: 'paused'; time: string; liftsAt: number }
  | { kind: 'failed' }
  | { kind: 'verified' };

/** A sign-in's second factor: the authenticator's six boxes, or a recovery code as it was printed. */
export function TwoFactorStep({
  mode,
  intro,
  failedTitle,
  failedBody,
  onVerify,
  onPassed,
  onExpired,
  onOtherWay,
  onLostBoth,
  onBack,
}: {
  mode: CodeMode;
  intro: string;
  failedTitle: string;
  failedBody: string;
  /** Where the account goes once the code is taken. */
  onVerify: (factor: SecondFactor) => Promise<Href>;
  onPassed: (next: Href) => void;
  onExpired: () => void;
  /** The authenticator from a recovery code, a recovery code from the authenticator. */
  onOtherWay: () => void;
  onLostBoth: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'ready' });
  const [code, setCode] = useState('');
  const boxes = useRef<CodeBoxesHandle>(null);
  const field = useRef<TextInputInstance>(null);
  const { shaken, shake } = useShake();
  const recovery = mode === 'recovery';
  const checking = status.kind === 'checking';
  const done = status.kind === 'verified';
  const liftsAt = status.kind === 'paused' ? status.liftsAt : null;

  useEffect(() => {
    if (liftsAt == null) return;

    const lift = setTimeout(
      () => {
        setCode('');
        setStatus({ kind: 'ready' });
      },
      Math.max(0, liftsAt - Date.now()),
    );

    return () => clearTimeout(lift);
  }, [liftsAt]);

  async function submit(typed: string): Promise<void> {
    if (checking || done || status.kind === 'paused') return;

    // Checked before sending, and a failed check costs no attempt.
    const problem = typedCodeProblem(mode, typed);
    if (problem != null) {
      setStatus({ kind: 'blank', message: t(problem) });
      focusChecked(field);
      return;
    }

    keysStayDown();
    setStatus({ kind: 'checking' });

    try {
      const next = await onVerify(recovery ? { recoveryCode: typed } : { code: typed });
      setStatus({ kind: 'verified' });
      setTimeout(() => onPassed(next), NEXT_STEP_MS);
    } catch (error) {
      const refusal = codeRefusal(error, mode);

      if (refusal.kind === 'expired') {
        onExpired();
        return;
      }

      if (refusal.kind === 'wrong') {
        setStatus({ kind: 'wrong', message: t(refusal.message) });
        if (recovery) {
          // Selected, so the next try types over it.
          tap.wrong();
          shake();
          focusRefused(field);
          field.current?.setSelection(0, typed.length);
        } else {
          boxes.current?.refuse();
        }
        return;
      }

      setStatus(
        refusal.kind === 'paused'
          ? {
              kind: 'paused',
              time: formatTimeOfDay(refusal.liftsAt, dateLocale()),
              liftsAt: refusal.liftsAt.getTime(),
            }
          : { kind: 'failed' },
      );
    }
  }

  const said = status.kind === 'blank' || status.kind === 'wrong' ? status.message : null;

  return (
    <StepScreen
      nav={<NavBar left="back" onLeft={onBack} testID="twoFactor" />}
      foot={
        recovery ? (
          <PrimaryButton
            label={
              status.kind === 'paused'
                ? t('twoFactor.tryAgainAt', { time: status.time })
                : t('twoFactor.useThisCode')
            }
            onPress={() => void submit(code)}
            busy={checking || done}
            off={status.kind === 'paused'}
            testID="twoFactor.verify"
          />
        ) : undefined
      }
    >
      <Heading
        title={recovery ? t('twoFactor.recoveryTitle') : t('twoFactor.title')}
        intro={intro}
      />

      {status.kind === 'paused' && (
        <View style={styles.notice}>
          <Notice
            tone="attention"
            mark="!"
            title={t('twoFactor.pausedTitle')}
            body={t('twoFactor.pausedBody', { time: status.time })}
            answer={status}
          />
          <Footnote
            question={t('twoFactor.notYou')}
            action={t('twoFactor.resetPassword')}
            onPress={() => router.push(`/forgot-password?from=${recovery ? 'recovery' : 'code'}`)}
            role="link"
            testID="twoFactor.reset"
          />
        </View>
      )}
      {status.kind === 'failed' && (
        <View style={styles.notice}>
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            title={failedTitle}
            body={failedBody}
            answer={status}
          />
        </View>
      )}

      {recovery ? (
        <>
          <Animated.View style={[styles.field, shaken]}>
            <InsideField
              ref={field}
              label={t('twoFactor.recoveryCode')}
              value={code}
              onChangeText={(text) => {
                setCode(shapeRecovery(text));
                if (said != null) setStatus({ kind: 'ready' });
              }}
              state={status.kind === 'blank' ? 'blank' : 'plain'}
              line={said}
              submitting={checking}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              returnKeyType="go"
              submitBehavior="submit"
              onSubmitEditing={() => void submit(code)}
              autoFocus
              testID="twoFactor.code"
            />
          </Animated.View>
          {said != null ? <Says words={said} /> : <Plain>{t('twoFactor.recoveryShape')}</Plain>}
        </>
      ) : (
        status.kind !== 'paused' && (
          <View style={styles.boxes}>
            <CodeBoxes
              ref={boxes}
              label={t('steps.codeLabel')}
              value={code}
              onChange={(next) => {
                setCode(next);
                if (next !== '' && status.kind === 'wrong') setStatus({ kind: 'ready' });
              }}
              onFull={(full) => void submit(full)}
              done={done}
              line={said != null && code === '' ? said : null}
              testID="twoFactor.code"
            />
            {said != null && code === '' && <Says words={said} />}
            {done && <Confirmed words={t('twoFactor.signedIn')} />}
          </View>
        )
      )}

      {!done && (
        <View style={styles.ways}>
          <QuietButton
            label={recovery ? t('twoFactor.useApp') : t('twoFactor.useRecovery')}
            onPress={onOtherWay}
            testID="twoFactor.switch"
          />
          <QuietButton
            label={recovery ? t('twoFactor.lostBoth') : t('twoFactor.lost')}
            onPress={onLostBoth}
            testID="twoFactor.lostBoth"
          />
        </View>
      )}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  notice: { marginTop: tokens.spaceXl, gap: tokens.spaceSm },
  boxes: { marginTop: tokens.space4xl },
  field: { marginTop: tokens.space3xl },
  ways: { marginTop: tokens.spaceLg, alignItems: 'flex-start' },
});
