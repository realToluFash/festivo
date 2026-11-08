import { formattingLocale, normaliseDomain } from '@soirely/domain';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import {
  Ask,
  Card,
  CardStep,
  Dialog,
  Field,
  Head,
  Note,
  OnCard,
  RowWords,
  Says,
  Tag,
  type Tell,
  TextAction,
} from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { SHARED_WORDS as S } from './dataControl.ts';
import { NoTag, PageFailed, PageLoading, StatusLine, SubPage } from './DataControlParts.tsx';
import { useLoad } from './useDataControl.ts';
import {
  type CardStep as Step,
  DOMAIN_WORDS as W,
  type Domain,
  type DomainsView,
  type Plan,
  RECORD,
  added,
  confirmWords,
  domainFault,
  domainLine,
  domainRefusal,
  domainsCard,
  domainsStart,
  isProved,
  onlyLine,
  onlyOff,
  recordFoot,
  removeWords,
  removed,
  scheduled,
  verified,
} from './emailDomains.ts';
import { type Viewer, copyText } from './settings.ts';

const CHECK_MS = 1200;

/** Data and control › Email domains (sc-560, sc-563): prove a domain, then keep its accounts to Ire Events. */
export function EmailDomains({
  viewer,
  state,
  tell,
}: {
  viewer: Viewer;
  state: string;
  tell: Tell;
}) {
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [start] = useState(() => domainsStart(state));
  const [load, retry] = useLoad(start.load);
  const [view, setView] = useState<DomainsView>(start.view);
  const [record, setRecord] = useState(start.record);
  const [firstCheck, setFirstCheck] = useState(start.check);
  const [adding, setAdding] = useState(start.adding);
  const [removing, setRemoving] = useState(start.removing);
  const [confirming, setConfirming] = useState(start.confirming);
  const said = useRef<HTMLDivElement>(null);
  const toSaid = () => focusWhenFree(() => said.current);

  if (load !== 'loaded')
    return (
      <SubPage page="emailDomains" title={W.title} viewer={viewer} tell={tell}>
        {load === 'failed' ? (
          <PageFailed words={W.failedLoad} onRetry={retry} />
        ) : (
          <PageLoading words={W.loading} />
        )}
      </SubPage>
    );

  const card = domainsCard(view, viewer, locale);
  const enterprise = view.plan === 'enterprise';
  const stepWords = (step: Step) =>
    step.does === 'contact'
      ? S.contact
      : step.does === 'prove'
        ? W.prove
        : step.does === 'record'
          ? W.seeRecord
          : W.keepAccounts;
  const onStep = (step: Step) => {
    if (step.does === 'contact') tell(S.contactTold);
    else if (step.does === 'prove') setAdding({ typed: '', pressed: false });
    else if (step.does === 'record') setRecord(step.domain);
    else setConfirming(step.domain);
  };
  const recordOf = view.domains.find((one) => one.name === record) ?? null;

  return (
    <SubPage page="emailDomains" title={W.title} viewer={viewer} tell={tell}>
      <Card>
        <div ref={said} className="desk-said-lines" tabIndex={-1} aria-live="polite">
          <Says>{card.says}</Says>
          <OnCard>{card.line}</OnCard>
        </div>
        {card.step != null && (
          <CardStep label={stepWords(card.step)} onClick={() => card.step && onStep(card.step)} />
        )}
      </Card>
      {view.plan !== 'free' && (
        <section className="desk-block">
          <Head title={W.block}>
            {enterprise && viewer.manages && (
              <TextAction
                label={W.prove}
                before="plus"
                onClick={() => setAdding({ typed: '', pressed: false })}
              />
            )}
          </Head>
          {view.domains.length === 0 ? (
            <p className="desk-line dc-none">{W.none}</p>
          ) : (
            <ul className="desk-rows dc-led">
              {view.domains.flatMap((domain) => [
                <DomainRow
                  key={domain.name}
                  domain={domain}
                  plan={view.plan}
                  locale={locale}
                  onRecord={() => setRecord(domain.name)}
                  onRemove={() => {
                    if (isProved(domain)) setRemoving(domain.name);
                    else {
                      setView((now) => removed(now, domain.name, false));
                      tell(W.removed(domain.name));
                    }
                  }}
                />,
                ...(isProved(domain)
                  ? [
                      <OnlyRow
                        key={`${domain.name}:only`}
                        domain={domain}
                        plan={view.plan}
                        viewer={viewer}
                        locale={locale}
                        onSwitchOn={() => setConfirming(domain.name)}
                        onOff={(kind) => {
                          setView((now) => onlyOff(now, domain.name, kind));
                          toSaid();
                        }}
                      />,
                    ]
                  : []),
              ])}
            </ul>
          )}
          <p className="desk-foot">{W.foot}</p>
        </section>
      )}
      {recordOf != null && (
        <RecordDialog
          domain={recordOf}
          check={firstCheck}
          locale={locale}
          tell={tell}
          onClose={() => {
            setRecord(null);
            setFirstCheck('idle');
          }}
          onFound={() => {
            setView((now) => verified(now, recordOf.name));
            setRecord(null);
            setFirstCheck('idle');
            toSaid();
          }}
        />
      )}
      {adding != null && (
        <ProveDialog
          start={adding}
          listed={view.domains}
          onClose={() => setAdding(null)}
          onAdded={(typed) => {
            setView((now) => added(now, typed));
            setAdding(null);
            setRecord(normaliseDomain(typed));
          }}
        />
      )}
      {removing != null && (
        <Ask
          {...removeWords(removing)}
          keep={W.keep}
          go={W.remove}
          onKeep={() => setRemoving(null)}
          onGo={() => {
            setView((now) => removed(now, removing, true));
            setRemoving(null);
            toSaid();
          }}
        />
      )}
      {confirming != null && (
        <ConfirmAsk
          domain={confirming}
          locale={locale}
          onKeep={() => setConfirming(null)}
          onGo={() => {
            setView((now) => scheduled(now, confirming));
            setConfirming(null);
            toSaid();
          }}
        />
      )}
    </SubPage>
  );
}

function DomainRow({
  domain,
  plan,
  locale,
  onRecord,
  onRemove,
}: {
  domain: Domain;
  plan: Plan;
  locale: string;
  onRecord: () => void;
  onRemove: () => void;
}) {
  const kept = plan === 'left';
  const tag = kept ? (
    <Tag kind="paused" word={W.kept} />
  ) : domain.status === 'proved' ? (
    <Tag kind="yes" word={W.proved} />
  ) : domain.status === 'failed' ? (
    <NoTag word={W.failed} />
  ) : (
    <Tag kind="waiting" word={domain.status === 'missing' ? W.missing : W.waiting} />
  );

  return (
    <li className="desk-row dc-domain">
      <span className="dc-lead" aria-hidden="true">
        <Glyph name="globe" size={22} />
      </span>
      <RowWords title={domain.name} tag={tag} lines={[domainLine(domain, locale)]} />
      {!kept && (
        <span className="dc-actions">
          {domain.status !== 'proved' && (
            <button
              type="button"
              className="desk-text"
              aria-label={`${W.seeRecord} for ${domain.name}`}
              onClick={onRecord}
            >
              {W.seeRecord}
            </button>
          )}
          <button
            type="button"
            className="desk-text is-red"
            aria-label={`${W.remove} ${domain.name}`}
            onClick={onRemove}
          >
            {isProved(domain) ? W.removeAsk : W.remove}
          </button>
        </span>
      )}
    </li>
  );
}

/** Under a proved domain: the owner's switch, or Cancel while it is scheduled; anybody else reads it. */
function OnlyRow({
  domain,
  plan,
  viewer,
  locale,
  onSwitchOn,
  onOff,
}: {
  domain: Domain;
  plan: Plan;
  viewer: Viewer;
  locale: string;
  onSwitchOn: () => void;
  onOff: (kind: 'cancelled' | 'turnedOff') => void;
}) {
  const changes = viewer.owns && plan === 'enterprise';
  const label = `${W.only} for ${domain.name}`;

  return (
    <li className="desk-row dc-only">
      <RowWords title={W.only} lines={[onlyLine(domain, viewer, plan, locale)]} />
      {changes && domain.only === 'scheduled' && (
        <button
          type="button"
          className="desk-text"
          aria-label={`${W.cancel} ${label}`}
          onClick={() => onOff('cancelled')}
        >
          {W.cancel}
        </button>
      )}
      {changes && domain.only !== 'scheduled' && (
        <button
          type="button"
          role="switch"
          className="dc-switch"
          aria-checked={domain.only === 'on'}
          aria-label={label}
          onClick={() => (domain.only === 'on' ? onOff('turnedOff') : onSwitchOn())}
        >
          <span className="dc-switch-track" aria-hidden="true">
            <span className="dc-switch-knob" />
          </span>
        </button>
      )}
    </li>
  );
}

function ConfirmAsk({
  domain,
  locale,
  onKeep,
  onGo,
}: {
  domain: string;
  locale: string;
  onKeep: () => void;
  onGo: () => void;
}) {
  const words = confirmWords(domain, locale);

  return (
    <Ask
      title={words.title}
      line={words.lines[0] ?? ''}
      keep={W.cancel}
      go={W.schedule}
      red={false}
      onKeep={onKeep}
      onGo={onGo}
    >
      <p>{words.lines[1]}</p>
    </Ask>
  );
}

/** The record to add, each part with Copy; Verify looks for it and proves the domain once it is found. */
function RecordDialog({
  domain,
  check: startCheck,
  locale,
  tell,
  onClose,
  onFound,
}: {
  domain: Domain;
  check: 'idle' | 'checking' | 'notFound';
  locale: string;
  tell: Tell;
  onClose: () => void;
  onFound: () => void;
}) {
  const [check, setCheck] = useState(startCheck);
  const found = useRef(onFound);
  const parts = [
    { label: W.type, value: RECORD.type },
    { label: W.name, value: RECORD.name(domain.name) },
    { label: W.value, value: RECORD.value },
  ];

  useEffect(() => {
    found.current = onFound;
  });

  useEffect(() => {
    if (check !== 'checking') return;
    const timer = setTimeout(() => found.current(), CHECK_MS);

    return () => clearTimeout(timer);
  }, [check]);

  return (
    <Dialog
      title={`Prove ${domain.name}`}
      dismiss={W.close}
      verb={check === 'checking' ? W.verifying : W.verify}
      on={check !== 'checking'}
      onDismiss={onClose}
      onConfirm={() => {
        if (check !== 'checking') setCheck('checking');
      }}
    >
      <Note
        strong
      >{`Add this record where ${domain.name}’s DNS is managed, then press Verify.`}</Note>
      <ul className="desk-rows">
        {parts.map((part) => (
          <li key={part.label} className="desk-row">
            <RowWords title={<span className="dc-code">{part.value}</span>} lines={[part.label]} />
            <button
              type="button"
              className="desk-text"
              aria-label={`${W.copy} ${part.label}`}
              onClick={() =>
                void copyText(part.value).then(
                  () => tell(W.copied),
                  () => undefined,
                )
              }
            >
              <Glyph name="copy" size={17} weight={2.3} />
              {W.copy}
            </button>
          </li>
        ))}
      </ul>
      {check === 'notFound' && <StatusLine kind="waiting">{W.notFound}</StatusLine>}
      <Note>{recordFoot(domain, locale)}</Note>
    </Dialog>
  );
}

/** Checks before sending, beside the field with the focus on it; the server's refusals land in the same place. */
function ProveDialog({
  start,
  listed,
  onClose,
  onAdded,
}: {
  start: { typed: string; pressed: boolean };
  listed: readonly Domain[];
  onClose: () => void;
  onAdded: (typed: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(start.typed);
  const [pressed, setPressed] = useState(start.pressed);
  const [refused, setRefused] = useState(() =>
    start.pressed && domainFault(start.typed) == null ? domainRefusal(start.typed, listed) : null,
  );
  const fault = domainFault(typed);

  return (
    <Dialog
      title={W.prove}
      verb={W.add}
      first={input}
      onDismiss={onClose}
      onConfirm={() => {
        setPressed(true);
        const refusal = fault == null ? domainRefusal(typed, listed) : null;
        setRefused(refusal);
        if (fault == null && refusal == null) onAdded(typed);
        else input.current?.focus();
      }}
    >
      <Field
        label={W.field}
        value={typed}
        onChange={(value) => {
          setTyped(value);
          setRefused(null);
        }}
        inputRef={input}
        help={W.help}
        autoComplete="off"
        error={pressed ? (fault ?? refused) : null}
      />
    </Dialog>
  );
}
