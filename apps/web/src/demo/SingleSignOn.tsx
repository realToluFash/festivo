import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Ask,
  BackRow,
  Card,
  Head,
  Note,
  OnCard,
  RowWords,
  Says,
  type Tell,
  TextAction,
  TitleRow,
} from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import { dataControlPath } from './dataControl.ts';
import type { Viewer } from './settings.ts';
import { SsoForm } from './SingleSignOnForm.tsx';
import { RecordRows } from './RecordRows.tsx';
import { DemoOnly, Refused, SsoMark, Switch } from './SingleSignOnParts.tsx';
import {
  type Ask as AskKind,
  type Form,
  type Plan,
  type Refusal,
  type Sso,
  type Status,
  SSO_WORDS as W,
  askWords,
  clockOf,
  emptyDraft,
  liveOf,
  ourValues,
  providerLine,
  providerTitle,
  refusalWords,
  removeLabel,
  removed,
  removedWords,
  requiredLine,
  rulesFor,
  saved,
  ssoStart,
  ssoStatus,
  standingOf,
  stayingNote,
  switched,
} from './singleSignOn.ts';

/** Sign-in rules › Single sign-on (sc-610): an owner connects the identity provider, tests it, then switches it on. */
export function SingleSignOn({
  viewer,
  state,
  plan,
  tell,
}: {
  viewer: Viewer;
  state: string;
  plan: Plan;
  tell: Tell;
}) {
  const navigate = useNavigate();
  const [start] = useState(() => ssoStart(state, plan, clockOf(new Date())));
  const [sso, setSso] = useState<Sso>(start.sso);
  const [form, setForm] = useState<Form | null>(start.form);
  const [opened, setOpened] = useState(0);
  const [ask, setAsk] = useState<AskKind | null>(start.ask);
  const [refusal, setRefusal] = useState<Refusal | null>(start.refusal);
  const status = ssoStatus(sso);
  const live = liveOf(sso);

  useEffect(() => {
    if (start.told != null) tell(start.told);
  }, [start.told, tell]);

  const test = () => {
    setRefusal(null);
    setSso((now) => ({ ...now, test: 'running', testedAt: null }));
  };
  const comeBack = (worked: boolean) => {
    setSso((now) =>
      worked
        ? { ...now, test: 'passed', testedAt: clockOf(new Date()) }
        : { ...now, test: 'failed' },
    );
  };
  const open = (next: Form | null) => {
    setForm(next);
    setOpened((now) => now + 1);
  };
  const header = (
    <>
      <DemoOffline />
      <BackRow
        to={W.back}
        onBack={() => void navigate(rulesFor(standingOf(sso), viewer))}
        bell={<DemoBell tell={tell} />}
      />
      <TitleRow title={W.title} underBack />
    </>
  );

  if (!viewer.owns)
    return (
      <Page>
        {header}
        {status != null && <StatusCard status={status} />}
        {sso.provider != null && (
          <ul className="desk-rows">
            <li className="desk-row">
              <RowWords title={providerTitle(sso.provider)} lines={[providerLine(sso.provider)]} />
            </li>
          </ul>
        )}
        <Note>{W.ownerOnly}</Note>
      </Page>
    );

  if (sso.plan === 'free' || sso.domain == null)
    return (
      <Page>
        {header}
        {status != null && (
          <StatusCard status={status}>
            {status.step === 'plans' ? (
              <button type="button" className="button" onClick={() => tell(W.plansTold)}>
                {W.seePlans}
              </button>
            ) : (
              <button
                type="button"
                className="button"
                onClick={() => void navigate(dataControlPath('emailDomains', viewer, 'ed_empty'))}
              >
                {W.proveDomain}
              </button>
            )}
          </StatusCard>
        )}
      </Page>
    );

  const shownForm =
    form ??
    (sso.provider == null
      ? { draft: emptyDraft(), pressed: false, refused: null, changing: false }
      : null);

  if (shownForm != null)
    return (
      <Page>
        {header}
        <SsoForm
          key={opened}
          start={shownForm}
          note={shownForm.changing && live != null ? stayingNote(live) : null}
          tell={tell}
          onCancel={() => open(null)}
          onSaved={(provider) => {
            setSso((now) => saved(now, provider, shownForm.changing));
            setRefusal(null);
            open(null);
          }}
        />
      </Page>
    );

  const provider = sso.provider;
  if (provider == null || status == null) return null;
  const pressSwitch = () => {
    const next = switched(sso);
    setSso(next.sso);
    setRefusal(next.refusal);
  };
  const pressRequired = () => {
    setRefusal(null);
    if (sso.required) setSso({ ...sso, required: false });
    else setAsk('required');
  };
  const startChange = () =>
    open({ draft: emptyDraft(), pressed: false, refused: null, changing: true });
  const pressChange = () => {
    setRefusal(null);
    if (live == null) startChange();
    else setAsk('change');
  };
  const pressRemove = () => {
    if (sso.required) setRefusal('removeRequired');
    else {
      setRefusal(null);
      setAsk('remove');
    }
  };
  const onRefusal = (kind: Refusal) => {
    setRefusal(null);
    if (kind === 'untested') test();
    else {
      setSso({ ...sso, required: false });
      if (kind === 'removeRequired') setAsk('remove');
    }
  };
  const asked = ask == null ? null : askWords(ask, sso);
  const switchRefusal = refusal === 'untested' || refusal === 'offRequired' ? refusal : null;

  return (
    <Page>
      {header}
      <StatusCard status={status}>
        {sso.staying != null && <OnCard>{stayingNote(sso.staying)}</OnCard>}
        {status.step === 'test' && (
          <button type="button" className="button button-primary" onClick={test}>
            {W.test}
          </button>
        )}
        {status.step === 'testAgain' && (
          <button type="button" className="button button-primary" onClick={test}>
            {W.testAgain}
          </button>
        )}
        {status.kind === 'passed' && <TextAction label={W.testAgain} onClick={test} />}
        {status.kind === 'running' && (
          <>
            <TextAction
              label={W.stopTesting}
              onClick={() => setSso({ ...sso, test: 'untested' })}
            />
            <DemoOnly>
              <p>{W.demoTab}</p>
              <div className="sso-buttons">
                <button type="button" className="button" onClick={() => comeBack(false)}>
                  {W.itFailed}
                </button>
                <button type="button" className="button" onClick={() => comeBack(true)}>
                  {W.itWorked}
                </button>
              </div>
            </DemoOnly>
          </>
        )}
      </StatusCard>
      <section className="desk-block">
        <Head title={W.provider} />
        <ul className="desk-rows">
          <li className="desk-row">
            <RowWords title={providerTitle(provider)} lines={[providerLine(provider)]} />
          </li>
          <li className="desk-row">
            <RowWords title={W.switchName} lines={sso.on ? [] : [W.switchLine]} />
            <Switch label={W.switchName} on={sso.on} onPress={pressSwitch} />
          </li>
          {switchRefusal != null && (
            <li className="sso-under">
              <Refused
                {...refusalWords(switchRefusal, sso)}
                onAction={() => onRefusal(switchRefusal)}
              />
            </li>
          )}
          {sso.on && (
            <li className="desk-row">
              <RowWords title={W.required} lines={[requiredLine(sso)]} />
              <Switch label={W.required} on={sso.required} onPress={pressRequired} />
            </li>
          )}
        </ul>
        <div className="sso-buttons is-start">
          <TextAction label={W.change} onClick={pressChange} />
          <button type="button" className="button" onClick={pressRemove}>
            {removeLabel(sso)}
          </button>
        </div>
        {refusal === 'removeRequired' && (
          <Refused {...refusalWords(refusal, sso)} onAction={() => onRefusal('removeRequired')} />
        )}
      </section>
      <section className="desk-block">
        <Head title={provider.protocol === 'saml' ? W.giveThese : W.giveThis} />
        <RecordRows parts={ourValues(provider.protocol)} tell={tell} />
      </section>
      {asked != null && ask != null && (
        <Ask
          title={asked.title}
          line={asked.lines[0]}
          keep={asked.keep}
          go={asked.go}
          red={ask === 'remove'}
          onKeep={() => setAsk(null)}
          onGo={() => {
            setAsk(null);
            if (ask === 'required') setSso({ ...sso, required: true });
            else if (ask === 'change') startChange();
            else {
              setSso(removed(sso));
              open(null);
              tell(removedWords(provider.name, sso.domain));
            }
          }}
        >
          {asked.lines.slice(1).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Ask>
      )}
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="desk-page">
      <div className="desk-column">{children}</div>
    </div>
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
      {children != null && <div className="sso-steps">{children}</div>}
    </Card>
  );
}
