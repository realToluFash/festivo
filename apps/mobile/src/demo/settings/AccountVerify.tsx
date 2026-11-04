import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CodeField, Field } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DoneMark, Footnote, Resend, useCountdown } from './AccountParts.tsx';
import { sentCodeProblem } from './AccountSample.ts';
import { TaskPage } from './Frame.tsx';
import { Pill } from './parts.tsx';

export type VerifyStart = 'entering' | 'wrong' | 'expired' | 'done';

type Channel = 'email' | 'whatsApp' | 'text';

const WRONG_SAMPLE = '482170';

const WORDS: Record<Channel, { label: string; blank: string; wrong: string; newest: string }> = {
  email: {
    label: 'Code from the email',
    blank: 'Enter the 6-digit code from the email.',
    wrong: 'That code does not match. Check the newest email from Soirely and try again.',
    newest: 'email',
  },
  whatsApp: {
    label: 'Code from WhatsApp',
    blank: 'Enter the 6-digit code from WhatsApp.',
    wrong:
      'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
    newest: 'text',
  },
  text: {
    label: 'Code from the text',
    blank: 'Enter the 6-digit code from the text.',
    wrong: 'That code does not match. Check the newest text from Soirely and try again.',
    newest: 'text',
  },
};

/** Verify email and Verify phone, opened from a row's Send a code: white, calm, no Confetti. */
export function VerifyTask({
  kind,
  shown,
  start,
  onPassed,
  onBack,
}: {
  kind: 'email' | 'phone';
  shown: string;
  start: VerifyStart;
  onPassed: () => void;
  onBack: () => void;
}) {
  const email = kind === 'email';
  const [stage, setStage] = useState<'entering' | 'expired' | 'done'>(
    start === 'wrong' ? 'entering' : start,
  );
  const [channel, setChannel] = useState<Channel>(email ? 'email' : 'whatsApp');
  const words = WORDS[channel];
  const [error, setError] = useState<string | null>(start === 'wrong' ? words.wrong : null);
  const [field, setField] = useState(0);
  const [prefill, setPrefill] = useState(start === 'wrong' ? WRONG_SAMPLE : '');
  const code = useRef(prefill);
  const countdown = useCountdown(42, start !== 'expired');
  const back = { label: 'Account', onPress: onBack };

  function verify(): void {
    const problem = sentCodeProblem(code.current);

    if (problem == null) {
      onPassed();
      setStage('done');
      return;
    }
    setError(
      problem === 'blank'
        ? words.blank
        : problem === 'short'
          ? 'The code is 6 digits.'
          : words.wrong,
    );
  }

  function sendAgain(): void {
    code.current = '';
    setPrefill('');
    setError(null);
    setField((value) => value + 1);
    setStage('entering');
    countdown.restart();
  }

  if (stage === 'done')
    return (
      <TaskPage
        mark={<DoneMark />}
        title={email ? 'Email verified' : 'Number verified'}
        sub={
          email
            ? `${shown} is verified. It stays an alternative address until you make it primary in Account.`
            : `${shown} is verified. It stays an alternative number until you make it primary in Account.`
        }
      >
        <Pill label="Back to Account" onPress={onBack} testID="demo.verify.backToAccount" />
      </TaskPage>
    );

  const intro = email
    ? `We sent a code to ${shown}. Enter it here to show the address is yours.`
    : channel === 'text'
      ? `We texted the same code to ${shown}. The one on WhatsApp works too.`
      : `We sent a code to your WhatsApp on ${shown}.`;

  return (
    <TaskPage back={back} title={email ? 'Check your email' : 'Check your messages'} sub={intro}>
      {stage === 'expired' ? (
        <>
          <Notice
            tone="attention"
            mark="!"
            title="That code has expired"
            body={`Codes only work for a while. Send a new one and use the code in the newest ${words.newest}.`}
          />
          <Resend layout="task" left={0} onSend={sendAgain} testID="demo.verify.resend" />
        </>
      ) : (
        <>
          <Field label={words.label} error={error}>
            <CodeField
              key={field}
              defaultValue={prefill}
              wrong={error != null}
              autoFocus
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
              testID="demo.verify.code"
            />
          </Field>
          <Pill
            label={email ? 'Verify email' : 'Verify number'}
            onPress={verify}
            testID="demo.verify.submit"
          />
          <Resend
            layout="task"
            left={countdown.left}
            onSend={sendAgain}
            testID="demo.verify.resend"
          />
          {channel === 'whatsApp' && (
            <Pill
              label="Text it to me instead"
              kind="secondary"
              onPress={() => {
                setChannel('text');
                setError(null);
              }}
            />
          )}
        </>
      )}
      <View style={styles.foot}>
        <Footnote
          text={email ? 'Not your address?' : 'Wrong number?'}
          link="Remove it in Account"
          onPress={onBack}
        />
      </View>
    </TaskPage>
  );
}

const styles = StyleSheet.create({
  foot: { paddingTop: tokens.spaceXl },
});
