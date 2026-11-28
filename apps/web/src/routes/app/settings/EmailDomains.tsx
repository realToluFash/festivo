import {
  ApiError,
  type EmailDomain,
  type EmailDomainsPage,
  type Membership,
} from '@soirely/api-client';
import { companyDomainProblem, domainOf, normaliseDomain } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { Refreshing } from '../../../components/OfflineBand.tsx';
import { NoTag, PageLoading, StatusLine } from '../../../components/DataControlParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  Ask,
  BackRow,
  Card,
  CardStep,
  DeskPage,
  Dialog,
  Field,
  Head,
  Note,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import {
  type DomainsSaid,
  domainLine,
  keptLine,
  domainsCard,
  isProved,
  onlyLine,
  recordFoot,
} from './emailDomains.ts';
import { DATA_AND_CONTROL } from './ExportAllData.tsx';
import { RecordRows } from './RecordRows.tsx';
import { useEmailDomains } from './useEmailDomains.ts';
import '../../../components/SettingsParts.css';

export const EMAIL_DOMAINS = `${DATA_AND_CONTROL}/email-domains`;

/** Data and control › Email domains at a desk (sc-560, sc-563), as the design demo's /demo/settings/data-and-control/email-domains draws it. */
export function EmailDomains() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'organisation.manage')) return <Forbidden />;

  return (
    <DomainsDesk
      key={organisation.id}
      organisation={organisation}
      example={domainOf(session.email) ?? 'example.com'}
      zone={session.timezone}
    />
  );
}

function DomainsDesk({
  organisation,
  example,
  zone,
}: {
  organisation: Membership;
  example: string;
  zone: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const desk = useDeskTop();
  const { layers, covered, setHost } = useDeskLayers();
  const [search, setSearch] = useSearchParams();
  const title = useRef<HTMLHeadingElement>(null);
  const { load, show, reload, refreshing } = useEmailDomains(organisation.id, title);
  const [record, setRecord] = useState<string | null>(() => search.get('record'));
  const [proving] = useState(() => search.has('prove'));
  const [told, setTold] = useState<string | null>(null);

  useEffect(() => {
    if (search.has('record') || search.has('prove')) setSearch({}, { replace: true });
  }, [search, setSearch]);

  return (
    <DeskPage layers={layers}>
      <div className="desk-column" inert={covered}>
        {refreshing && <Refreshing />}
        <BackRow
          to={t('dataControl.title')}
          onBack={() => void navigate(DATA_AND_CONTROL)}
          bell={desk.bell}
        />
        <TitleRow title={t('emailDomains.title')} titleRef={title} underBack />
        {load.kind === 'loading' && <PageLoading words={t('emailDomains.loading')} />}
        {load.kind === 'failed' && (
          <div className="desk-failed" role="alert">
            <h2>{t('emailDomains.failed')}</h2>
            <p className="desk-line">{t('dataControl.failedLine')}</p>
            <TextAction label={t('dataControl.tryAgain')} onClick={reload} />
          </div>
        )}
        {load.kind === 'loaded' && (
          <Loaded
            page={load.page}
            organisation={organisation}
            example={example}
            record={record}
            proving={proving}
            onRecord={setRecord}
            onPage={show}
            tell={setTold}
            day={(at) =>
              new Intl.DateTimeFormat(dateLocale(), {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                timeZone: zone ?? 'UTC',
              }).format(new Date(at))
            }
          />
        )}
      </div>
      <div ref={setHost} className="desk-layers" />
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </DeskPage>
  );
}

function Loaded({
  page,
  organisation,
  example,
  record,
  proving,
  onRecord,
  onPage,
  tell,
  day,
}: {
  page: EmailDomainsPage;
  organisation: Membership;
  example: string;
  record: string | null;
  proving: boolean;
  onRecord: (domain: string | null) => void;
  onPage: (page: EmailDomainsPage) => void;
  tell: (words: string) => void;
  day: (at: string) => string;
}) {
  const { t } = useTranslation();
  const [said, setSaid] = useState<DomainsSaid>(null);
  const [adding, setAdding] = useState(proving && page.plan === 'enterprise');
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const saidLines = useRef<HTMLDivElement>(null);
  const toSaid = () => focusWhenFree(() => saidLines.current);
  const card = domainsCard(t, page, said, organisation.name);
  const enterprise = page.plan === 'enterprise';
  const recordOf = enterprise ? (page.domains.find((one) => one.domain === record) ?? null) : null;

  async function onlyOff(domain: string, kind: 'cancelled' | 'turnedOff'): Promise<void> {
    try {
      onPage(await api.switchOnlyOursOff(organisation.id, domain));
      setSaid({ kind, domain });
      toSaid();
    } catch {
      tell(t('dataControl.failedLine'));
    }
  }

  async function removeUnproved(domain: string): Promise<void> {
    try {
      onPage(await api.removeEmailDomain(organisation.id, domain));
      setSaid(null);
      tell(t('emailDomains.removed', { domain }));
    } catch {
      tell(t('dataControl.failedLine'));
    }
  }

  return (
    <>
      <Card>
        <div ref={saidLines} className="desk-said-lines" tabIndex={-1} aria-live="polite">
          <Says>{card.says}</Says>
          <OnCard>{card.line}</OnCard>
        </div>
        {card.record != null && (
          <CardStep
            label={t('emailDomains.seeRecord')}
            onClick={() => card.record != null && onRecord(card.record)}
          />
        )}
        {card.prove === true && enterprise && (
          <CardStep label={t('emailDomains.prove')} onClick={() => setAdding(true)} />
        )}
        {card.keep != null && (
          <CardStep
            label={t('emailDomains.keepAccounts', {
              domain: card.keep,
              organisation: organisation.name,
            })}
            onClick={() => setConfirming(card.keep)}
          />
        )}
      </Card>
      {page.plan !== 'free' && (
        <section className="desk-block">
          <Head title={t('emailDomains.block')}>
            {enterprise && (
              <TextAction
                label={t('emailDomains.prove')}
                before="plus"
                onClick={() => setAdding(true)}
              />
            )}
          </Head>
          {page.domains.length === 0 ? (
            <p className="desk-line dc-none">{t('emailDomains.none')}</p>
          ) : (
            <ul className="desk-rows dc-led">
              {page.domains.flatMap((domain) => [
                <DomainRow
                  key={domain.domain}
                  domain={domain}
                  kept={!enterprise}
                  onRecord={() => onRecord(domain.domain)}
                  onRemove={() => {
                    if (isProved(domain)) setRemoving(domain.domain);
                    else void removeUnproved(domain.domain);
                  }}
                />,
                ...(isProved(domain)
                  ? [
                      <OnlyRow
                        key={`${domain.domain}:only`}
                        domain={domain}
                        page={page}
                        day={day}
                        onSwitchOn={() => setConfirming(domain.domain)}
                        onOff={(kind) => void onlyOff(domain.domain, kind)}
                      />,
                    ]
                  : []),
              ])}
            </ul>
          )}
          <p className="desk-foot">{t('emailDomains.foot')}</p>
        </section>
      )}
      {recordOf != null && (
        <RecordDialog
          key={recordOf.domain}
          organisationId={organisation.id}
          domain={recordOf}
          onClose={() => onRecord(null)}
          onPage={onPage}
          onFound={() => {
            onRecord(null);
            setSaid({ kind: 'proved', domain: recordOf.domain });
            toSaid();
          }}
        />
      )}
      {adding && (
        <ProveDialog
          organisationId={organisation.id}
          example={example}
          onClose={() => setAdding(false)}
          onAdded={(answer, domain) => {
            onPage(answer);
            setSaid(null);
            setAdding(false);
            onRecord(domain);
          }}
        />
      )}
      {confirming != null && (
        <ConfirmAsk
          organisationId={organisation.id}
          organisation={organisation.name}
          domain={page.domains.find((one) => one.domain === confirming) ?? null}
          onKeep={() => setConfirming(null)}
          onScheduled={(answer) => {
            onPage(answer);
            setSaid({ kind: 'scheduled', domain: confirming });
            setConfirming(null);
            toSaid();
          }}
        />
      )}
      {removing != null && (
        <RemoveAsk
          organisationId={organisation.id}
          domain={removing}
          onKeep={() => setRemoving(null)}
          onRemoved={(answer) => {
            onPage(answer);
            setSaid({ kind: 'removed', domain: removing });
            setRemoving(null);
            toSaid();
          }}
        />
      )}
    </>
  );
}

function DomainRow({
  domain,
  kept,
  onRecord,
  onRemove,
}: {
  domain: EmailDomain;
  kept: boolean;
  onRecord: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = domain.domain;
  const tag = kept ? (
    <Tag kind="paused" word={t('emailDomains.kept')} />
  ) : domain.status === 'proved' ? (
    <Tag kind="yes" word={t('emailDomains.proved')} />
  ) : domain.status === 'failed' ? (
    <NoTag word={t('emailDomains.notProved')} />
  ) : (
    <Tag
      kind="waiting"
      word={domain.status === 'missing' ? t('emailDomains.missing') : t('emailDomains.waiting')}
    />
  );

  return (
    <li className="desk-row dc-domain">
      <span className="dc-lead" aria-hidden="true">
        <Glyph name="globe" size={22} />
      </span>
      <RowWords
        title={name}
        tag={tag}
        lines={[kept ? keptLine(t, domain) : domainLine(t, domain)]}
      />
      {!kept && (
        <span className="dc-actions">
          {domain.status !== 'proved' && (
            <button
              type="button"
              className="desk-text"
              aria-label={t('emailDomains.seeRecordFor', { domain: name })}
              onClick={onRecord}
            >
              {t('emailDomains.seeRecord')}
            </button>
          )}
          <button
            type="button"
            className="desk-text is-red"
            aria-label={t('emailDomains.removeLabel', { domain: name })}
            onClick={onRemove}
          >
            {isProved(domain) ? t('emailDomains.removeAsk') : t('emailDomains.remove')}
          </button>
        </span>
      )}
    </li>
  );
}

/** Under a proved domain: the Owner's switch, or Cancel while it is scheduled; anybody else reads it. */
function OnlyRow({
  domain,
  page,
  day,
  onSwitchOn,
  onOff,
}: {
  domain: EmailDomain;
  page: EmailDomainsPage;
  day: (at: string) => string;
  onSwitchOn: () => void;
  onOff: (kind: 'cancelled' | 'turnedOff') => void;
}) {
  const { t } = useTranslation();
  const changes = page.ownerChanges && page.plan === 'enterprise';
  const label = t('emailDomains.onlyFor', { domain: domain.domain });

  return (
    <li className="desk-row dc-only">
      <RowWords title={t('emailDomains.only')} lines={[onlyLine(t, domain, page, day)]} />
      {changes && domain.onlyOurs === 'scheduled' && (
        <button
          type="button"
          className="desk-text"
          aria-label={t('emailDomains.cancelOnlyFor', { domain: domain.domain })}
          onClick={() => onOff('cancelled')}
        >
          {t('emailDomains.cancel')}
        </button>
      )}
      {changes && domain.onlyOurs !== 'scheduled' && (
        <button
          type="button"
          role="switch"
          className="dc-switch"
          aria-checked={domain.onlyOurs === 'on'}
          aria-label={label}
          onClick={() => (domain.onlyOurs === 'on' ? onOff('turnedOff') : onSwitchOn())}
        >
          <span className="dc-switch-track" aria-hidden="true">
            <span className="dc-switch-knob" />
          </span>
        </button>
      )}
    </li>
  );
}

/** Switching it on asks once, with the instant it starts; Cancel and switching off ask nothing, as neither takes anything away. */
function ConfirmAsk({
  organisationId,
  organisation,
  domain,
  onKeep,
  onScheduled,
}: {
  organisationId: string;
  organisation: string;
  domain: EmailDomain | null;
  onKeep: () => void;
  onScheduled: (page: EmailDomainsPage) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (domain == null) return null;
  const name = domain.domain;

  async function schedule(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(false);

    try {
      onScheduled(await api.switchOnlyOursOn(organisationId, name));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Ask
      title={t('emailDomains.confirmTitle', { domain: name, organisation })}
      line={t('emailDomains.confirmLine', {
        when: domain.onlyOursIfNow,
        domain: name,
        organisation,
      })}
      keep={t('emailDomains.cancel')}
      go={t('emailDomains.schedule')}
      red={false}
      busy={busy ? t('emailDomains.schedule') : undefined}
      failed={failed ? t('dataControl.failedLine') : undefined}
      onKeep={onKeep}
      onGo={() => void schedule()}
    >
      <p>{t('emailDomains.confirmMore', { domain: name })}</p>
    </Ask>
  );
}

type Check = 'idle' | 'checking' | 'notFound' | { refused: string };

/** The record to add, each part with Copy; Verify looks for it now and proves the domain once it is found. */
function RecordDialog({
  organisationId,
  domain,
  onClose,
  onPage,
  onFound,
}: {
  organisationId: string;
  domain: EmailDomain;
  onClose: () => void;
  onPage: (page: EmailDomainsPage) => void;
  onFound: () => void;
}) {
  const { t } = useTranslation();
  const [check, setCheck] = useState<Check>('idle');
  const checking = check === 'checking';

  async function verify(): Promise<void> {
    if (checking) return;
    setCheck('checking');

    try {
      const answer = await api.verifyEmailDomain(organisationId, domain.domain);
      onPage(answer.page);
      if (answer.found) onFound();
      else setCheck('notFound');
    } catch (error) {
      setCheck({
        refused:
          error instanceof ApiError && error.is('email_domain_taken')
            ? error.problem.title
            : t('dataControl.failedLine'),
      });
    }
  }

  return (
    <Dialog
      title={t('emailDomains.recordTitle', { domain: domain.domain })}
      dismiss={t('emailDomains.close')}
      verb={checking ? t('emailDomains.verifying') : t('emailDomains.verify')}
      on={!checking}
      onDismiss={onClose}
      onConfirm={() => void verify()}
    >
      <Note strong>{t('emailDomains.recordHowTo', { domain: domain.domain })}</Note>
      <RecordRows record={domain.record} />
      {check === 'notFound' && <StatusLine kind="waiting">{t('emailDomains.notFound')}</StatusLine>}
      {typeof check === 'object' && (
        <StatusLine kind="refused" alert>
          {check.refused}
        </StatusLine>
      )}
      <Note>{recordFoot(t, domain)}</Note>
    </Dialog>
  );
}

/** Checks before sending, beside the field with the focus on it; the server's refusals land in the same place. */
function ProveDialog({
  organisationId,
  example,
  onClose,
  onAdded,
}: {
  organisationId: string;
  example: string;
  onClose: () => void;
  onAdded: (page: EmailDomainsPage, domain: string) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(): Promise<void> {
    if (busy) return;
    const problem = companyDomainProblem(typed);

    if (problem != null) {
      setError(t(problem === 'blank' ? 'emailDomains.blank' : 'emailDomains.shape', { example }));
      input.current?.focus();
      return;
    }

    const domain = normaliseDomain(typed);
    setBusy(true);

    try {
      onAdded(await api.addEmailDomain(organisationId, domain), domain);
    } catch (refusal) {
      const violation =
        refusal instanceof ApiError && refusal.is('validation_failed')
          ? refusal.problem.violations?.find((one) => one.propertyPath === 'domain')
          : undefined;
      setError(violation?.message ?? t('dataControl.failedLine'));
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <Dialog
      title={t('emailDomains.prove')}
      verb={t('emailDomains.add')}
      on={!busy}
      first={input}
      onDismiss={onClose}
      onConfirm={() => void add()}
    >
      <Field
        label={t('emailDomains.field')}
        value={typed}
        onChange={(value) => {
          setTyped(value);
          setError(null);
        }}
        inputRef={input}
        help={t('emailDomains.help', { example })}
        autoComplete="off"
        error={error}
      />
    </Dialog>
  );
}

function RemoveAsk({
  organisationId,
  domain,
  onKeep,
  onRemoved,
}: {
  organisationId: string;
  domain: string;
  onKeep: () => void;
  onRemoved: (page: EmailDomainsPage) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setFailed(false);

    try {
      onRemoved(await api.removeEmailDomain(organisationId, domain));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Ask
      title={t('emailDomains.removeTitle', { domain })}
      line={t('emailDomains.removeLine')}
      keep={t('emailDomains.keep')}
      go={t('emailDomains.remove')}
      busy={busy ? t('emailDomains.remove') : undefined}
      failed={failed ? t('dataControl.failedLine') : undefined}
      onKeep={onKeep}
      onGo={() => void remove()}
    />
  );
}
