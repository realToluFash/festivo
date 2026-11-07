import { formatCountdown, meetsPasswordLength } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';

import {
  CodeField,
  Field,
  focusChecked,
  focusRefused,
  TextField,
} from '../../components/Field.tsx';
import { PasswordField } from '../../components/PasswordField.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { COUNTDOWN_SECONDS, WORDS as ACCOUNT } from './AccountModel.ts';
import { discardAsk } from './AccountName.tsx';
import { CodeExpired, useCountdown } from './AccountParts.tsx';
import { sentCodeProblem } from './AccountSample.ts';
import { SentBody } from './SecurityForgot.tsx';
import {
  changeSays,
  chooseSays,
  emailedCodeSays,
  type FieldSays,
  resetSays,
  WORDS,
} from './SecurityModel.ts';
import { FocusedScreen, Line, StatusMark, TextAction } from './Summary.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;
type Input = RefObject<TextInputInstance | null>;

/** The one rule, with its mark and its word, so it is never colour alone. */
function PasswordRule({ met }: { met: boolean }) {
  return (
    <View style={styles.rule}>
      <View
        style={styles.ruleLine}
        accessible
        accessibilityLabel={`${WORDS.rule}: ${met ? WORDS.met : WORDS.notYet}`}
      >
        <StatusMark kind={met ? 'yes' : 'notyet'} side={18} ink={tokens.colorFieldBorder} />
        <Text size={15} weight="medium" accessible={false} style={styles.grow}>
          {WORDS.rule}
        </Text>
        <Text size={14} weight="semibold" accessible={false} style={styles.secondary}>
          {met ? WORDS.met : WORDS.notYet}
        </Text>
      </View>
      <Line size={14} text={WORDS.ruleNote} />
    </View>
  );
}

/** The first field with something to say takes the focus: a client check keeps the keys down, a refusal brings them up. */
function focusFirst<K extends string>(next: FieldSays<K>, fields: readonly [K, Input][]): boolean {
  const field = fields.find(([key]) => next.says[key] != null)?.[1];
  if (field == null) return false;
  if (next.checked) focusChecked(field);
  else focusRefused(field);

  return true;
}

export type ChangeStage = 'change' | 'forgot' | 'sent';

/** Change password, then Forgot it? turns the same sheet into Reset your password and Check your email. */
export function ChangePasswordScreen({
  open,
  start,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  start: ChangeStage;
  opener: Opener;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stage, setStage] = useState(start);
  const current = useRef('');
  const next = useRef('');
  const email = useRef<string>(SAMPLE.email);
  const currentField = useRef<TextInputInstance>(null);
  const nextField = useRef<TextInputInstance>(null);
  const emailField = useRef<TextInputInstance>(null);
  const [met, setMet] = useState(false);
  const [changed, setChanged] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [says, setSays] = useState<Record<'current' | 'next', string | null>>({
    current: null,
    next: null,
  });
  const [emailSays, setEmailSays] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string>(SAMPLE.email);

  function save(): void {
    const said = changeSays(current.current, next.current);
    setSays(said.says);
    if (
      !focusFirst(said, [
        ['current', currentField],
        ['next', nextField],
      ])
    )
      onSaved();
  }

  function send(): void {
    const said = resetSays(email.current);
    setEmailSays(said);
    if (said != null) {
      focusChecked(emailField);
      return;
    }
    setSentTo(email.current);
    setStage('sent');
  }

  if (stage === 'sent')
    return (
      <FocusedScreen
        open={open}
        title={WORDS.sentTitle}
        verb={{ label: WORDS.done, on: true, onPress: onClose, testID: 'security.reset.done' }}
        cancels={false}
        onCancel={onClose}
        opener={opener}
        testID="security.reset.screen"
      >
        <SentBody
          onAgain={() => {
            email.current = sentTo;
            setStage('forgot');
          }}
        />
      </FocusedScreen>
    );

  if (stage === 'forgot')
    return (
      <FocusedScreen
        open={open}
        title={WORDS.resetTitle}
        verb={{ label: WORDS.send, on: true, onPress: send, testID: 'security.reset.send' }}
        onCancel={onClose}
        cancelTestID="security.reset.cancel"
        opener={opener}
        testID="security.reset.screen"
      >
        <Line text={WORDS.resetLead} />
        <Field label={WORDS.emailLabel} error={emailSays}>
          <TextField
            ref={emailField}
            defaultValue={sentTo}
            wrong={emailSays != null}
            autoFocus
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onChangeText={(text) => {
              email.current = text;
              if (emailSays != null) setEmailSays(null);
            }}
            onSubmitEditing={send}
            submitBehavior="submit"
            accessibilityLabel={WORDS.emailLabel}
            testID="security.reset.email"
          />
        </Field>
      </FocusedScreen>
    );

  return (
    <FocusedScreen
      open={open}
      title={WORDS.changeTitle}
      verb={{ label: ACCOUNT.save, on: true, onPress: save, testID: 'security.change.save' }}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID="security.change.cancel"
      opener={opener}
      ask={discardAsk(
        discarding,
        WORDS.changeStays,
        { keep: () => setDiscarding(false), discard: onClose },
        'security.change.discard',
      )}
      testID="security.change.screen"
    >
      <Field
        label={WORDS.currentLabel}
        labelAction={{
          label: WORDS.forgot,
          onPress: () => setStage('forgot'),
          testID: 'security.change.forgot',
        }}
        error={says.current}
      >
        <PasswordField
          ref={currentField}
          wrong={says.current != null}
          autoFocus
          autoComplete="current-password"
          textContentType="password"
          onChangeText={(text) => {
            current.current = text;
            setChanged(text !== '' || next.current !== '');
            if (says.current != null) setSays({ ...says, current: null });
          }}
          returnKeyType="next"
          onSubmitEditing={() => nextField.current?.focus()}
          submitBehavior="submit"
          accessibilityLabel={WORDS.currentLabel}
          testID="security.change.current"
        />
      </Field>
      <Field label={WORDS.newLabel} error={says.next}>
        <PasswordField
          ref={nextField}
          wrong={says.next != null}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(text) => {
            next.current = text;
            setMet(meetsPasswordLength(text));
            setChanged(text !== '' || current.current !== '');
            if (says.next != null) setSays({ ...says, next: null });
          }}
          returnKeyType="done"
          onSubmitEditing={save}
          submitBehavior="submit"
          accessibilityLabel={WORDS.newLabel}
          testID="security.change.new"
        />
      </Field>
      <PasswordRule met={met} />
      <Line size={14} text={WORDS.changeSignsOut} />
      <Line size={14} text={WORDS.changeEmail} />
    </FocusedScreen>
  );
}

/** For somebody with no password: a code by email first, then Choose a password in the same screen. */
export function SetPasswordScreen({
  open,
  start,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  start: 'entering' | 'expired';
  opener: Opener;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stage, setStage] = useState<'code' | 'choose'>('code');
  const code = useRef('');
  const chosen = useRef('');
  const codeField = useRef<TextInputInstance>(null);
  const chosenField = useRef<TextInputInstance>(null);
  const [codeSays, setCodeSays] = useState<string | null>(null);
  const [chosenSays, setChosenSays] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const [met, setMet] = useState(false);
  const [typed, setTyped] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [expired, setExpired] = useState(start === 'expired');
  const countdown = useCountdown(COUNTDOWN_SECONDS, start !== 'expired');

  function proceed(): void {
    const said = emailedCodeSays(code.current);
    setCodeSays(said);
    if (said == null) setStage('choose');
    else if (sentCodeProblem(code.current) === 'wrong') focusRefused(codeField);
    else focusChecked(codeField);
  }

  function save(): void {
    const said = chooseSays(chosen.current);
    setChosenSays(said.says.password);
    if (!focusFirst(said, [['password', chosenField]])) onSaved();
  }

  if (stage === 'choose')
    return (
      <FocusedScreen
        open={open}
        title={WORDS.chooseTitle}
        verb={{ label: ACCOUNT.save, on: true, onPress: save, testID: 'security.choose.save' }}
        onCancel={() => (typed ? setDiscarding(true) : onClose())}
        cancelTestID="security.choose.cancel"
        opener={opener}
        ask={discardAsk(
          discarding,
          WORDS.nothingAdded,
          { keep: () => setDiscarding(false), discard: onClose },
          'security.choose.discard',
        )}
        testID="security.choose.screen"
      >
        <Field label={WORDS.chosenLabel} error={chosenSays}>
          <PasswordField
            ref={chosenField}
            wrong={chosenSays != null}
            autoFocus
            autoComplete="new-password"
            textContentType="newPassword"
            onChangeText={(text) => {
              chosen.current = text;
              setMet(meetsPasswordLength(text));
              setTyped(text !== '');
              if (chosenSays != null) setChosenSays(null);
            }}
            returnKeyType="done"
            onSubmitEditing={save}
            submitBehavior="submit"
            accessibilityLabel={WORDS.chosenLabel}
            testID="security.choose.password"
          />
        </Field>
        <PasswordRule met={met} />
        <Line size={14} text={WORDS.chooseEmail} />
      </FocusedScreen>
    );

  return (
    <FocusedScreen
      open={open}
      title={WORDS.codeTitle}
      verb={{
        label: ACCOUNT.continue,
        on: !expired,
        onPress: proceed,
        testID: 'security.code.continue',
      }}
      onCancel={onClose}
      cancelTestID="security.code.cancel"
      opener={opener}
      testID="security.code.screen"
    >
      <Line text={WORDS.codeLead} />
      {expired ? (
        <CodeExpired channel="email" />
      ) : (
        <Field label={WORDS.codeLabel} error={codeSays}>
          <CodeField
            key={sent}
            ref={codeField}
            wrong={codeSays != null}
            autoFocus={start === 'entering' || sent > 0}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onChangeText={(text) => {
              code.current = text;
              if (codeSays != null) setCodeSays(null);
            }}
            onSubmitEditing={proceed}
            submitBehavior="submit"
            accessibilityLabel={WORDS.codeLabel}
            testID="security.code.field"
          />
        </Field>
      )}
      <TextAction
        label={
          countdown.left > 0
            ? `${ACCOUNT.resend} in ${formatCountdown(countdown.left)}`
            : ACCOUNT.resend
        }
        off={countdown.left > 0}
        figures
        onPress={() => {
          code.current = '';
          setCodeSays(null);
          setExpired(false);
          setSent((count) => count + 1);
          countdown.restart();
        }}
        consequence={ACCOUNT.resendNote}
        testID="security.code.resend"
      />
      <Line size={14} text={WORDS.codeWhy} />
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  rule: { gap: tokens.spaceXxs },
  ruleLine: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
});
