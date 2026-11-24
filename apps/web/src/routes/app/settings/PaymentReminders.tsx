import { ApiError, type Membership, type PaymentRemindersSetting } from '@soirely/api-client';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { PageLoading } from '../../../components/DataControlParts.tsx';
import {
  Card,
  CardStep,
  DeskPage,
  Dialog,
  Field,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import { BudgetRow, Rows } from '../events/QuoteParts.tsx';
import { typedDays } from './paymentReminders.ts';
import '../../../components/SettingsParts.css';
import '../events/quotes.css';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; setting: PaymentRemindersSetting };

/** Settings › Vendors › Payment reminders (sc-95), for Owners and Admins, as the web demo's /demo/settings/payment-reminders draws it. */
export function PaymentReminders() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'organisation.manage')) return <Forbidden />;

  return <RemindersDesk key={organisation.id} organisation={organisation} />;
}

function RemindersDesk({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const { layers, covered, setHost } = useDeskLayers();
  const desk = useDeskTop();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [changing, setChanging] = useState(false);
  const said = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    api.paymentReminders(organisation.id).then(
      (setting) => {
        if (live) setLoad({ kind: 'loaded', setting });
      },
      () => {
        if (live) setLoad({ kind: 'failed' });
      },
    );

    return () => {
      live = false;
    };
  }, [organisation.id, attempt]);

  return (
    <DeskPage layers={layers}>
      <div className="desk-page" inert={covered}>
        <div className="desk-column">
          {desk.above}
          {desk.said}
          {load.kind === 'loading' && <PageLoading words={t('paymentReminders.loading')} />}
          {load.kind === 'failed' && (
            <div className="desk-failed" role="alert">
              <h2>{t('paymentReminders.failed')}</h2>
              <p className="desk-line">{t('paymentReminders.failedLine')}</p>
              <TextAction
                label={t('paymentReminders.tryAgain')}
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((one) => one + 1);
                }}
              />
            </div>
          )}
          {load.kind === 'loaded' && (
            <Setting setting={load.setting} said={said} onChange={() => setChanging(true)} />
          )}
        </div>
        {changing && load.kind === 'loaded' && (
          <DaysDialog
            organisationId={organisation.id}
            days={load.setting.days}
            onDismiss={() => setChanging(false)}
            onSaved={(setting) => {
              setLoad({ kind: 'loaded', setting });
              setChanging(false);
              focusWhenFree(() => said.current);
            }}
          />
        )}
      </div>
      <div ref={setHost} className="desk-layers" />
    </DeskPage>
  );
}

function Setting({
  setting,
  said,
  onChange,
}: {
  setting: PaymentRemindersSetting;
  said: RefObject<HTMLHeadingElement | null>;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const off = !setting.inForce;

  return (
    <>
      <Card>
        <div className="desk-said-lines">
          <h1 ref={said} className="desk-says pay-says" tabIndex={-1}>
            {off ? t('paymentReminders.off') : t('paymentReminders.title')}
          </h1>
          <p className="desk-on-card" aria-live="polite">
            {off
              ? t('paymentReminders.offLine')
              : t('paymentReminders.whenReminded', { count: setting.days })}
          </p>
        </div>
        {!off && <CardStep label={t('paymentReminders.change')} onClick={onChange} />}
      </Card>
      <Rows>
        <li>
          <BudgetRow
            title={t('paymentReminders.whoHears')}
            lines={[t('paymentReminders.whoHearsLine')]}
          />
        </li>
        <li>
          <BudgetRow
            title={t('paymentReminders.how')}
            lines={[t('paymentReminders.howLine')]}
            to="/app/account/notifications"
          />
        </li>
      </Rows>
      <p className="pay-note">{t('paymentReminders.stopsReminders')}</p>
    </>
  );
}

function DaysDialog({
  organisationId,
  days,
  onDismiss,
  onSaved,
}: {
  organisationId: string;
  days: number;
  onDismiss: () => void;
  onSaved: (setting: PaymentRemindersSetting) => void;
}) {
  const { t } = useTranslation();
  const field = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(String(days));
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const refusal = t('paymentReminders.enterDays');

  async function save(): Promise<void> {
    if (busy) return;
    const chosen = typedDays(typed);
    setFailed(false);
    if (chosen == null) {
      setProblem(refusal);
      field.current?.focus();
      return;
    }
    setBusy(true);
    try {
      onSaved(await api.updatePaymentReminders(organisationId, chosen));
    } catch (error) {
      setBusy(false);
      const words = error instanceof ApiError ? error.fieldErrors().days : undefined;
      if (words != null) {
        setProblem(words);
        field.current?.focus();
        return;
      }
      setFailed(true);
    }
  }

  return (
    <Dialog
      title={t('paymentReminders.title')}
      verb={busy ? t('budget.saving') : t('budget.save')}
      locked={busy}
      first={field}
      onDismiss={onDismiss}
      onConfirm={() => void save()}
    >
      {failed && (
        <div className="bt-alert" role="alert">
          {t('paymentReminders.notSaved')}
        </div>
      )}
      <form
        className="desk-fields"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field
          label={t('paymentReminders.daysField')}
          value={typed}
          inputMode="numeric"
          help={t('paymentReminders.daysHelp')}
          error={problem}
          inputRef={field}
          onChange={(next) => {
            setTyped(next);
            if (problem != null) setProblem(typedDays(next) == null ? refusal : null);
          }}
        />
      </form>
    </Dialog>
  );
}
