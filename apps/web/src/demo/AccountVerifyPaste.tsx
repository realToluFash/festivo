import { cleanCode, codeProblem } from '@soirely/domain';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CodeError,
  type ContactKind,
  type ContactRow,
  type VerifyWords,
  verifyWords,
} from '../accountPage.ts';
import { type CodeSource, useCodeCheck } from '../codeCheck.ts';
import { ExpiredCode } from '../components/AccountParts.tsx';
import { type Opening, useTriedOnArrival } from '../components/AccountDialogs.tsx';
import { FieldError } from '../components/FieldError.tsx';
import { Dialog, Field, Note } from '../components/SettingsParts.tsx';
import { offButton } from '../offButton.ts';
import { useStepFocus } from '../stepFocus.ts';
import { PasteCode } from './PasteCode.tsx';
import { usePasteCode } from './usePasteCode.ts';

/** Account's VerifyDialog with Paste code under the field for a code sent to a phone number (sc-99215). The paste fills the field and sends nothing: Verify does. */
export function VerifyPasteDialog({
  kind,
  row,
  source,
  start,
  onClose,
  onVerified,
}: {
  kind: ContactKind;
  row: ContactRow;
  source: CodeSource;
  start?: Opening;
  onClose: () => void;
  onVerified: (primary: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const resendButton = useRef<HTMLButtonElement>(null);
  const [textedLine, arriveAtTexted] = useStepFocus<HTMLParagraphElement>({ onlyIfLost: true });
  const email = kind === 'email';
  const [held] = useState(source);
  const check = useCodeCheck(kind, held);
  const { status, resending, wording } = check;
  const cooldown = resending.cooldown;
  const [typed, setTyped] = useState(start?.typed ?? '');
  const [error, setError] = useState<CodeError | null>(null);
  const paste = usePasteCode(input, (code) => {
    setTyped(code);
    setError(null);
  });
  const [resendFailed, setResendFailed] = useState(false);
  const words: VerifyWords = verifyWords(email ? 'email' : wording.line, row.shown, t);
  const shownError = error === 'failed' ? t('verifyEmail.failedBody') : error && words[error];
  const spent =
    status.kind === 'expired'
      ? words.expired
      : status.kind === 'exhausted'
        ? words.exhausted
        : null;
  const busy = status.kind === 'verifying' || status.kind === 'verified';

  // The opening may answer spent after the code field took focus: the field goes, and focus with it.
  useLayoutEffect(() => {
    if (status.kind !== 'expired' && status.kind !== 'exhausted') return;
    const held = document.activeElement;
    if (held == null || held === document.body) resendButton.current?.focus();
  }, [status.kind]);

  async function verify(): Promise<void> {
    if (busy || spent != null) return;
    const problem = codeProblem(typed);
    if (problem != null) {
      setError(problem);
      return input.current?.focus();
    }
    setResendFailed(false);
    const checked = await check.verify(cleanCode(typed));
    if (checked == null) return;
    if (checked.verified) return onVerified(checked.primary);
    if (checked.refusal.kind === 'wrong' || checked.refusal.kind === 'failed') {
      setError(checked.refusal.kind);
      input.current?.focus();
      input.current?.select();
    } else resendButton.current?.focus();
  }

  useTriedOnArrival(start?.tried, () => void verify());

  async function resend(): Promise<void> {
    if (cooldown > 0) return;
    const resent = await check.resend();
    if (resent == null) return;
    setResendFailed(resent === 'failed');
    if (resent === 'failed') return;
    setTyped('');
    setError(null);
    window.requestAnimationFrame(() => input.current?.focus());
  }

  async function textInstead(): Promise<void> {
    if (await check.textInstead()) arriveAtTexted();
  }

  const note = check.textingFailed
    ? t('verifyPhone.textInsteadFailed')
    : resendFailed
      ? t('verifyEmail.failedBody')
      : null;

  return (
    <Dialog
      title={words.title}
      verb={t('account.verify')}
      on={spent == null && !busy}
      locked={busy}
      first={spent == null ? input : resendButton}
      onDismiss={onClose}
      onConfirm={() => void verify()}
    >
      <Note ref={textedLine} tabIndex={check.texted ? -1 : undefined}>
        {words.lead}
      </Note>
      {spent != null ? (
        <ExpiredCode title={spent.title} line={spent.line} />
      ) : (
        <div className="desk-fields">
          <Field
            label={words.codeLabel}
            value={typed}
            inputMode="numeric"
            autoComplete="one-time-code"
            inputRef={input}
            error={shownError}
            onChange={(value) => {
              setTyped(value);
              setError(null);
              paste.typed();
            }}
          />
          {!email && <PasteCode id={`verify-${row.id}-paste`} paste={paste} />}
        </div>
      )}
      <div className="desk-red">
        <button
          ref={resendButton}
          type="button"
          className={cooldown > 0 ? 'desk-text account-wait' : 'desk-text'}
          {...offButton(cooldown > 0, { dim: false })}
          onClick={() => void resend()}
        >
          {resending.label}
        </button>
        <p className="desk-note">{t('verifyEmail.resendNote')}</p>
        <span className="visually-hidden" role="status">
          {resending.status}
        </span>
        {!email && wording.offerText && spent == null && (
          <button type="button" className="desk-text" onClick={() => void textInstead()}>
            {t('verifyPhone.textInstead')}
          </button>
        )}
      </div>
      {note != null && <FieldError id={`verify-${row.id}-failed`} message={note} />}
    </Dialog>
  );
}
