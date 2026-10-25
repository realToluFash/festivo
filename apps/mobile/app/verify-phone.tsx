import { type Account, type PhoneCodeRoute, phoneAwaitingCode } from '@soirely/api-client';
import { cleanCode, codeProblem, codeWording, formatPhone } from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import {
  BackToAccount,
  BackToAccountButton,
  RemoveInAccount,
} from '../src/components/BackToAccount.tsx';
import { Footnote, PrimaryButton, SecondaryButton } from '../src/components/Buttons.tsx';
import { CodeForm } from '../src/components/CodeForm.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { OnboardingSteps } from '../src/components/OnboardingSteps.tsx';
import { type CodeStatus, codeRefusal, openingStatus, retryAfter } from '../src/kit/code.ts';
import { rereadAccount } from '../src/signedIn.ts';
import { tokens } from '../src/theme/tokens.ts';

type Status = CodeStatus | { kind: 'verified' };

export default function VerifyPhone() {
  const { t } = useTranslation();
  const { from, phone: alternative } = useLocalSearchParams<{ from?: string; phone?: string }>();
  const onboarding = from === 'onboarding' && alternative == null;
  const [account, setAccount] = useState<Account | 'none' | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'entering' });
  const [cooldown, setCooldown] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [route, setRoute] = useState<PhoneCodeRoute | null>(null);
  const [textingFailed, setTextingFailed] = useState(false);
  // From the verify answer, never the list read before it: the server decides (sc-2244).
  const [madePrimary, setMadePrimary] = useState<boolean | null>(null);
  const wording = codeWording(route);

  useEffect(() => {
    let live = true;

    api
      .me()
      .then((me) => {
        if (live) setAccount(me);
      })
      .catch(() => {
        if (live) setAccount('none');
      });

    api
      .phoneOpening(alternative)
      .then(({ cooldownSeconds, codeState, route: sent }) => {
        if (!live) return;
        setCooldown(cooldownSeconds);
        setRoute(sent);
        setStatus((now) => (now.kind === 'verified' ? now : openingStatus(now, codeState)));
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [alternative]);

  // While the code is on WhatsApp, the server may hand it to SMS: the line follows within a few seconds.
  useEffect(() => {
    if (!wording.watch) return;

    const watching = setInterval(() => {
      api
        .phoneOpening(alternative)
        .then((opening) => setRoute(opening.route))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(watching);
  }, [wording.watch, alternative]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const tick = setTimeout(() => setCooldown((left) => left - 1), 1000);

    return () => clearTimeout(tick);
  }, [cooldown]);

  if (account === 'none') return <Redirect href="/sign-in" />;
  if (account == null) return null;

  // A number added from Settings > Account (sc-113), by its id: verified here, then back there.
  const phone =
    alternative == null
      ? phoneAwaitingCode(account)
      : (account.phoneNumbers.find((held) => held.id === alternative) ?? null);
  if (phone == null && alternative != null) return <Redirect href="/settings/account" />;
  if (phone == null) return <Redirect href={onboarding ? '/phone?from=onboarding' : '/phone'} />;

  const number = formatPhone(phone.number);
  const verified = status.kind === 'verified' || phone.verified;

  async function verify(typed: string): Promise<void> {
    const problem = codeProblem(typed);
    const code = cleanCode(typed);

    if (problem != null) {
      setCodeError(
        problem === 'short'
          ? t('verifyPhone.codeShort')
          : wording.fromWhatsApp
            ? t('verifyPhone.codeBlankWhatsApp')
            : t('verifyPhone.codeBlank'),
      );

      return;
    }

    setCodeError(null);
    setStatus({ kind: 'verifying' });

    try {
      setMadePrimary((await api.verifyPhone(code, alternative)).primary);
      setStatus({ kind: 'verified' });
      // Account, under this screen, shows the row verified however it is reached.
      if (alternative != null) void rereadAccount().catch(() => {});
    } catch (error) {
      setStatus(codeRefusal(error));
    }
  }

  async function resend(): Promise<void> {
    try {
      setCooldown(await api.resendPhoneCode(alternative));
      setStatus({ kind: 'entering' });
      setRoute((await api.phoneOpening(alternative)).route);
    } catch (error) {
      const seconds = retryAfter(error);

      if (seconds == null) {
        setStatus({ kind: 'failed' });

        return;
      }

      setCooldown(seconds);
      setStatus({ kind: 'entering' });
    }
  }

  // Saving the details with no number removes the phone, so the gate rests on the email again.
  async function withoutPhone(name: string): Promise<void> {
    try {
      await api.completeProfile({ name });
      router.replace('/');
    } catch {
      setStatus({ kind: 'failed' });
    }
  }

  async function textInstead(): Promise<void> {
    setTextingFailed(false);

    try {
      await api.textPhoneCodeInstead(alternative);
      setRoute('sms_chosen');
    } catch {
      setTextingFailed(true);
    }
  }

  const wrong = wording.fromWhatsApp ? t('verifyPhone.wrongWhatsApp') : t('verifyPhone.wrong');
  const fieldError = codeError ?? (status.kind === 'wrong' ? wrong : null);
  const line = {
    whatsapp: t('verifyPhone.introWhatsApp', { number }),
    fallback: t('verifyPhone.introFallback', { number }),
    chosen: t('verifyPhone.introChosen', { number }),
    texted: t('verifyPhone.intro', { number }),
  }[wording.line];

  return (
    <AuthFrame
      atFoot={verified}
      saying={
        <>
          {onboarding && <OnboardingSteps at="details" />}
          {alternative != null && !verified && <BackToAccount />}
          <AuthHeading
            done={verified}
            title={verified ? t('verifyPhone.doneTitle') : t('verifyPhone.title')}
            intro={
              !verified
                ? line
                : alternative == null
                  ? t('verifyPhone.doneBody', { number })
                  : (madePrimary ?? phone.primary)
                    ? t('contacts.verifiedPrimaryPhone', { number })
                    : t('verifyPhone.doneBodyAlternative', { number })
            }
            introLive={!verified}
          />
        </>
      }
    >
      {verified && alternative != null ? (
        <BackToAccountButton verified={alternative} />
      ) : verified ? (
        <PrimaryButton
          label={t('verifyPhone.continue')}
          onPress={() => router.replace('/')}
          testID="verifyPhone.continue"
        />
      ) : (
        <CodeForm
          copy="verifyPhone"
          status={status}
          cooldown={cooldown}
          error={fieldError}
          onTyped={() => setCodeError(null)}
          onLeft={() => {}}
          onVerify={(code) => void verify(code)}
          onResend={() => void resend()}
          codeLabel={wording.fromWhatsApp ? t('verifyPhone.codeLabelWhatsApp') : undefined}
        >
          {wording.offerText && (
            <SecondaryButton
              label={t('verifyPhone.textInstead')}
              onPress={() => void textInstead()}
              testID="verifyPhone.textInstead"
            />
          )}
          {textingFailed && (
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('verifyPhone.textInsteadFailed')}
            />
          )}

          {alternative == null ? (
            <Footnote
              question={t('verifyPhone.wrongNumber')}
              action={t('verifyPhone.changeIt')}
              onPress={() => router.push(onboarding ? '/phone?from=onboarding' : '/phone')}
              testID="verifyPhone.change"
            />
          ) : (
            <RemoveInAccount kind="phone" />
          )}

          {onboarding && (
            <Footnote
              question={t('verifyPhone.cantGetTexts')}
              action={t('verifyPhone.carryOnWithout')}
              onPress={() => void withoutPhone(account.name)}
              testID="verifyPhone.carryOn"
            />
          )}
        </CodeForm>
      )}
    </AuthFrame>
  );
}
