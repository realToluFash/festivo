import type { Membership, SingleSignOnPage } from '@soirely/api-client';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  Ask,
  BackRow,
  Card,
  DeskPage,
  Head,
  Note,
  OnCard,
  RowWords,
  Says,
  TextAction,
  TitleRow,
} from '../../../components/SettingsParts.tsx';
import { RuleMark, RulesBones } from '../../../components/SignInRulesParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { useDeskLayers } from '../../../layers.ts';
import { can, useSession } from '../../../session.ts';
import { Forbidden } from '../Forbidden.tsx';
import { EMAIL_DOMAINS } from './EmailDomains.tsx';
import {
  type Status,
  liveOf,
  ourValues,
  providerLine,
  providerTitle,
  ssoStatus,
} from './singleSignOn.ts';
import { SingleSignOnForm } from './SingleSignOnForm.tsx';
import { ValueRows } from './SingleSignOnValues.tsx';
import '../../../components/SettingsParts.css';
import './singleSignOn.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; page: SingleSignOnPage };
type Asked = 'required' | 'change' | 'remove';
type Refusal = 'untested' | 'removeRequired' | 'offRequired';

/** Sign-in rules › Single sign-on (sc-610): an owner connects the identity provider, tests it, then switches it on. */
export function SingleSignOn() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;
  if (!can(session, 'organisation.manage')) return <Forbidden />;

  return <SsoDesk key={organisation.id} organisation={organisation} />;
}

function SsoDesk({ organisation }: { organisation: Membership }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { layers, covered, setHost } = useDeskLayers();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<'closed' | 'changing'>('closed');
  const [ask, setAsk] = useState<Asked | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [failed, setFailed] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  /** The last test's time when this one started, so the answer is the one that differs. */
  const [testing, setTesting] = useState<{ before: string | null } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let current = true;

    api.singleSignOn(organisation.id).then(
      (page) => {
        if (current) setLoad({ kind: 'loaded', page });
      },
      () => {
        if (current) setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' }));
      },
    );

    return () => {
      current = false;
    };
  }, [organisation.id, attempt]);

  const waiting =
    testing != null && load.kind === 'loaded' && load.page.testedAt === testing.before;

  // The provider answers in the other tab, so this one asks again while it waits.
  useEffect(() => {
    if (!waiting) return;

    const poll = window.setInterval(() => setAttempt((n) => n + 1), 3000);

    return () => window.clearInterval(poll);
  }, [waiting]);

  const shell = (children: ReactNode) => (
    <DeskPage layers={layers}>
      <div className="desk-column" inert={covered}>
        <BackRow
          to={t('signInRules.title')}
          onBack={() => void navigate('/app/settings/sign-in-rules')}
        />
        <TitleRow title={t('sso.title')} underBack />
        {children}
      </div>
      <div ref={setHost} className="desk-layers" />
      {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
    </DeskPage>
  );

  if (load.kind === 'loading') return shell(<RulesBones words={t('signInRules.loading')} />);
  if (load.kind === 'failed')
    return shell(
      <div className="desk-failed" role="alert">
        <p className="desk-line">{t('signInRules.failedLoadLine')}</p>
        <TextAction
          label={t('signInRules.retry')}
          onClick={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </div>,
    );

  const page = load.page;
  const domains = new Intl.ListFormat(currentLocale()).format(page.domains);
  const named = { organisation: organisation.name, domains };
  const status = ssoStatus(page, waiting, named, t);
  const provider = page.provider;

  async function send(change: () => Promise<SingleSignOnPage>, then?: () => void): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setRefusal(null);
    setFailed(false);

    try {
      setLoad({ kind: 'loaded', page: await change() });
      then?.();
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }

  async function test(): Promise<void> {
    setRefusal(null);
    setFailed(false);
    // Opened before the request answers, or the browser blocks it as a pop-up.
    const tab = window.open('', '_blank');

    try {
      const { authorizationUrl } = await api.testSingleSignOn(organisation.id);
      if (tab == null) window.location.assign(authorizationUrl);
      else {
        tab.opener = null;
        tab.location.href = authorizationUrl;
      }
      setTesting({ before: page.testedAt });
    } catch {
      tab?.close();
      setFailed(true);
    }
  }

  const trouble = failed && (
    <p className="desk-line" role="alert">
      {t('sso.failed')}
    </p>
  );

  if (!page.ownerChanges)
    return shell(
      <>
        {status != null && <StatusCard status={status} />}
        {provider != null && (
          <ul className="desk-rows">
            <li className="desk-row">
              <RowWords title={providerTitle(provider, t)} lines={[providerLine(provider)]} />
            </li>
          </ul>
        )}
        <Note>{t('sso.ownerOnly')}</Note>
      </>,
    );

  if (page.plan === 'free' || page.domains.length === 0)
    return shell(
      status != null && (
        <StatusCard status={status}>
          {status.step === 'prove' && (
            <button type="button" className="button" onClick={() => void navigate(EMAIL_DOMAINS)}>
              {t('sso.proveDomain')}
            </button>
          )}
        </StatusCard>
      ),
    );

  const live = liveOf(page);

  if (form === 'changing' || provider == null)
    return shell(
      <SingleSignOnForm
        ours={page.ours}
        organisation={organisation.name}
        domains={domains}
        changing={form === 'changing'}
        note={
          form === 'changing' && live != null ? t('sso.staying', { provider: live.name }) : null
        }
        onCancel={() => setForm('closed')}
        onSave={async (input) => {
          const next = await api.saveSingleSignOnProvider(organisation.id, input);
          setLoad({ kind: 'loaded', page: next });
          setTesting(null);
          setForm('closed');
        }}
      />,
    );

  if (status == null) return null;

  const words = { ...named, provider: provider.name };
  const flip = (which: 'on' | 'required', to: boolean, then?: () => void) =>
    void send(() => api.switchSingleSignOn(organisation.id, which, to), then);
  const pressSwitch = () => {
    if (page.on && page.required) setRefusal('offRequired');
    else if (!page.on && page.test !== 'passed') setRefusal('untested');
    else flip('on', !page.on);
  };
  const refused = refusal != null && (
    <Refused
      line={t(
        {
          untested: 'sso.refusedUntested',
          removeRequired: 'sso.refusedRemove',
          offRequired: 'sso.refusedOff',
        }[refusal],
        words,
      )}
      action={t(refusal === 'untested' ? 'sso.test' : 'sso.turnOffRequired')}
      onAction={() => {
        if (refusal === 'untested') void test();
        else flip('required', false, () => refusal === 'removeRequired' && setAsk('remove'));
      }}
    />
  );

  return shell(
    <>
      <StatusCard status={status}>
        {page.staying != null && (
          <OnCard>{t('sso.staying', { provider: page.staying.name })}</OnCard>
        )}
        {(status.step === 'test' || status.step === 'testAgain') && (
          <button type="button" className="button button-primary" onClick={() => void test()}>
            {t(status.step === 'test' ? 'sso.test' : 'sso.testAgain')}
          </button>
        )}
        {status.kind === 'passed' && (
          <TextAction label={t('sso.testAgain')} onClick={() => void test()} />
        )}
        {status.kind === 'running' && (
          <TextAction label={t('sso.stopTesting')} onClick={() => setTesting(null)} />
        )}
      </StatusCard>
      <section className="desk-block">
        <Head title={t('sso.provider')} />
        <ul className="desk-rows">
          <li className="desk-row">
            <RowWords title={providerTitle(provider, t)} lines={[providerLine(provider)]} />
          </li>
          <li className="desk-row">
            <RowWords title={t('sso.title')} lines={page.on ? [] : [t('sso.switchLine')]} />
            <Switch label={t('sso.title')} on={page.on} onPress={pressSwitch} />
          </li>
          {(refusal === 'untested' || refusal === 'offRequired') && (
            <li className="sso-under">{refused}</li>
          )}
          {page.on && (
            <li className="desk-row">
              <RowWords title={t('sso.requiredSwitch')} lines={[t('sso.requiredHelp', words)]} />
              <Switch
                label={t('sso.requiredSwitch')}
                on={page.required}
                onPress={() => (page.required ? flip('required', false) : setAsk('required'))}
              />
            </li>
          )}
        </ul>
        <div className="sso-buttons is-start">
          <TextAction
            label={t('sso.change')}
            onClick={() => {
              setRefusal(null);
              if (live == null) setForm('changing');
              else setAsk('change');
            }}
          />
          <button
            type="button"
            className="button"
            onClick={() => (page.required ? setRefusal('removeRequired') : setAsk('remove'))}
          >
            {t('sso.removeButton', words)}
          </button>
        </div>
        {refusal === 'removeRequired' && refused}
        {trouble}
      </section>
      <section className="desk-block">
        <Head title={t(provider.protocol === 'saml' ? 'sso.giveThese' : 'sso.giveThis')} />
        <ValueRows values={ourValues(page.ours, provider.protocol, t)} />
      </section>
      {ask === 'required' && (
        <Ask
          title={t('sso.requireTitle', words)}
          line={t('sso.requireLine', words)}
          keep={t('sso.requireKeep')}
          go={t('sso.requireGo')}
          red={false}
          onKeep={() => setAsk(null)}
          onGo={() => {
            setAsk(null);
            flip('required', true);
          }}
        >
          <p>{t('sso.requireOwners', words)}</p>
        </Ask>
      )}
      {ask === 'change' && (
        <Ask
          title={t('sso.changeTitle')}
          line={t('sso.changeLine', { provider: (live ?? provider).name })}
          keep={t('sso.keep', { provider: (live ?? provider).name })}
          go={t('sso.changeGo')}
          red={false}
          onKeep={() => setAsk(null)}
          onGo={() => {
            setAsk(null);
            setForm('changing');
          }}
        />
      )}
      {ask === 'remove' && (
        <Ask
          title={t('sso.removeTitle', words)}
          line={t('sso.removeLine', words)}
          keep={t('sso.keep', words)}
          go={t('sso.removeGo', words)}
          onKeep={() => setAsk(null)}
          onGo={() => {
            setAsk(null);
            void send(
              () => api.removeSingleSignOnProvider(organisation.id),
              () => setTold(t('sso.removed', words)),
            );
          }}
        />
      )}
    </>,
  );
}

function StatusCard({ status, children }: { status: Status; children?: ReactNode }) {
  return (
    <Card>
      <div className="sso-said" role="status">
        <Says>
          <span className="sso-status">
            <SsoMark kind={status.kind} />
            {status.word}
          </span>
        </Says>
        {status.lines.map((line) => (
          <OnCard key={line}>{line}</OnCard>
        ))}
      </div>
      {children != null && children !== false && <div className="sso-steps">{children}</div>}
    </Card>
  );
}

/** Every status a shape with its word: grey for not yet, the green tick, the alert, the lock, the spinner. */
export function SsoMark({ kind }: { kind: Status['kind'] }) {
  switch (kind) {
    case 'grey':
      return <RuleMark mark="notApplicable" />;
    case 'on':
    case 'passed':
      return <RuleMark mark="met" />;
    case 'failed':
      return (
        <span className="sso-mark is-failed" aria-hidden="true">
          <Glyph name="alert" size={18} weight={2.2} />
        </span>
      );
    case 'lock':
      return (
        <span className="sso-mark is-lock" aria-hidden="true">
          <Glyph name="lock" size={13} weight={2.4} />
        </span>
      );
    case 'running':
      return (
        <span className="sso-mark" aria-hidden="true">
          <span className="pending-spinner" />
        </span>
      );
  }
}

function Switch({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      className="dc-switch"
      aria-checked={on}
      aria-label={label}
      onClick={onPress}
    >
      <span className="dc-switch-track" aria-hidden="true">
        <span className="dc-switch-knob" />
      </span>
    </button>
  );
}

function Refused({
  line,
  action,
  onAction,
}: {
  line: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="signin-refusal sso-refused" role="alert">
      <Glyph name="alert" size={20} weight={2.2} />
      <div className="desk-after">
        <p className="desk-line is-ink">{line}</p>
        <button type="button" className="desk-text" onClick={onAction}>
          {action}
        </button>
      </div>
    </div>
  );
}
