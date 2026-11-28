import type { Provider } from '@soirely/api-client';
import { type RefObject, useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { SignedIn } from '../kit/waysProof.ts';
import { PROVIDER_NAMES } from '../providerSignIn.ts';
import { tokens } from '../theme/tokens.ts';

import {
  CodeField,
  Field,
  FieldError,
  focusChecked,
  focusRefused,
  keysStayDown,
} from './Field.tsx';
import { Notice } from './Notice.tsx';
import { PasswordField } from './PasswordField.tsx';
import { ProviderButton } from './ProviderSignIn.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { FocusedScreen, Line } from './Summary.tsx';

/** What Confirm it's you asks for: the password, a code, or a trip to the provider the person signs in with. */
export interface ProofAsks {
  lead: string;
  note?: string | undefined;
  /** The proof the provider gave has run out: drawn as the attention notice, read out with each new `answer`. */
  expired?: { text: string; answer: unknown } | undefined;
  password: boolean;
  code: boolean;
  codeHelp: string | readonly string[];
  /** The provider confirming in the password's place, named; null with a password. */
  instead: string | null;
  /** With no password: only the provider's own button opens its trip, and what it brought back heads the code step (sc-22601). */
  trip?: { provider: Provider; signedIn: SignedIn | null } | undefined;
  /** Too many tries: the notice says when, and nothing sends until the caller lifts it. */
  limited?: { title: string; body: string } | undefined;
}

/** Why Continue did not prove it: per field, `checked` when the client found it before asking. */
export interface ConfirmSays {
  password: string | null;
  code: string | null;
  checked: boolean;
  /** A refusal no field owns: the provider's trip, or the connection. */
  other?: string | null | undefined;
}

/** Confirm it's you before a change to how you sign in: Cancel · Confirm it's you · Continue. `onContinue` resolves to null once proved. */
export function ConfirmScreen({
  open,
  asks,
  opener,
  onClose,
  onContinue,
  title,
  verb,
  testID = 'account.confirm',
}: {
  open: boolean;
  asks: ProofAsks;
  /** The change it guards, named in the title and verb, as Make an owner does; Confirm it's you · Continue otherwise. */
  title?: string | undefined;
  verb?: string | undefined;
  opener: RefObject<ScreenReaderTarget | null>;
  onClose: () => void;
  onContinue: (password: string, code: string) => Promise<ConfirmSays | null>;
  testID?: string;
}) {
  const { t } = useTranslation();
  const password = useRef('');
  const code = useRef('');
  const passwordField = useRef<TextInputInstance>(null);
  const codeField = useRef<TextInputInstance>(null);
  const [says, setSays] = useState<ConfirmSays>({ password: null, code: null, checked: false });
  const [checking, setChecking] = useState(false);

  async function proceed(): Promise<void> {
    if (checking || asks.limited != null) return;
    keysStayDown();
    setChecking(true);
    const next = await onContinue(password.current, code.current);
    setChecking(false);
    if (next == null) return;
    setSays(next);
    const field = next.password != null ? passwordField : next.code != null ? codeField : null;
    if (field == null) return;
    if (next.checked) focusChecked(field);
    else focusRefused(field);
  }

  const trip = asks.trip;
  const beforeTrip = trip != null && !asks.code;

  return (
    <FocusedScreen
      open={open}
      title={title ?? t('waysCard.proveTitle')}
      verb={
        beforeTrip
          ? null
          : {
              label: verb ?? t('waysCard.continue'),
              on: asks.limited == null,
              busy: checking,
              onPress: () => void proceed(),
              testID: `${testID}.continue`,
            }
      }
      waits={checking}
      onCancel={onClose}
      cancelTestID={`${testID}.cancel`}
      opener={opener}
      testID={`${testID}.screen`}
    >
      <Line text={asks.lead} />
      {asks.expired != null && (
        <Notice tone="attention" mark="!" body={asks.expired.text} answer={asks.expired.answer} />
      )}
      {asks.note != null && <Line size={14} text={asks.note} />}
      {asks.limited != null && (
        <Notice
          tone="attention"
          mark="!"
          title={asks.limited.title}
          body={asks.limited.body}
          answer={asks.limited}
        />
      )}
      {trip?.signedIn != null && asks.code && (
        <Notice
          tone="quiet"
          mark={tokens.marks.done.glyph}
          markTone="done"
          title={t('waysCard.signedInWith', { provider: PROVIDER_NAMES[trip.provider] })}
          accentTitle
          detail={trip.signedIn.email}
          announce
        />
      )}
      {says.other != null && <FieldError message={says.other} answer={says} />}
      {asks.password && (
        <Field label={t('waysCard.yourPassword')} error={says.password}>
          <PasswordField
            ref={passwordField}
            wrong={says.password != null}
            submitting={checking}
            autoFocus
            autoComplete="current-password"
            textContentType="password"
            onChangeText={(text) => {
              password.current = text;
              if (says.password != null) setSays({ ...says, password: null });
            }}
            returnKeyType={asks.code ? 'next' : 'done'}
            onSubmitEditing={() => (asks.code ? codeField.current?.focus() : void proceed())}
            submitBehavior="submit"
            accessibilityLabel={t('waysCard.yourPassword')}
            testID={`${testID}.password`}
          />
        </Field>
      )}
      {asks.code && (
        <Field label={t('waysCard.code')} error={says.code} help={asks.codeHelp}>
          <CodeField
            ref={codeField}
            takesRecoveryCode
            wrong={says.code != null}
            submitting={checking}
            autoFocus={!asks.password}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            onChangeText={(text) => {
              code.current = text;
              if (says.code != null) setSays({ ...says, code: null });
            }}
            returnKeyType="done"
            onSubmitEditing={() => void proceed()}
            submitBehavior="submit"
            accessibilityLabel={t('waysCard.code')}
            testID={`${testID}.code`}
          />
        </Field>
      )}
      {beforeTrip && (
        <View style={styles.trip}>
          <ProviderButton
            provider={trip.provider}
            label={t('waysCard.continueWith', { provider: PROVIDER_NAMES[trip.provider] })}
            onPress={() => void proceed()}
            busy={checking}
            off={asks.limited != null}
            testID={`${testID}.provider`}
          />
        </View>
      )}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  trip: { paddingTop: tokens.spaceSm },
});
