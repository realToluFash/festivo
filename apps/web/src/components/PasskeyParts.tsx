import { ApiError, type PasskeyAnswer, type PasskeyOptions } from '@soirely/api-client';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { offButton } from '../offButton.ts';
import { makePasskey } from '../passkey.ts';
import { Lead } from './AccountParts.tsx';
import { Glyph } from './Glyph.tsx';
import { Chevron, Dialog, Note, RowWords } from './SettingsParts.tsx';
import './PasskeyParts.css';

/** Synced or This device only, from the BS flag: a shape with its word, never colour alone. */
export function PasskeyMark({ synced }: { synced: boolean }) {
  const { t } = useTranslation();

  return (
    <span className="passkey-mark">
      {synced ? (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.5 19H8a5 5 0 1 1 1.1-9.9A6 6 0 0 1 20.6 11 4 4 0 0 1 17.5 19Z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
      )}
      {synced ? t('passkey.synced') : t('passkey.deviceOnly')}
    </span>
  );
}

export function PasskeyLead() {
  return (
    <span className="account-lead passkey-lead" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24">
        <circle cx="9" cy="7.5" r="3.5" />
        <path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3" />
        <circle cx="17" cy="13.5" r="2.5" />
        <path d="M17 16v5.5M17 19h2" />
      </svg>
    </span>
  );
}

export type FactorRowOf =
  | { kind: 'app'; day: string }
  | { kind: 'passkey'; provider: string | null; synced: boolean; day: string };

/** A factor's row on Security: the app, or a passkey by its provider, opening on what it can do. */
export function FactorOpenable({
  row,
  on,
  onToggle,
  children,
}: {
  row: FactorRowOf;
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const title =
    row.kind === 'app' ? t('security.authenticator') : (row.provider ?? t('passkey.name'));

  return (
    <li>
      <button
        type="button"
        className={on ? 'desk-row account-row is-open' : 'desk-row account-row'}
        aria-expanded={on}
        aria-controls={on ? id : undefined}
        onClick={onToggle}
      >
        {row.kind === 'app' ? <Lead name="shield" /> : <PasskeyLead />}
        <RowWords
          title={
            row.kind === 'passkey' && row.provider != null ? (
              <>
                {title}
                <span className="desk-unseen"> {t('passkey.name')}</span>
              </>
            ) : (
              title
            )
          }
          lines={[
            row.kind === 'app' ? (
              t('passkey.appOn', { day: row.day })
            ) : (
              <span key="line" className="passkey-line">
                <PasskeyMark synced={row.synced} />
                <span aria-hidden="true">·</span>
                {t('passkey.added', { day: row.day })}
              </span>
            ),
          ]}
        />
        <Glyph name={on ? 'chevup' : 'chevdown'} size={18} weight={2.4} className="desk-chevron" />
      </button>
      {on && (
        <div id={id} className="account-open" role="group" aria-label={title}>
          {children}
        </div>
      )}
    </li>
  );
}

export function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className="desk-row account-row" onClick={onClick}>
        <span className="account-lead" aria-hidden="true">
          <Glyph name="plus" size={22} />
        </span>
        <RowWords title={label} />
        <Chevron />
      </button>
    </li>
  );
}

export function Waiting() {
  const { t } = useTranslation();

  return (
    <p className="passkey-waiting" role="status">
      <span className="pending-spinner desk-turning" aria-hidden="true" />
      {t('passkey.waiting')}
    </p>
  );
}

export function Refused({ line }: { line: string }) {
  return (
    <p className="passkey-refused" role="alert">
      <Glyph name="alert" size={18} weight={2.2} />
      {line}
    </p>
  );
}

export function NoBrowser() {
  const { t } = useTranslation();

  return (
    <p className="passkey-nobrowser">
      <Glyph name="info" size={18} weight={2.2} />
      {t('passkey.noBrowser')}
    </p>
  );
}

/** Opens the browser's sheet to save a passkey, then sends it; a closed sheet sends nothing. */
function useMaking(
  options: () => Promise<PasskeyOptions>,
  add: (passkey: PasskeyAnswer) => Promise<void>,
) {
  const { t } = useTranslation();
  const [making, setMaking] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  async function make(): Promise<void> {
    if (making) return;
    setMaking(true);
    setRefused(null);
    try {
      const made = await makePasskey(await options());
      if (made != null) await add(made);
    } catch (error) {
      setRefused(
        error instanceof ApiError && error.is('passkey_limit')
          ? t('passkey.atMost', { count: 10 })
          : t('passkey.refused'),
      );
    }
    setMaking(false);
  }

  return { making, refused, make };
}

/** Turn on two-factor, where the browser can make a passkey: a passkey, or the app as today. */
export function ChoiceDialog({
  options,
  add,
  onClose,
  onApp,
}: {
  options: () => Promise<PasskeyOptions>;
  add: (passkey: PasskeyAnswer) => Promise<void>;
  onClose: () => void;
  onApp: () => void;
}) {
  const { t } = useTranslation();
  const first = useRef<HTMLButtonElement>(null);
  const { making, refused, make } = useMaking(options, add);

  return (
    <Dialog
      title={t('twoFactorCard.turnOn')}
      verb={null}
      locked={making}
      first={first}
      onDismiss={onClose}
      onConfirm={() => undefined}
    >
      <Note strong>{t('passkey.choiceAsk')}</Note>
      <ul className="desk-rows account-rows passkey-choices">
        <li>
          <button
            ref={first}
            type="button"
            className="desk-row account-row"
            aria-busy={making || undefined}
            {...offButton(making, { dim: false })}
            onClick={() => void make()}
          >
            <PasskeyLead />
            <RowWords
              title={t('passkey.use')}
              lines={[making ? t('passkey.waiting') : t('passkey.usePasskeyLine')]}
            />
            {making ? (
              <span className="pending-spinner desk-turning" aria-hidden="true" />
            ) : (
              <Chevron />
            )}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="desk-row account-row"
            {...offButton(making)}
            onClick={onApp}
          >
            <Lead name="shield" />
            <RowWords title={t('passkey.useApp')} lines={[t('passkey.useAppLine')]} />
            <Chevron />
          </button>
        </li>
      </ul>
      <div role="status" className="desk-unseen">
        {making ? t('passkey.waiting') : ''}
      </div>
      {refused != null && <Refused line={refused} />}
      <p className="desk-foot">{t('passkey.ownDevice')}</p>
    </Dialog>
  );
}

/** Add a passkey, once the current factor has passed: the sheet opens as it arrives. */
export function MakeDialog({
  options,
  add,
  onClose,
}: {
  options: () => Promise<PasskeyOptions>;
  add: (passkey: PasskeyAnswer) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { making, refused, make } = useMaking(options, add);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void make();
    // Once, as it arrives: the factor that passed paid for this one sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      title={t('passkey.makeTitle')}
      verb={null}
      locked={making}
      onDismiss={onClose}
      onConfirm={() => undefined}
    >
      <Note>{t('passkey.makeLine')}</Note>
      {making && <Waiting />}
      {refused != null && <Refused line={refused} />}
      <p className="desk-foot">{t('passkey.ownDevice')}</p>
    </Dialog>
  );
}
