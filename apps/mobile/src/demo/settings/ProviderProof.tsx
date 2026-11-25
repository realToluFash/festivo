import type { Provider } from '@soirely/api-client';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  CodeField,
  Field,
  focusChecked,
  focusRefused,
  keysStayDown,
} from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { ProviderButton } from '../../components/ProviderSignIn.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { FocusedScreen, Line } from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { CODE_SAYS } from './AccountModel.ts';
import { secondFactorProblem } from './AccountSample.ts';
import {
  type ProviderStage,
  TRIP_MS,
  afterTrip,
  headerVerbShown,
  limitTime,
  stillLimited,
} from './ProviderProofModel.ts';
import { PROVIDER_NAME } from './SecuritySample.ts';

/** Confirm it's you for an account with no password: Google's or Apple's own button opens the trip, never the header (sc-22601). */
export function ProviderProofScreen({
  open,
  provider,
  lead,
  note,
  codeHelp,
  codeWrong = CODE_SAYS.wrong,
  twoFactor,
  limitedUntil = null,
  startStage = 'trip',
  title,
  opener,
  onClose,
  onProved,
  testID: id,
}: {
  open: boolean;
  provider: Provider;
  lead: string;
  note?: string | undefined;
  codeHelp: string | readonly string[];
  codeWrong?: string;
  twoFactor: boolean;
  /** Too many tries on Sign out everywhere else: the API's `until`, as a time in milliseconds. */
  limitedUntil?: number | null;
  /** The code step, for a state that opens with Google or Apple already answered. */
  startStage?: ProviderStage;
  title?: string;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onProved: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const name = PROVIDER_NAME[provider];
  const [stage, setStage] = useState<ProviderStage>(startStage);
  const [until, setUntil] = useState(() =>
    stillLimited(limitedUntil, Date.now()) ? limitedUntil : null,
  );
  const [codeSays, setCodeSays] = useState<string | null>(null);
  const code = useRef('');
  const codeField = useRef<TextInputInstance>(null);
  const away = useRef<ReturnType<typeof setTimeout>>(undefined);
  const limited = until != null;

  useEffect(() => () => clearTimeout(away.current), []);

  useEffect(() => {
    if (until == null) return;
    // The button comes back and the notice goes at the API's `until`, with nothing in its place.
    const ends = setTimeout(() => setUntil(null), Math.max(0, until - Date.now()));

    return () => clearTimeout(ends);
  }, [until]);

  function trip(): void {
    if (stage !== 'trip' || limited) return;
    setStage('busy');
    // The sample's Google or Apple answers after a moment, so the faded button can be seen.
    away.current = setTimeout(() => {
      if (afterTrip(twoFactor) === 'code') setStage('code');
      else onProved();
    }, TRIP_MS);
  }

  function sendCode(): void {
    if (limited) return;
    keysStayDown();
    const problem = secondFactorProblem(code.current);
    if (problem == null) {
      onProved();
      return;
    }
    setCodeSays(problem === 'blank' ? CODE_SAYS.blank : codeWrong);
    if (problem === 'blank') focusChecked(codeField);
    else focusRefused(codeField);
  }

  return (
    <FocusedScreen
      open={open}
      title={title ?? t('waysCard.proveTitle')}
      verb={
        headerVerbShown(stage)
          ? {
              label: t('waysCard.continue'),
              on: !limited,
              onPress: sendCode,
              testID: `${id}.continue`,
            }
          : null
      }
      waits={stage === 'busy'}
      onCancel={onClose}
      cancelTestID={`${id}.cancel`}
      opener={opener}
      testID={`${id}.screen`}
    >
      <Line text={lead} />
      {note != null && <Line size={14} text={note} />}
      {limited && until != null && (
        <Notice
          tone="attention"
          mark="!"
          title={t('devices.everywhereLimitedTitle')}
          body={t('devices.everywhereLimitedBody', { time: limitTime(until) })}
        />
      )}
      {stage === 'code' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.done.glyph}
          markTone="done"
          title={t('waysCard.signedInWith', { provider: name })}
          accentTitle
          detail={SAMPLE.email}
          announce
        />
      )}
      {stage === 'code' ? (
        <Field label={t('waysCard.code')} error={codeSays} help={codeHelp}>
          <CodeField
            ref={codeField}
            takesRecoveryCode
            wrong={codeSays != null}
            submitting={false}
            autoFocus
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            onChangeText={(text) => {
              code.current = text;
              if (codeSays != null) setCodeSays(null);
            }}
            returnKeyType="done"
            onSubmitEditing={sendCode}
            submitBehavior="submit"
            accessibilityLabel={t('waysCard.code')}
            testID={`${id}.code`}
          />
        </Field>
      ) : (
        <View style={styles.button}>
          <ProviderButton
            provider={provider}
            label={t('waysCard.continueWith', { provider: name })}
            onPress={trip}
            busy={stage === 'busy'}
            off={limited}
            testID={`${id}.provider`}
          />
        </View>
      )}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  button: { paddingTop: tokens.spaceSm },
});
