import { ApiError, type DoorCodeSignedIn, type PhoneCodeRoute } from '@soirely/api-client';
import { codeWording, formatPhone, callingCode } from '@soirely/domain';
import { type RefObject, useEffect, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type CodeStatus, codeRefusal, retryAfter } from '../kit/code.ts';
import { CodeStep, type CodeStepStatus } from '../steps/CodeStep.tsx';
import { InsideField } from '../steps/InsideField.tsx';
import { Says } from '../steps/Lines.tsx';
import { useCountdown } from '../steps/useCountdown.ts';
import { tokens } from '../theme/tokens.ts';
import { QuietButton } from './Buttons.tsx';
import { CountryPicker } from './CountryPicker.tsx';

/** "+351 912 345 412", the number the code went to as it was typed. */
export function shownNumber(country: string, number: string): string {
  return formatPhone(`${callingCode(country) ?? ''}${number.replace(/\D/gu, '')}`);
}

/** Signed out at a door code (sc-4235): the country's code and the mobile, beside each other as the app demo's redeem draws them. */
export function NumberFields({
  country,
  numberRef,
  said,
  sending,
  onCountry,
  onNumber,
  onSubmit,
}: {
  country: string;
  numberRef: RefObject<TextInputInstance | null>;
  said: string | null;
  sending: boolean;
  onCountry: (code: string) => void;
  onNumber: (typed: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.phoneRow}>
        <View style={styles.country}>
          <CountryPicker
            label={t('redeem.phone.countryCode')}
            value={country}
            onChange={onCountry}
            disabled={sending}
            withCallingCode
            wrong={false}
            testID="redeem.event.country"
          />
        </View>
        <View style={styles.grow}>
          <InsideField
            ref={numberRef}
            label={t('redeem.phone.mobile')}
            onChangeText={onNumber}
            state={said == null ? 'plain' : 'blank'}
            line={said}
            submitting={sending}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="go"
            submitBehavior="submit"
            onSubmitEditing={onSubmit}
            testID="redeem.event.number"
          />
        </View>
      </View>
      {said != null && <Says words={said} />}
    </View>
  );
}

export type CodeLeave =
  | { kind: 'signedIn'; signedIn: DoorCodeSignedIn }
  | { kind: 'alternative' }
  | { kind: 'refused'; error: ApiError };

/** The six boxes for the code sent to the mobile; the sixth digit signs in. */
export function PhoneCodeScreen({
  code,
  handle,
  number,
  onLeave,
}: {
  code: string;
  handle: string;
  number: string;
  onLeave: (leave: CodeLeave) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CodeStepStatus>({ kind: 'entering' });
  const [route, setRoute] = useState<PhoneCodeRoute | null>('whatsapp');
  const { left, restart } = useCountdown(0);
  const wording = codeWording(route);
  const texted = !wording.fromWhatsApp;

  useEffect(() => {
    let live = true;
    void api.phoneSignInOpening(handle).then(
      (opening) => {
        if (!live) return;
        restart(opening.cooldownSeconds);
        setRoute(opening.route);
        if (opening.codeState !== 'live') setStatus({ kind: opening.codeState, opened: true });
      },
      () => undefined,
    );

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, for the handle the send gave
  }, [handle]);

  // While the code is on WhatsApp, the server may hand it to SMS: the words follow within a few seconds.
  useEffect(() => {
    if (!wording.watch) return undefined;
    const watching = setInterval(() => {
      api.phoneSignInOpening(handle).then(
        (opening) => setRoute(opening.route),
        () => undefined,
      );
    }, 5000);

    return () => clearInterval(watching);
  }, [wording.watch, handle]);

  async function check(full: string): Promise<void> {
    setStatus({ kind: 'verifying' });
    try {
      const signedIn = await api.doorCodeSignIn(code, handle, full);
      setStatus({ kind: 'verified' });
      onLeave({ kind: 'signedIn', signedIn });
    } catch (error) {
      if (error instanceof ApiError && error.is('phone_alternative'))
        onLeave({ kind: 'alternative' });
      else if (
        error instanceof ApiError &&
        (error.status === 429 || error.status === 404 || error.is('door_code_invalid'))
      )
        onLeave({ kind: 'refused', error });
      else setStatus(codeRefusal(error) satisfies CodeStatus);
    }
  }

  async function sendNew(): Promise<void> {
    try {
      restart(await api.resendPhoneSignIn(handle));
      setStatus({ kind: 'entering' });
    } catch (error) {
      const seconds = retryAfter(error);
      if (seconds == null) setStatus({ kind: 'failed' });
      else restart(seconds);
    }
  }

  async function textInstead(): Promise<void> {
    try {
      await api.textPhoneSignInInstead(handle);
      setRoute('sms_chosen');
      setStatus({ kind: 'entering' });
    } catch {
      setStatus({ kind: 'failed' });
    }
  }

  return (
    <CodeStep
      copy="verifyPhone"
      title={texted ? t('redeem.phone.checkMessages') : t('redeem.phone.checkWhatsApp')}
      intro={
        texted ? t('redeem.phone.texted', { number }) : t('redeem.phone.sentWhatsApp', { number })
      }
      wrong={texted ? t('redeem.phone.wrongText') : t('redeem.phone.wrongWhatsApp')}
      status={status}
      cooldown={left}
      onCode={(full) => void check(full)}
      onResend={() => void sendNew()}
      testID="redeem.code"
    >
      {wording.offerText && status.kind !== 'exhausted' && (
        <QuietButton
          label={t('redeem.phone.textInstead')}
          onPress={() => void textInstead()}
          testID="redeem.code.text"
        />
      )}
    </CodeStep>
  );
}

const styles = StyleSheet.create({
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  country: { flexBasis: 120 },
  grow: { flex: 1, minWidth: 0 },
});
