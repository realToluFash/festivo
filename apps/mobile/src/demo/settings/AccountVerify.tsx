import { formatCountdown } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import { CodeField, Field, focusChecked, focusRefused } from '../../components/Field.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { tokens } from '../../theme/tokens.ts';
import {
  type Channel,
  CHANNELS,
  codeMessage,
  type ContactKind,
  COUNTDOWN_SECONDS,
  verifyLead,
  type VerifyStage,
  WORDS,
  WRONG_CODE,
} from './AccountModel.ts';
import { CodeExpired, useCountdown } from './AccountParts.tsx';
import { sentCodeProblem } from './AccountSample.ts';
import { FocusedScreen, Line, TextAction } from '../../components/Summary.tsx';

/** Check your email or your messages: the code, a new one after the wait, and a number on WhatsApp may take a text. */
export function VerifyScreen({
  open,
  kind,
  shown,
  start,
  opener,
  onClose,
  onVerified,
}: {
  open: boolean;
  kind: ContactKind;
  shown: string;
  start: VerifyStage;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [channel, setChannel] = useState<Channel>(kind === 'email' ? 'email' : 'whatsApp');
  const [expired, setExpired] = useState(start === 'expired');
  const [sent, setSent] = useState(0);
  const [error, setError] = useState<string | null>(() =>
    start === 'wrong' ? codeMessage(channel, 'wrong') : null,
  );
  const prefill = sent === 0 && start === 'wrong' ? WRONG_CODE : '';
  const code = useRef(prefill);
  const field = useRef<TextInputInstance>(null);
  const countdown = useCountdown(COUNTDOWN_SECONDS, start !== 'expired');
  const words = CHANNELS[channel];

  function verify(): void {
    const problem = sentCodeProblem(code.current);
    if (problem == null) {
      onVerified();
      return;
    }
    setError(codeMessage(channel, problem));
    if (problem === 'wrong') focusRefused(field);
    else focusChecked(field);
  }

  function sendAgain(): void {
    code.current = '';
    setError(null);
    setExpired(false);
    setSent((count) => count + 1);
    countdown.restart();
  }

  const resend = (
    <TextAction
      label={
        countdown.left > 0 ? `${WORDS.resend} in ${formatCountdown(countdown.left)}` : WORDS.resend
      }
      off={countdown.left > 0}
      figures
      onPress={sendAgain}
      consequence={WORDS.resendNote}
      testID="account.verify.resend"
    />
  );

  return (
    <FocusedScreen
      open={open}
      title={words.title}
      verb={{ label: WORDS.verify, on: !expired, onPress: verify, testID: 'account.verify.submit' }}
      onCancel={onClose}
      cancelTestID="account.verify.cancel"
      opener={opener}
      testID="account.verify.screen"
    >
      <Line text={verifyLead(channel, shown)} />
      {expired ? (
        <CodeExpired channel={channel} />
      ) : (
        <View style={styles.field}>
          <Field label={words.label} error={error}>
            <CodeField
              key={sent}
              ref={field}
              defaultValue={prefill}
              wrong={error != null}
              autoFocus={start === 'entering' || sent > 0}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="done"
              onChangeText={(text) => {
                code.current = text;
                if (error != null) setError(null);
              }}
              onSubmitEditing={verify}
              submitBehavior="submit"
              accessibilityLabel={words.label}
              testID="account.verify.code"
            />
          </Field>
        </View>
      )}
      {resend}
      {channel === 'whatsApp' && !expired && (
        <TextAction
          label={WORDS.textInstead}
          onPress={() => {
            setChannel('text');
            setError(null);
          }}
          testID="account.verify.text"
        />
      )}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  field: { paddingTop: tokens.spaceXs },
});
