import { ApiError, type SignedIn, type TwoFactorChallenge } from '@soirely/api-client';
import { cleanCode, codeProblem, maskedPhone } from '@soirely/domain';
import { type FormEvent, type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { statusFrom } from '../../secondFactorStatus.ts';
import { Field, Primary, Says, Title } from './RedeemPhone.tsx';

/** "Enter your code" after a link's phone code, in the link's own look, as the web demo's `two-factor` state draws it (sc-4235). */
export function StaffTwoFactor({
  challenge,
  titleRef,
  fieldRef,
  onPassed,
  onExpired,
  onRecovery,
}: {
  challenge: TwoFactorChallenge;
  titleRef: RefObject<HTMLHeadingElement | null>;
  fieldRef: RefObject<HTMLInputElement | null>;
  onPassed: (signedIn: SignedIn) => Promise<void>;
  onExpired: () => void;
  onRecovery: () => void;
}) {
  const { t } = useTranslation();
  const [digits, setDigits] = useState('');
  const [said, setSaid] = useState<{ words: string; alert: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const who =
    challenge.email === '' && challenge.phone != null
      ? t('twoFactor.introNumber', { number: maskedPhone(challenge.phone) })
      : t('twoFactor.intro', { email: challenge.email });

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const problem = codeProblem(digits);
    if (problem != null) {
      setSaid({
        words: t(problem === 'blank' ? 'twoFactor.codeBlank' : 'twoFactor.codeLength'),
        alert: false,
      });
      fieldRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      await onPassed(await api.verifyTwoFactor(challenge.challenge, { code: cleanCode(digits) }));
    } catch (refusal) {
      setBusy(false);
      if (refusal instanceof ApiError && refusal.is('two_factor_challenge_invalid')) {
        onExpired();
        return;
      }
      const status = statusFrom(refusal, 'app', t);
      setSaid({
        words:
          status.kind === 'wrong'
            ? status.message
            : status.kind === 'paused'
              ? t('twoFactor.pausedBody', { time: status.time })
              : t('redeem.line.failed'),
        alert: true,
      });
      fieldRef.current?.select();
    }
  }

  return (
    <div className="rd-form">
      <Title titleRef={titleRef}>{t('twoFactor.title')}</Title>
      <p className="rd-intro">{who}</p>
      <form className="rd-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="rd-group">
          <Field
            id="ss-authenticator"
            label={t('twoFactor.code')}
            value={digits}
            told={said == null ? undefined : 'ss-authenticator-line'}
            inputRef={fieldRef}
            code
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            onChange={(typed) => {
              setDigits(typed.replace(/\D/gu, '').slice(0, 6));
              setSaid(null);
            }}
          />
          <Says id="ss-authenticator-line" alert={said?.alert ?? false}>
            {said?.words ?? null}
          </Says>
        </div>
        <Primary submit busy={busy}>
          {busy ? t('staffLink.signIn.signingIn') : t('twoFactor.verify')}
        </Primary>
      </form>
      <button type="button" className="rd-quiet" onClick={onRecovery}>
        {t('twoFactor.useRecovery')}
      </button>
    </div>
  );
}
