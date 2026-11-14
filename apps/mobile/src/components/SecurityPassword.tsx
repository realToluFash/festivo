import {
  codeProblem,
  formatCountdown,
  meetsPasswordLength,
  PASSWORD_MINIMUM_LENGTH,
} from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { emailMessage } from '../kit/formChecks.ts';
import { tokens } from '../theme/tokens.ts';
import { discardAsk } from './AccountName.tsx';
import { CodeExpired } from './AccountVerify.tsx';
import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
  TextField,
} from './Field.tsx';
import { PasswordField } from './PasswordField.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { SentBody } from './SecurityForgot.tsx';
import { FocusedScreen, Line, ShapeMark, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;
type Input = RefObject<TextInputInstance | null>;

export interface Refused<K extends string> {
  field: K | 'other';
  message: string;
}

/** The one rule, with its mark and its word, so it is never colour alone. */
function PasswordRule({ met }: { met: boolean }) {
  const { t } = useTranslation();
  const rule = t('register.ruleLength', { count: PASSWORD_MINIMUM_LENGTH });
  const state = met ? t('register.ruleMet') : t('register.ruleNotYet');

  return (
    <View style={styles.rule}>
      <View style={styles.ruleLine} accessible accessibilityLabel={`${rule}: ${state}`}>
        <ShapeMark kind={met ? 'yes' : 'notyet'} side={18} ink={tokens.colorFieldBorder} />
        <Text size={15} weight="medium" accessible={false} style={styles.grow}>
          {rule}
        </Text>
        <Text size={14} weight="semibold" accessible={false} style={styles.secondary}>
          {state}
        </Text>
      </View>
      <Line size={14} text={t('register.ruleNote')} />
    </View>
  );
}

/** The first field with something to say takes the focus: a client check keeps the keys down, a refusal brings them up. */
function focusFirst(fields: readonly [string | null, Input][], checked: boolean): boolean {
  const field = fields.find(([says]) => says != null)?.[1];
  if (field == null) return false;
  if (checked) focusChecked(field);
  else focusRefused(field);

  return true;
}

export type ChangeStage = 'change' | 'forgot' | 'sent';

export function ChangePasswordScreen({
  open,
  start = 'change',
  email,
  opener,
  onClose,
  onSave,
  onSend,
}: {
  open: boolean;
  start?: ChangeStage;
  email: string;
  opener: Opener;
  onClose: () => void;
  onSave: (current: string, next: string) => Promise<Refused<'current' | 'next'> | null>;
  onSend: (email: string) => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState(start);
  const current = useRef('');
  const next = useRef('');
  const typedEmail = useRef(email);
  const currentField = useRef<TextInputInstance>(null);
  const nextField = useRef<TextInputInstance>(null);
  const emailField = useRef<TextInputInstance>(null);
  const [met, setMet] = useState(false);
  const [changed, setChanged] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [says, setSays] = useState<Record<'current' | 'next', string | null>>({
    current: null,
    next: null,
  });
  const [other, setOther] = useState<{ message: string } | null>(null);
  const [emailSays, setEmailSays] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState(email);

  async function save(): Promise<void> {
    if (busy) return;
    const client = {
      current: current.current === '' ? t('passwordCard.currentBlank') : null,
      next:
        next.current === ''
          ? t('passwordCard.newBlank')
          : meetsPasswordLength(next.current)
            ? null
            : t('security.passwordShort', { count: PASSWORD_MINIMUM_LENGTH }),
    };
    setSays(client);
    setOther(null);
    if (
      focusFirst(
        [
          [client.current, currentField],
          [client.next, nextField],
        ],
        true,
      )
    )
      return;
    keysStayDown();
    setBusy(true);
    const refused = await onSave(current.current, next.current);
    setBusy(false);
    if (refused == null) return;
    if (refused.field === 'other') {
      setOther({ message: refused.message });
      return;
    }
    setSays({ current: null, next: null, [refused.field]: refused.message });
    focusRefused(refused.field === 'current' ? currentField : nextField);
  }

  async function send(): Promise<void> {
    if (busy) return;
    const typed = typedEmail.current.trim();
    const said = emailMessage(typed, t);
    setEmailSays(said);
    if (said != null) {
      focusChecked(emailField);
      return;
    }
    keysStayDown();
    setBusy(true);
    const refused = await onSend(typed);
    setBusy(false);
    if (refused != null) {
      setEmailSays(refused);
      focusRefused(emailField);
      return;
    }
    setSentTo(typed);
    setStage('sent');
  }

  if (stage === 'sent')
    return (
      <FocusedScreen
        open={open}
        title={t('recovery.sentTitle')}
        verb={{
          label: t('security.done'),
          on: true,
          onPress: onClose,
          testID: 'security.reset.done',
        }}
        cancels={false}
        onCancel={onClose}
        opener={opener}
        testID="security.reset.screen"
      >
        <SentBody
          onAgain={() => {
            typedEmail.current = sentTo;
            setStage('forgot');
          }}
        />
      </FocusedScreen>
    );

  if (stage === 'forgot')
    return (
      <FocusedScreen
        open={open}
        title={t('recovery.title')}
        verb={{
          label: t('security.send'),
          on: true,
          busy,
          onPress: () => void send(),
          testID: 'security.reset.send',
        }}
        waits={busy}
        onCancel={onClose}
        cancelTestID="security.reset.cancel"
        opener={opener}
        testID="security.reset.screen"
      >
        <Line text={t('security.resetLead')} />
        <Field label={t('recovery.email')} error={emailSays}>
          <TextField
            ref={emailField}
            defaultValue={sentTo}
            wrong={emailSays != null}
            submitting={busy}
            autoFocus
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onChangeText={(text) => {
              typedEmail.current = text;
              if (emailSays != null) setEmailSays(null);
            }}
            onSubmitEditing={() => void send()}
            submitBehavior="submit"
            accessibilityLabel={t('recovery.email')}
            testID="security.reset.email"
          />
        </Field>
      </FocusedScreen>
    );

  return (
    <FocusedScreen
      open={open}
      title={t('passwordCard.change')}
      verb={{
        label: t('account.save'),
        on: true,
        busy,
        onPress: () => void save(),
        testID: 'security.change.save',
      }}
      waits={busy}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID="security.change.cancel"
      opener={opener}
      ask={discardAsk(
        discarding,
        t('security.changeStays'),
        { keep: () => setDiscarding(false), discard: onClose },
        'security.change.discard',
        t,
      )}
      testID="security.change.screen"
    >
      {other != null && <FieldError message={other.message} answer={other} />}
      <Field
        label={t('passwordCard.current')}
        labelAction={{
          label: t('passwordCard.forgot'),
          onPress: () => setStage('forgot'),
          testID: 'security.change.forgot',
        }}
        error={says.current}
      >
        <PasswordField
          ref={currentField}
          wrong={says.current != null}
          submitting={busy}
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
          accessibilityLabel={t('passwordCard.current')}
          testID="security.change.current"
        />
      </Field>
      <Field label={t('passwordCard.new')} error={says.next}>
        <PasswordField
          ref={nextField}
          wrong={says.next != null}
          submitting={busy}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(text) => {
            next.current = text;
            setMet(meetsPasswordLength(text));
            setChanged(text !== '' || current.current !== '');
            if (says.next != null) setSays({ ...says, next: null });
          }}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          submitBehavior="submit"
          accessibilityLabel={t('passwordCard.new')}
          testID="security.change.new"
        />
      </Field>
      <PasswordRule met={met} />
      <Line size={14} text={t('passwordCard.signsOut')} />
      <Line size={14} text={t('passwordCard.emailed', { email })} />
    </FocusedScreen>
  );
}

/** What adding a password asks of the account: a code sent to it first, then the password. */
export interface Setting {
  /** Sends the code; resolves to the seconds until another may go, or null when it could not be sent. */
  send: () => Promise<number | null>;
  /** Resolves to why the code was not taken, or null once it is. */
  pass: (code: string) => Promise<string | null>;
  /** Resolves to why the password was not added, `expired` when the code ran out first, or null once it is. */
  save: (password: string) => Promise<Refused<'password'> | 'expired' | null>;
}

export function SetPasswordScreen({
  open,
  email,
  setting,
  startExpired = false,
  opener,
  onClose,
}: {
  open: boolean;
  email: string;
  setting: Setting;
  /** Opens as the code ran out, so a state link can show it. */
  startExpired?: boolean;
  opener: Opener;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<'code' | 'choose'>('code');
  const code = useRef('');
  const chosen = useRef('');
  const codeField = useRef<TextInputInstance>(null);
  const chosenField = useRef<TextInputInstance>(null);
  const [codeSays, setCodeSays] = useState<string | null>(null);
  const [chosenSays, setChosenSays] = useState<string | null>(null);
  const [other, setOther] = useState<{ message: string } | null>(null);
  const [sent, setSent] = useState(0);
  const [met, setMet] = useState(false);
  const [typed, setTyped] = useState(false);
  const [kept, setKept] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [expired, setExpired] = useState(startExpired);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const first = useRef(false);

  async function sendCode(): Promise<void> {
    setOther(null);
    const seconds = await setting.send();
    if (seconds == null) setOther({ message: t('passwordCard.setSendFailed') });
    else setWait(seconds);
  }

  // Sent once, as the screen opens; Send a new code sends again.
  useEffect(() => {
    if (first.current) return;
    first.current = true;
    void sendCode();
  });

  useEffect(() => {
    if (wait <= 0) return;
    const tick = setTimeout(() => setWait((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [wait]);

  async function proceed(): Promise<void> {
    if (busy) return;
    const problem = codeProblem(code.current);
    if (problem != null) {
      setCodeSays(
        problem === 'blank' ? t('passwordCard.setCodeBlank') : t('passwordCard.setCodeShort'),
      );
      focusChecked(codeField);
      return;
    }
    keysStayDown();
    setBusy(true);
    const refused = await setting.pass(code.current);
    setBusy(false);
    if (refused == null) {
      setStage('choose');
      return;
    }
    setCodeSays(refused);
    focusRefused(codeField);
  }

  async function save(): Promise<void> {
    if (busy) return;
    const client =
      chosen.current === ''
        ? t('passwordCard.setNewBlank')
        : meetsPasswordLength(chosen.current)
          ? null
          : t('security.passwordShort', { count: PASSWORD_MINIMUM_LENGTH });
    setChosenSays(client);
    setOther(null);
    if (client != null) {
      focusChecked(chosenField);
      return;
    }
    keysStayDown();
    setBusy(true);
    const refused = await setting.save(chosen.current);
    setBusy(false);
    if (refused == null) return;
    if (refused === 'expired') {
      code.current = '';
      setKept(chosen.current);
      setExpired(true);
      setStage('code');
      return;
    }
    if (refused.field === 'other') {
      setOther({ message: refused.message });
      return;
    }
    setChosenSays(refused.message);
    focusRefused(chosenField);
  }

  if (stage === 'choose')
    return (
      <FocusedScreen
        open={open}
        title={t('passwordCard.setNewTitle')}
        verb={{
          label: t('account.save'),
          on: true,
          busy,
          onPress: () => void save(),
          testID: 'security.choose.save',
        }}
        waits={busy}
        onCancel={() => (typed ? setDiscarding(true) : onClose())}
        cancelTestID="security.choose.cancel"
        opener={opener}
        ask={discardAsk(
          discarding,
          t('security.nothingAdded'),
          { keep: () => setDiscarding(false), discard: onClose },
          'security.choose.discard',
          t,
        )}
        testID="security.choose.screen"
      >
        {other != null && <FieldError message={other.message} answer={other} />}
        <Field label={t('passwordCard.setNewLabel')} error={chosenSays}>
          <PasswordField
            ref={chosenField}
            defaultValue={kept}
            wrong={chosenSays != null}
            submitting={busy}
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
            onSubmitEditing={() => void save()}
            submitBehavior="submit"
            accessibilityLabel={t('passwordCard.setNewLabel')}
            testID="security.choose.password"
          />
        </Field>
        <PasswordRule met={met} />
        <Line size={14} text={t('passwordCard.setEmailed', { email })} />
      </FocusedScreen>
    );

  return (
    <FocusedScreen
      open={open}
      title={t('passwordCard.setCodeTitle')}
      verb={{
        label: t('waysCard.continue'),
        on: !expired,
        busy,
        onPress: () => void proceed(),
        testID: 'security.code.continue',
      }}
      waits={busy}
      onCancel={onClose}
      cancelTestID="security.code.cancel"
      opener={opener}
      testID="security.code.screen"
    >
      <Line text={t('passwordCard.setCodeIntro', { email })} />
      {other != null && <FieldError message={other.message} answer={other} />}
      {expired ? (
        <CodeExpired title={t('verifyEmail.expiredTitle')} line={t('verifyEmail.expiredBody')} />
      ) : (
        <Field label={t('passwordCard.setCodeLabel')} error={codeSays}>
          <CodeField
            key={sent}
            ref={codeField}
            wrong={codeSays != null}
            submitting={busy}
            autoFocus
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onChangeText={(text) => {
              code.current = text;
              if (codeSays != null) setCodeSays(null);
            }}
            onSubmitEditing={() => void proceed()}
            submitBehavior="submit"
            accessibilityLabel={t('passwordCard.setCodeLabel')}
            testID="security.code.field"
          />
        </Field>
      )}
      <TextAction
        label={
          wait > 0
            ? t('passwordCard.resendIn', { time: formatCountdown(wait) })
            : t('passwordCard.resend')
        }
        off={wait > 0 || busy}
        figures
        onPress={() => {
          code.current = '';
          setCodeSays(null);
          setExpired(false);
          setSent((count) => count + 1);
          void sendCode();
        }}
        consequence={t('verifyEmail.resendNote')}
        testID="security.code.resend"
      />
      <Line size={14} text={t('passwordCard.setCodeNote')} />
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  rule: { gap: tokens.spaceXxs },
  ruleLine: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
});
