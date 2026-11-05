import { formattingLocale, normaliseDomain } from '@soirely/domain';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  CANDIDATES,
  type CardWords,
  type Domain,
  DETAILS_WORDS as W,
  DOMAIN_WORDS as D,
  DOMAINS_MOST,
  type GeneralStart,
  HOLDS,
  LINK_WORDS as L,
  LOADING,
  LOADING_MS,
  OWNERSHIP_WORDS as O,
  type OwnershipStep,
  type Picked,
  RETRY_MS,
  SAMPLE_DETAILS,
  SEND_MS,
  TRY_AGAIN,
  YOUR_DOMAIN,
  cardWords,
  changesThings,
  choiceName,
  domainLine,
  domainsFoot,
  generalStart,
  ownershipSteps,
  requestLink,
} from './general.ts';
import { AddDomainDialog, DeleteDialog, DetailsDialog, TransferDialog } from './GeneralDialogs.tsx';
import { Glyph } from './Glyph.tsx';
import { heldStepPath } from './security.ts';
import type { Viewer } from './settings.ts';
import {
  Ask,
  Card,
  CardStep,
  Head,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
  TitleRow,
} from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';
import { useLater } from './useLater.ts';
import './general.css';

const DETAIL_ROWS: readonly Picked[] = ['countryCode', 'currency', 'timezone', 'locale'];

/** General at a desk in B · Summary first (Web-General-*.dc.html): the app's Organisation, in Owner, Admin and Member. */
export function General({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const navigate = useNavigate();
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [start] = useState(() => generalStart(state, viewer));
  const [details, setDetails] = useState(SAMPLE_DETAILS);
  const [said, setSaid] = useState(start.said);
  const [role, setRole] = useState(start.role);
  const [editing, setEditing] = useState(start.dialog === 'details');
  const [visit, setVisit] = useState(0);
  const changes = changesThings(role, start.hold);
  const words = cardWords(details, said, role, start.hold);

  return (
    <div className="desk-page">
      <div className="desk-column">
        <TitleRow title="General" tell={tell} />
        <OrganisationCard
          words={words}
          onStep={() => {
            if (start.hold != null) {
              void navigate(heldStepPath(HOLDS[start.hold].step, viewer));
              return;
            }
            if (!changes) return;
            setVisit((count) => count + 1);
            setEditing(true);
          }}
        />
        <section className="desk-block">
          <Head title={W.details} />
          <ul className="desk-rows">
            {DETAIL_ROWS.map((field) => (
              <li key={field} className="desk-row is-plain">
                <RowWords title={choiceName(field, details[field])} lines={[W[field]]} />
              </li>
            ))}
          </ul>
          <p className="desk-foot">{W.defaultsNote}</p>
        </section>
        {changes && <Domains start={start} tell={tell} />}
        {changes && <RequestLink start={start} tell={tell} />}
        <Ownership
          start={start}
          role={role}
          locale={locale}
          onTransferred={(to) => {
            setRole('Admin');
            setSaid({ kind: 'transferred', to });
          }}
        />
        {editing && changes && (
          <DetailsDialog
            saved={details}
            opening={visit === 0 ? start : null}
            onClose={() => setEditing(false)}
            onSaved={(next, saidWords) => {
              setEditing(false);
              setDetails(next);
              setSaid({ kind: 'saved', words: saidWords });
            }}
          />
        )}
      </div>
    </div>
  );
}

/** The organisation's tile, name and contact, or what was just done in their place; the lock line when the viewer only reads. */
function OrganisationCard({ words, onStep }: { words: CardWords; onStep: () => void }) {
  return (
    <Card size="person">
      <div aria-live="polite">
        {words.said ? (
          <>
            <Says>{words.says}</Says>
            <OnCard>{words.line}</OnCard>
          </>
        ) : (
          <div className="desk-who">
            <span className="desk-disc general-tile" aria-hidden="true">
              IE
            </span>
            <div className="desk-who-words">
              <p className="desk-name">{words.says}</p>
              <OnCard>{words.line}</OnCard>
            </div>
          </div>
        )}
      </div>
      {words.lock != null && (
        <div className="general-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          <OnCard>{words.lock}</OnCard>
        </div>
      )}
      {words.step != null && <CardStep label={words.step} onClick={onStep} />}
    </Card>
  );
}

function Domains({ start, tell }: { start: GeneralStart; tell: Tell }) {
  const [loading, setLoading] = useState(start.domainsLoading);
  const [domains, setDomains] = useState<Domain[]>(start.domains);
  const [added, setAdded] = useState<string | null>(null);
  const [adding, setAdding] = useState(start.dialog === 'addDomain');
  const [removing, setRemoving] = useState<string | null>(
    start.ask === 'removeDomain' ? YOUR_DOMAIN : null,
  );
  const full = domains.length >= DOMAINS_MOST;

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), LOADING_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <section className="desk-block">
      <Head title={D.title}>
        {!loading && !full && <TextAction label={D.add} onClick={() => setAdding(true)} />}
      </Head>
      {loading ? (
        <Bones count={3} />
      ) : domains.length === 0 ? (
        <div className="desk-empty">
          <p className="desk-empty-title">{D.off}</p>
          <p className="desk-line">{D.offUntil}</p>
        </div>
      ) : (
        <ul className="desk-rows general-domains">
          {domains.map((domain) => (
            <li key={domain.name} className="desk-row">
              <span className="general-globe" aria-hidden="true">
                <Glyph name="globe" size={22} />
              </span>
              <RowWords
                title={domain.name}
                tag={domain.stopped && <Tag kind="waiting" word={D.stopped} />}
                lines={[domainLine(domain, added)]}
              />
              <button
                type="button"
                className="desk-text is-red"
                aria-label={D.removeLabel(domain.name)}
                onClick={() => setRemoving(domain.name)}
              >
                {D.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="desk-foot">{domainsFoot(domains.length)}</p>
      {adding && (
        <AddDomainDialog
          listed={domains}
          onClose={() => setAdding(false)}
          onAdded={(typed) => {
            const domain = normaliseDomain(typed);
            setAdding(false);
            setDomains((listed) => [...listed, { name: domain, stopped: false }]);
            setAdded(domain);
          }}
        />
      )}
      {removing != null && (
        <Ask
          title={D.removeTitle(removing)}
          line={D.removeBody(removing)}
          keep={D.keep}
          go={D.confirmRemove}
          onKeep={() => setRemoving(null)}
          onGo={() => {
            setDomains((listed) => listed.filter((other) => other.name !== removing));
            if (added === removing) setAdded(null);
            setRemoving(null);
            tell(D.removed(removing));
          }}
        />
      )}
    </section>
  );
}

function Bones({ count }: { count: number }) {
  return (
    <div className="desk-loading" role="status" aria-label={LOADING}>
      <span className="desk-unseen">{LOADING}</span>
      <ul className="desk-rows general-domains" aria-hidden="true">
        {Array.from({ length: count }, (_, bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk general-globe-bone" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar + 1}`} />
              <span className={`desk-sunk is-line b${bar + 1}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequestLink({ start, tell }: { start: GeneralStart; tell: Tell }) {
  const later = useLater();
  const [status, setStatus] = useState<'loaded' | 'loading' | 'failed'>(
    start.link === 'failed' ? 'failed' : 'loaded',
  );
  const [on, setOn] = useState(start.link !== 'turnedOff');
  const [made, setMade] = useState(0);
  const [replaced, setReplaced] = useState(false);
  const [replacing, setReplacing] = useState(start.ask === 'replaceLink');
  const [busy, setBusy] = useState(false);
  const link = requestLink(made);

  function turn(next: boolean): void {
    setBusy(true);
    later(SEND_MS, () => {
      setBusy(false);
      setOn(next);
      setReplaced(false);
      if (!next) return;
      setMade((count) => count + 1);
      tell(L.on);
    });
  }

  if (status !== 'loaded')
    return (
      <section className="desk-block">
        <Head title={L.title} />
        {status === 'loading' ? (
          <Bones count={1} />
        ) : (
          <div className="desk-failed" role="alert">
            <p className="desk-empty-title">{L.unreadable}</p>
            <TextAction
              label={TRY_AGAIN}
              onClick={() => {
                setStatus('loading');
                later(RETRY_MS, () => setStatus('loaded'));
              }}
            />
          </div>
        )}
      </section>
    );

  return (
    <section className="desk-block">
      <Head title={L.title} />
      <ul className="desk-rows">
        <li className="desk-row">
          <RowWords
            title={L.linkLabel}
            lines={[on ? <span className="general-link">{link}</span> : L.off]}
          />
          <Switch on={on} label={L.title} busy={busy} onChange={turn} />
        </li>
      </ul>
      {on && (
        <div className="desk-red">
          <div className="general-pair">
            <TextAction
              label={L.copy}
              before="copy"
              onClick={() =>
                void Promise.resolve(navigator.clipboard?.writeText(link)).then(
                  () => tell(L.copied),
                  () => {},
                )
              }
            />
            <TextAction label={L.replace} red onClick={() => setReplacing(true)} />
          </div>
          <p className="desk-note" role="status">
            {replaced ? L.replaced : L.replaceBody}
          </p>
        </div>
      )}
      <p className="desk-foot">{`${L.lead} ${L.help}`}</p>
      {replacing && (
        <Ask
          title={L.replaceTitle}
          line={L.replaceBody}
          keep={L.keep}
          go={L.replaceConfirm}
          onKeep={() => setReplacing(false)}
          onGo={() => {
            setReplacing(false);
            setMade((count) => count + 1);
            setReplaced(true);
          }}
        />
      )}
    </section>
  );
}

/** B's switch with its On or Off word beside it, so the state is never colour alone. */
function Switch({
  on,
  label,
  busy,
  onChange,
}: {
  on: boolean;
  label: string;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="general-switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={busy}
      onClick={() => {
        if (!busy) onChange(!on);
      }}
    >
      <span className="general-track" aria-hidden="true">
        <span className="general-knob" />
      </span>
      <span className="general-word" aria-hidden="true">
        {on ? 'On' : 'Off'}
      </span>
    </button>
  );
}

const STEPS: Record<OwnershipStep, { label: string; note: string; red: boolean }> = {
  transfer: { label: O.transfer, note: O.transferNote, red: false },
  leave: { label: O.leaveOpener, note: O.leaveNote, red: true },
  delete: { label: O.deleteOpener, note: O.deleteNote, red: true },
};

function Ownership({
  start,
  role,
  locale,
  onTransferred,
}: {
  start: GeneralStart;
  role: GeneralStart['role'];
  locale: string;
  onTransferred: (name: string) => void;
}) {
  const navigate = useNavigate();
  const later = useLater();
  const [dialog, setDialog] = useState<'transfer' | 'delete' | null>(
    start.dialog === 'transfer' || start.dialog === 'delete' ? start.dialog : null,
  );
  const [visit, setVisit] = useState(0);
  const [ask, setAsk] = useState<'leave' | 'onlyOwner' | null>(
    start.ask === 'leave' || start.ask === 'onlyOwner' ? start.ask : null,
  );
  const toToday = () => later(SEND_MS, () => void navigate('/demo/today'));

  function open(step: OwnershipStep): void {
    if (step === 'leave') {
      setAsk(role === 'Owner' ? 'onlyOwner' : 'leave');
      return;
    }
    setVisit((count) => count + 1);
    setDialog(step);
  }

  return (
    <section className="desk-block">
      <Head title={O.title} />
      <ul className="general-steps">
        {ownershipSteps(role).map((step) => (
          <li key={step} className="desk-red">
            <TextAction
              label={STEPS[step].label}
              red={STEPS[step].red}
              onClick={() => open(step)}
            />
            <p className="desk-note">{STEPS[step].note}</p>
          </li>
        ))}
      </ul>
      {ask === 'onlyOwner' && (
        <Ask
          title={O.onlyOwnerTitle}
          line={O.onlyOwnerBody}
          keep={O.stay}
          go={O.transfer}
          red={false}
          onKeep={() => setAsk(null)}
          onGo={() => {
            setAsk(null);
            open('transfer');
          }}
        />
      )}
      {ask === 'leave' && (
        <Ask
          title={O.leaveTitle}
          line={O.leaveBody}
          keep={O.stay}
          go={O.leave}
          onKeep={() => setAsk(null)}
          onGo={() => {
            setAsk(null);
            toToday();
          }}
        />
      )}
      {dialog === 'transfer' && (
        <TransferDialog
          picked={visit === 0 && start.transferPicked}
          candidates={CANDIDATES}
          onClose={() => setDialog(null)}
          onDone={(name) => {
            setDialog(null);
            onTransferred(name);
          }}
        />
      )}
      {dialog === 'delete' && (
        <DeleteDialog
          locale={locale}
          mistyped={visit === 0 && start.deleteMistyped}
          counted={visit > 0 || start.counted}
          onClose={() => setDialog(null)}
          onDeleted={toToday}
        />
      )}
    </section>
  );
}
