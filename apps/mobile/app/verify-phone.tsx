import { type Account, phoneAwaitingCode } from '@soirely/api-client';
import { cleanCode, codeProblem, formatPhone } from '@soirely/domain';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../src/api.ts';
import { verifyWords } from '../src/kit/accountPage.ts';
import { AuthFrame, AuthHeading } from '../src/components/AuthFrame.tsx';
import {
  BackToAccount,
  BackToAccountButton,
  RemoveInAccount,
} from '../src/components/BackToAccount.tsx';
import {
  Footnote,
  Footnotes,
  PrimaryButton,
  QuietButton,
  SecondaryButton,
} from '../src/components/Buttons.tsx';
import { CodeForm } from '../src/components/CodeForm.tsx';
import { focusChecked, keysStayDown } from '../src/components/Field.tsx';
import { Notice } from '../src/components/Notice.tsx';
import { rereadAccount } from '../src/signedIn.ts';
import { CodeStep, NEXT_STEP_MS } from '../src/steps/CodeStep.tsx';
import { Says } from '../src/steps/Lines.tsx';
import { skipPhone } from '../src/steps/skipPhone.ts';
import { useCodeCheck } from '../src/steps/useCodeCheck.ts';
import { NavBar, StepScreen } from '../src/steps/StepScreen.tsx';
import { tokens } from '../src/theme/tokens.ts';

export default function VerifyPhone() {
  const { t } = useTranslation();
  const { from, phone: alternative } = useLocalSearchParams<{ from?: string; phone?: string }>();
  const onboarding = from === 'onboarding' && alternative == null;
  const [account, setAccount] = useState<Account | 'none' | null>(null);
  const check = useCodeCheck('phone', alternative);
  const { status, setStatus, cooldown, wording, textingFailed, textedByTap } = check;
  const [codeError, setCodeError] = useState<'blank' | 'short' | null>(null);
  const codeInput = useRef<TextInputInstance>(null);
  // From the verify answer, never the list read before it: the server decides (sc-2244).
  const [madePrimary, setMadePrimary] = useState<boolean | null>(null);

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

    return () => {
      live = false;
    };
  }, []);

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
  // The step's green boxes are its only word that it worked: a number already proved goes on.
  if (onboarding && phone.verified && status.kind !== 'verified') return <Redirect href="/" />;

  async function verify(typed: string): Promise<void> {
    const problem = codeProblem(typed);
    const code = cleanCode(typed);

    if (problem != null) {
      setCodeError(problem);
      focusChecked(codeInput);

      return;
    }

    setCodeError(null);
    keysStayDown();
    setStatus({ kind: 'verifying' });

    const checked = await check.verify(code);
    if (!checked.verified) return;

    setMadePrimary(checked.primary);
    if (onboarding) setTimeout(() => router.replace('/'), NEXT_STEP_MS);
    // Account, under this screen, shows the row verified however it is reached.
    if (alternative != null) void rereadAccount().catch(() => {});
  }

  const words = verifyWords(wording.line, number, t);
  const fieldError =
    codeError != null ? words[codeError] : status.kind === 'wrong' ? words.wrong : null;
  const line = words.lead;

  if (onboarding) {
    const short = account.providers.some(
      (one) => one.provider === 'google' || one.provider === 'apple',
    );
    const done = status.kind === 'verified';

    return (
      <StepScreen
        nav={
          <NavBar
            onLeft={() =>
              router.canGoBack() ? router.back() : router.replace('/phone?from=onboarding')
            }
            step={short ? [done ? 2.4 : 2, 2] : [done ? 4.4 : 4, 4]}
            right={{
              label: t('steps.skip'),
              onPress: () => void skipPhone().catch(() => setStatus({ kind: 'failed' })),
            }}
            testID="verifyPhone"
          />
        }
      >
        <CodeStep
          copy="verifyPhone"
          title={wording.fromWhatsApp ? t('steps.whatsAppTitle') : t('verifyPhone.title')}
          intro={line}
          wrong={words.wrong}
          status={status}
          cooldown={cooldown}
          onCode={(code) => void verify(code)}
          onResend={() => void check.resend()}
          testID="verifyPhone"
        >
          {wording.offerText && (
            <QuietButton
              label={t('verifyPhone.textInstead')}
              onPress={() => void check.textInstead()}
              testID="verifyPhone.textInstead"
            />
          )}
          {textingFailed != null && <Says words={t('verifyPhone.textInsteadFailed')} />}
        </CodeStep>
      </StepScreen>
    );
  }

  return (
    <AuthFrame
      atFoot={verified}
      saying={
        <>
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
            introAnswer={wording.line === 'chosen' ? textedByTap : undefined}
            answer={status.kind === 'verified' && status.tapped === true ? status : undefined}
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
          onResend={() => void check.resend()}
          inputRef={codeInput}
          codeLabel={wording.fromWhatsApp ? t('verifyPhone.codeLabelWhatsApp') : undefined}
        >
          {wording.offerText && (
            <SecondaryButton
              label={t('verifyPhone.textInstead')}
              onPress={() => void check.textInstead()}
              testID="verifyPhone.textInstead"
            />
          )}
          {textingFailed != null && (
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('verifyPhone.textInsteadFailed')}
              answer={textingFailed}
            />
          )}

          <Footnotes>
            {alternative == null ? (
              <Footnote
                question={t('verifyPhone.wrongNumber')}
                action={t('verifyPhone.changeIt')}
                onPress={() => router.push('/phone')}
                testID="verifyPhone.change"
              />
            ) : (
              <RemoveInAccount kind="phone" />
            )}
          </Footnotes>
        </CodeForm>
      )}
    </AuthFrame>
  );
}
