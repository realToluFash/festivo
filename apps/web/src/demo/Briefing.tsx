import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Dialog, type Tell } from '../components/SettingsParts.tsx';
import {
  type Brief,
  type BriefingStart,
  type Check,
  type Person,
  type Side,
  BW,
  afterBriefCopy,
  afterBriefMark,
  asPerson,
  checkOf,
  countLine,
  dueAll,
  dueChanged,
  fitRules,
  noMobileFor,
  noteOf,
  onShift,
  resultLines,
  sendTo,
  tallyOf,
} from './briefing.ts';
import type { SampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import { MN } from './myNight.ts';
import { type Entry, sorted } from './roster.ts';
import { ISSUE_MS, SAMPLE_LINK, copyIssued, plainItem } from './staffLink.ts';
import { Select } from './Stations.tsx';
import './guests.css';
import './menu.css';
import './myNight.css';
import './stations.css';
import './roster.css';
import './briefing.css';

const BRIEFS: readonly Brief[] = ['read', 'sent', 'changed', 'none'];

/** The briefing's parts on the Roster (sc-3917): the card above it, the Briefing column, the held link under a row, the panel and the check. */
export interface Briefing {
  on: boolean;
  side: boolean;
  card: ReactNode;
  cell: (one: Entry) => ReactNode;
  held: (one: Entry, span: number) => ReactNode;
  panel: ReactNode;
  check: ReactNode;
  /** Closes the briefing's panel when the Roster opens one of its own. */
  dismiss: () => void;
  /** A person added or edited on the Roster, with their briefing kept. */
  adopt: (made: Entry, before: Entry | null) => Entry;
}

const OFF: Briefing = {
  on: false,
  side: false,
  card: null,
  cell: () => null,
  held: () => null,
  panel: null,
  check: null,
  dismiss: () => undefined,
  adopt: (made) => made,
};

/** The briefing's state and actions on the Roster's own rows: a briefing copy turns the Link column to Copied, and a Link-column copy leaves Briefing alone. */
export function useBriefing({
  first,
  entries,
  setEntries,
  focus,
  announce,
  credits,
  spend,
  tell,
  event,
  onSide,
}: {
  first: BriefingStart | null;
  entries: readonly Entry[];
  setEntries: Dispatch<SetStateAction<Entry[]>>;
  /** Where focus goes after the next render. */
  focus: (id: string) => void;
  announce: (text: string) => void;
  credits: number;
  spend: (credits: number) => void;
  tell: Tell;
  event: SampleEvent;
  onSide: () => void;
}): Briefing {
  const [side, setSide] = useState<Side>(first?.side ?? null);
  const [rules, setRules] = useState(first?.rules ?? '');
  const [draft, setDraft] = useState(first?.draft ?? null);
  const [cut, setCut] = useState(first?.cut ?? false);
  const [saved, setSaved] = useState(first?.saved ?? false);
  const [notSaved, setNotSaved] = useState(first?.notSaved ?? false);
  const [previewAt, setPreviewAt] = useState(first?.previewAt ?? 'shown');
  const [previewStuck, setPreviewStuck] = useState(first?.previewAt === 'loading');
  const [busy, setBusy] = useState(first?.busy ?? null);
  const [missed, setMissed] = useState(first?.missed ?? null);
  const [handHeld, setHandHeld] = useState(first?.handHeld ?? null);
  const [check, setCheck] = useState(first?.check ?? null);
  const [checkAt, setCheckAt] = useState(first?.checkAt ?? 'shown');
  const [stuck, setStuck] = useState(first?.checkAt === 'loading');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [result, setResult] = useState(first?.result ?? null);

  useEffect(() => {
    if (first?.handHeld == null) return;
    const field = document.getElementById(`bf-held-${first.handHeld.id}`);
    if (field instanceof HTMLInputElement) field.select();
  }, [first]);

  useEffect(() => {
    if (check == null || checkAt !== 'loading' || stuck) return;
    const timer = window.setTimeout(() => setCheckAt('shown'), ISSUE_MS);

    return () => window.clearTimeout(timer);
  }, [check, checkAt, stuck]);

  useEffect(() => {
    if (previewAt !== 'loading' || previewStuck) return;
    const timer = window.setTimeout(() => setPreviewAt('shown'), ISSUE_MS);

    return () => window.clearTimeout(timer);
  }, [previewAt, previewStuck]);

  if (first == null) return OFF;

  const people = entries as readonly Person[];
  const manage = first.access === 'manage';
  const acts = manage && !first.finished;
  const sends = acts && first.live;
  const rows = sorted(people) as Person[];
  const here = (id: string) => people.find((one) => one.id === id);
  const shown = (id: string) => here(id) as Person;
  const all = dueAll(people);
  const changed = dueChanged(people);
  const tally = tallyOf(people);

  function open(next: Side) {
    onSide();
    setSide(next);
    setSaved(false);
    setCut(false);
    focus('sn-panel-title');
  }

  function dismiss() {
    setSide(null);
    setDraft(null);
    setCut(false);
  }

  function close(back: string) {
    dismiss();
    focus(back);
  }

  function change(id: string, to: (one: Person) => Person) {
    setEntries((was) => was.map((one) => (one.id === id ? to(one as Person) : one)));
  }

  async function copy(id: string) {
    if (first == null || busy != null) return;
    setBusy(id);
    setMissed(null);
    if (handHeld?.id === id) setHandHeld(null);
    if (first.copy === 'slow') return;
    const fails = first.copy === 'notIssued';
    const issue = () =>
      new Promise<string>((resolve, reject) =>
        window.setTimeout(
          () => (fails ? reject(new Error('503')) : resolve(SAMPLE_LINK)),
          ISSUE_MS,
        ),
      );
    const outcome =
      first.copy === 'refused'
        ? await copyIssued(issue, null, null)
        : await copyIssued(
            issue,
            navigator.clipboard ?? null,
            typeof ClipboardItem === 'undefined' ? null : plainItem,
          );
    setBusy(null);
    if (outcome.kind === 'notIssued') {
      setMissed(id);
      announce(BW.notCopied);
      return;
    }
    change(id, afterBriefCopy);
    if (outcome.kind === 'copied') {
      announce(BW.copied);
      return;
    }
    setHandHeld({ id, url: outcome.url });
    announce(BW.refused);
    focus(`bf-held-${id}`);
  }

  function mark(id: string) {
    change(id, afterBriefMark);
    if (handHeld?.id === id) setHandHeld(null);
    announce(BW.marked(shown(id).name));
    focus(side?.kind === 'copy' || result != null ? `bf-copy-${id}` : `bf-row-copy-${id}`);
  }

  function ask(target: string) {
    setStuck(false);
    setSendFailed(false);
    setCheckAt('loading');
    setCheck(target);
  }

  const due =
    check == null
      ? []
      : check === 'all'
        ? all
        : check === 'changed'
          ? changed
          : people.filter((one) => one.id === check);
  const costs: Check | null =
    check == null ? null : checkOf(due, noMobileFor(people, check), credits);

  function closeCheck() {
    focus(
      check === 'all' ? 'bf-send' : check === 'changed' ? 'bf-changed' : `bf-again-${check ?? ''}`,
    );
    setCheck(null);
    setSendFailed(false);
  }

  function sendNow() {
    if (first == null || costs == null || sending || checkAt !== 'shown') return;
    const fails = first.sendFails;
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      if (fails) {
        setSendFailed(true);
        announce(BW.sendFailed);
        return;
      }
      const sent = sendTo(people, due, costs);
      setEntries(sent.people);
      spend(costs.credits);
      setCheck(null);
      const lines = resultLines(sent.sent, costs.noMobile, sent.held.length);
      setResult({ lines, held: sent.held });
      announce(lines.join(' '));
      focus('bf-result');
    }, ISSUE_MS);
  }

  function rulesTyped(next: string) {
    const fitted = fitRules(draft ?? '', next);
    setDraft(fitted.text);
    if (fitted.cut) {
      setCut(true);
      announce(BW.cut);
    } else if (cut) setCut(false);
  }

  function saveRules() {
    setNotSaved(false);
    setRules((draft ?? '').trim());
    setDraft(null);
    setSaved(true);
    setSide({ kind: 'rules', editing: false });
    announce(BW.saved);
    focus('sn-panel-title');
  }

  const backFrom = (now: Side) =>
    now?.kind === 'copy' ? 'bf-copy' : now?.kind === 'preview' ? 'bf-preview' : 'bf-rules';
  const heldHere = (result?.held ?? []).filter((id) => here(id) != null);
  const previewed = side?.kind === 'preview' ? here(side.id) : undefined;

  const card = (
    <section className="sn-card bf-card" aria-labelledby="bf-title">
      <div className="sn-card-top">
        <div className="sn-card-names">
          <h2 id="bf-title">{BW.card}</h2>
          <p className="mn-sub">{BW.cardSub}</p>
        </div>
      </div>
      {!manage && (
        <p className="mn-lock">
          <Glyph name="lock" size={16} weight={2.2} />
          {BW.lock}
        </p>
      )}
      <ul className="bf-tally" aria-label="Where the briefing is">
        {BRIEFS.map((brief) => (
          <li key={brief}>
            <BriefWord brief={brief} />
            <span className="bf-tally-n">{tally[brief]}</span>
          </li>
        ))}
      </ul>
      {acts && (
        <div className="bf-acts">
          {sends && all.length > 0 && (
            <button
              id="bf-send"
              type="button"
              className="gs-pill is-primary"
              aria-haspopup="dialog"
              onClick={() => ask('all')}
            >
              {BW.sendAll(all.length)}
            </button>
          )}
          {sends && changed.length > 0 && (
            <button
              id="bf-changed"
              type="button"
              className="gs-pill is-secondary"
              aria-haspopup="dialog"
              onClick={() => ask('changed')}
            >
              {BW.sendChanged(changed.length)}
            </button>
          )}
          <button
            id="bf-copy"
            type="button"
            className="gs-pill is-secondary"
            aria-expanded={side?.kind === 'copy'}
            onClick={() => open({ kind: 'copy' })}
          >
            {BW.copy}
          </button>
        </div>
      )}
      <div className="bf-more">
        <button
          id="bf-rules"
          type="button"
          className="desk-text"
          aria-expanded={side?.kind === 'rules'}
          onClick={() => open({ kind: 'rules', editing: false })}
        >
          <Glyph name="pen" size={16} weight={2.3} />
          {manage ? BW.editRules : BW.rules}
        </button>
        <button
          id="bf-preview"
          type="button"
          className="desk-text"
          aria-expanded={side?.kind === 'preview'}
          onClick={() => {
            const firstOne = rows.find((one) => one.shift != null) ?? rows[0];
            if (firstOne != null) open({ kind: 'preview', id: firstOne.id });
          }}
        >
          <Glyph name="eye" size={16} weight={2.3} />
          {BW.previewAs}
        </button>
      </div>
      {result != null && (
        <div className="bf-result" id="bf-result" tabIndex={-1}>
          <div className="bf-result-lines">
            <Glyph name="tick" size={18} weight={2.6} />
            <div>
              {result.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          {heldHere.length > 0 && (
            <ul className="bf-held-list">
              {heldHere.map((id) => (
                <CopyRow
                  key={id}
                  one={shown(id)}
                  acts={acts}
                  busy={busy === id}
                  missed={missed === id}
                  handHeld={handHeld?.id === id ? handHeld.url : null}
                  onCopy={() => void copy(id)}
                  onMark={() => mark(id)}
                  brief={false}
                />
              ))}
            </ul>
          )}
          <button type="button" className="desk-text" onClick={() => setResult(null)}>
            {BW.dismiss}
          </button>
        </div>
      )}
      {sendFailed && check == null && (
        <p className="rs-missed" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {BW.sendFailed}
        </p>
      )}
    </section>
  );

  const panel =
    side == null ? null : (
      <aside className="mn-panel bf-panel" aria-labelledby="sn-panel-title">
        <button type="button" className="desk-text bf-back" onClick={() => close(backFrom(side))}>
          <Glyph name="back" size={16} weight={2.4} />
          {BW.roster}
        </button>
        {side.kind === 'copy' && (
          <CopyPanel
            people={rows}
            loading={first.loading}
            acts={acts}
            busy={busy}
            missed={missed}
            handHeld={handHeld}
            onCopy={(id) => void copy(id)}
            onMark={mark}
            jobsAt={`/demo/events/${event.id}/staff/jobs`}
            onClose={() => close('bf-copy')}
          />
        )}
        {side.kind === 'rules' && (
          <RulesPanel
            rules={rules}
            draft={side.editing ? (draft ?? rules) : null}
            manage={acts}
            cut={cut}
            saved={saved}
            notSaved={notSaved}
            onEdit={() => {
              setDraft(rules);
              setSaved(false);
              setSide({ kind: 'rules', editing: true });
              focus('bf-rules-box');
            }}
            onType={rulesTyped}
            onSave={saveRules}
            onCancel={() => {
              setDraft(null);
              setCut(false);
              setNotSaved(false);
              setSide({ kind: 'rules', editing: false });
              focus('sn-panel-title');
            }}
            onClose={() => close('bf-rules')}
          />
        )}
        {side.kind === 'preview' && previewed != null && (
          <PreviewPanel
            people={rows}
            one={previewed as Person}
            rules={rules}
            event={event.name}
            at={previewAt}
            onPick={(id) => {
              setPreviewStuck(false);
              setPreviewAt(previewAt === 'shown' ? 'shown' : 'loading');
              setSide({ kind: 'preview', id });
            }}
            onRetry={() => {
              setPreviewStuck(false);
              setPreviewAt('loading');
            }}
            onClose={() => close('bf-preview')}
          />
        )}
      </aside>
    );

  const dialog =
    check == null || costs == null ? null : (
      <Dialog
        title={BW.checkTitle}
        verb={
          check === 'all'
            ? BW.sendAll(costs.people)
            : check === 'changed'
              ? BW.sendChanged(costs.people)
              : BW.sendAgain
        }
        dismiss={BW.cancel}
        on={checkAt === 'shown' && !sending}
        locked={sending}
        onDismiss={closeCheck}
        onConfirm={sendNow}
      >
        <CheckBody
          costs={costs}
          at={checkAt}
          billing={first.billing}
          sending={sending}
          failed={sendFailed}
          tell={tell}
          onRetry={() => setCheckAt('loading')}
          onCopy={() => {
            setCheck(null);
            open({ kind: 'copy' });
          }}
        />
      </Dialog>
    );

  return {
    on: true,
    side: side != null,
    card,
    cell: (one) => (
      <BriefCell
        one={one as Person}
        acts={acts}
        sends={sends}
        busy={busy === one.id}
        missed={missed === one.id}
        onAgain={() => ask(one.id)}
        onCopy={() => void copy(one.id)}
        onMark={() => mark(one.id)}
      />
    ),
    held: (one, span) =>
      handHeld?.id === one.id && side?.kind !== 'copy' && result == null ? (
        <tr className="rs-held-row">
          <td colSpan={span}>
            <HandHeld one={one as Person} url={handHeld.url} />
          </td>
        </tr>
      ) : null,
    panel,
    check: dialog,
    dismiss,
    adopt: asPerson,
  };
}

/** Neither staff.read nor staff.manage (403): the refusal in place of the Roster. */
export function BriefingRefused({ event }: { event: SampleEvent }) {
  return (
    <div className="desk-page ev-page gs mn sn rs bf">
      <div className="ev-wide mn-page">
        <div className="bf-refused" role="alert">
          <Glyph name="lock" size={28} weight={2} />
          <p className="rs-empty-title">{BW.refusedPage}</p>
          <Link className="gs-pill is-secondary" to={`/demo/events/${event.id}`}>
            {BW.backToEvent}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function BriefWord({ brief }: { brief: Brief }) {
  return (
    <span className="rs-link">
      <span className={`bf-mark is-${brief}`} aria-hidden="true">
        {(brief === 'read' || brief === 'sent') && <Glyph name="tick" size={10} weight={3.4} />}
      </span>
      {BW.tally[brief]}
    </span>
  );
}

function BriefCell({
  one,
  acts,
  sends,
  busy,
  missed,
  onAgain,
  onCopy,
  onMark,
}: {
  one: Person;
  acts: boolean;
  sends: boolean;
  busy: boolean;
  missed: boolean;
  onAgain: () => void;
  onCopy: () => void;
  onMark: () => void;
}) {
  const note = noteOf(one);
  const changedActs = acts && one.brief === 'changed' && one.mobile != null;

  return (
    <span className="rs-link-cell">
      <BriefWord brief={one.brief} />
      {note != null && <span className="rs-trail">{note}</span>}
      {one.briefCopy != null && one.brief === 'changed' && <CopiedLine one={one} />}
      {missed && one.brief === 'changed' && (
        <span className="rs-missed">
          <Glyph name="alert" size={15} weight={2.2} />
          {BW.notCopied}
        </span>
      )}
      {changedActs && (
        <span className="rs-link-acts">
          {sends && !one.heldText && (
            <button
              id={`bf-again-${one.id}`}
              type="button"
              className="desk-text"
              aria-label={`${BW.sendAgain}: ${one.name}`}
              aria-haspopup="dialog"
              onClick={onAgain}
            >
              {BW.sendAgain}
            </button>
          )}
          <CopyButton id={`bf-row-copy-${one.id}`} one={one} busy={busy} onCopy={onCopy} />
          {one.briefCopy != null && !one.briefCopy.marked && (
            <MarkButton one={one} onMark={onMark} />
          )}
        </span>
      )}
    </span>
  );
}

function CopiedLine({ one }: { one: Person }) {
  if (one.briefCopy == null) return null;

  return (
    <span className="rs-trail bf-copied">
      <span className={one.briefCopy.marked ? 'rs-mark' : 'rs-mark is-copied'} aria-hidden="true" />
      {one.briefCopy.marked ? BW.markedBy(one.briefCopy.trail) : BW.copiedBy(one.briefCopy.trail)}
    </span>
  );
}

function CopyButton({
  id,
  one,
  busy,
  onCopy,
}: {
  id: string;
  one: Person;
  busy: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      className={busy ? 'desk-text is-busy' : 'desk-text'}
      aria-label={BW.forBriefing(BW.copy, one.name)}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={onCopy}
    >
      {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
      {BW.copy}
    </button>
  );
}

function MarkButton({ one, onMark }: { one: Person; onMark: () => void }) {
  return (
    <button
      type="button"
      className="desk-text"
      aria-label={BW.forBriefing(BW.markSent, one.name)}
      onClick={onMark}
    >
      {BW.markSent}
    </button>
  );
}

/** A link the browser would not copy, selected in a read-only field to copy by hand; "Link" where the row cannot hold the name. */
function HandHeld({ one, url, short = false }: { one: Person; url: string; short?: boolean }) {
  const id = `bf-held-${one.id}`;

  return (
    <span className="rs-held">
      <span className="rs-held-says">
        <Glyph name="alert" size={16} weight={2.2} />
        {BW.refused}
      </span>
      <label htmlFor={id} className="rs-held-label">
        {short ? BW.link : BW.linkFor(one.name)}
      </label>
      <input
        id={id}
        aria-label={BW.linkFor(one.name)}
        className="rs-held-field"
        type="text"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
      />
    </span>
  );
}

function CopyRow({
  one,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
  brief = true,
}: {
  one: Person;
  acts: boolean;
  busy: boolean;
  missed: boolean;
  handHeld: string | null;
  onCopy: () => void;
  onMark: () => void;
  brief?: boolean;
}) {
  const note = noteOf(one);

  return (
    <li className="bf-copy-row">
      <div className="bf-copy-who">
        <p className="bf-copy-name">{one.name}</p>
        {brief && (
          <p className="bf-copy-shift">
            {[one.job, one.shift, one.station].filter(Boolean).join(' · ')}
            <span className="bf-pill">{BW.notBuilt}</span>
          </p>
        )}
        {brief && (
          <span className="bf-copy-state">
            <BriefWord brief={one.brief} />
            {note != null && <span className="rs-trail">{note}</span>}
          </span>
        )}
        <CopiedLine one={one} />
        {missed && (
          <span className="rs-missed">
            <Glyph name="alert" size={15} weight={2.2} />
            {BW.notCopied}
          </span>
        )}
        {handHeld != null && <HandHeld one={one} url={handHeld} short />}
      </div>
      {acts && one.mobile != null && (
        <span className="bf-copy-acts">
          <CopyButton id={`bf-copy-${one.id}`} one={one} busy={busy} onCopy={onCopy} />
          {one.briefCopy != null && !one.briefCopy.marked && (
            <MarkButton one={one} onMark={onMark} />
          )}
        </span>
      )}
    </li>
  );
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
        <p className="mn-eyebrow">{BW.card}</p>
        <h2 id="sn-panel-title" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <button type="button" className="ev-round mn-close" aria-label={BW.close} onClick={onClose}>
        <Glyph name="clear" size={16} weight={2.4} />
      </button>
    </div>
  );
}

function CopyPanel({
  people,
  loading,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
  jobsAt,
  onClose,
}: {
  people: readonly Person[];
  loading: boolean;
  acts: boolean;
  busy: string | null;
  missed: string | null;
  handHeld: { id: string; url: string } | null;
  onCopy: (id: string) => void;
  onMark: (id: string) => void;
  jobsAt: string;
  onClose: () => void;
}) {
  const listed = onShift(people);

  return (
    <>
      <PanelHead title={BW.copyTitle} onClose={onClose} />
      <div className="mn-panel-body" aria-busy={loading || undefined}>
        {loading ? (
          <div className="bf-bones" role="status">
            <p className="visually-hidden">{BW.loading}</p>
            {[0, 1, 2, 3].map((at) => (
              <span key={at} className="bf-bone" aria-hidden="true" />
            ))}
          </div>
        ) : listed.length === 0 ? (
          <div className="rs-empty">
            <Glyph name="staff" size={28} weight={2} />
            <p className="rs-empty-title">{BW.nobody}</p>
            <Link className="gs-pill is-secondary" to={jobsAt}>
              {BW.giveShift}
            </Link>
          </div>
        ) : (
          <>
            <p className="mn-sub">{BW.copySub}</p>
            <ul className="bf-copy-list">
              {listed.map((one) => (
                <CopyRow
                  key={one.id}
                  one={one}
                  acts={acts}
                  busy={busy === one.id}
                  missed={missed === one.id}
                  handHeld={handHeld?.id === one.id ? handHeld.url : null}
                  onCopy={() => onCopy(one.id)}
                  onMark={() => onMark(one.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function RulesPanel({
  rules,
  draft,
  manage,
  cut,
  saved,
  notSaved,
  onEdit,
  onType,
  onSave,
  onCancel,
  onClose,
}: {
  rules: string;
  draft: string | null;
  manage: boolean;
  cut: boolean;
  saved: boolean;
  notSaved: boolean;
  onEdit: () => void;
  onType: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const count = draft == null ? null : countLine(draft);

  return (
    <>
      <PanelHead title={BW.rules} onClose={onClose} />
      <div className="mn-panel-body">
        {saved && (
          <p className="bf-saved">
            <Glyph name="tick" size={16} weight={2.6} />
            {BW.saved}
          </p>
        )}
        {draft == null ? (
          <>
            {rules === '' ? (
              <div className="bf-rules-empty">
                <p className="rs-empty-title">{BW.rulesNone}</p>
                <p className="mn-sub">{BW.rulesWhere}</p>
              </div>
            ) : (
              <>
                <p className="mn-sub">{BW.rulesWhere}</p>
                <p className="bf-rules">{rules}</p>
              </>
            )}
            {manage && (
              <button type="button" className="gs-pill is-secondary" onClick={onEdit}>
                {BW.editRules}
              </button>
            )}
          </>
        ) : (
          <div className="bf-rules-edit">
            <label htmlFor="bf-rules-box" className="gs-label">
              {BW.rulesLabel}
            </label>
            <p className="mn-sub" id="bf-rules-where">
              {BW.rulesWhere}
            </p>
            <textarea
              id="bf-rules-box"
              className="desk-box bf-rules-box"
              rows={10}
              value={draft}
              aria-describedby={`bf-rules-where${count != null ? ' bf-rules-count' : ''}${cut ? ' bf-rules-cut' : ''}`}
              onChange={(event) => onType(event.currentTarget.value)}
            />
            {count != null && (
              <p id="bf-rules-count" className={count.limit ? 'bf-count is-limit' : 'bf-count'}>
                {count.limit && <Glyph name="warn" size={15} weight={2.4} />}
                {count.words}
              </p>
            )}
            {cut && (
              <p id="bf-rules-cut" className="bf-count is-limit">
                <Glyph name="warn" size={15} weight={2.4} />
                {BW.cut}
              </p>
            )}
            {notSaved && (
              <p className="mn-failed" role="alert">
                <Glyph name="alert" size={17} weight={2.2} />
                {BW.notSaved}
              </p>
            )}
          </div>
        )}
      </div>
      {draft != null && (
        <div className="mn-panel-foot">
          <div className="mn-panel-acts">
            <button type="button" className="desk-text" onClick={onCancel}>
              {BW.cancel}
            </button>
            <Pill label={BW.save} primary onClick={onSave} />
          </div>
        </div>
      )}
    </>
  );
}

function PreviewPanel({
  people,
  one,
  rules,
  event,
  at,
  onPick,
  onRetry,
  onClose,
}: {
  people: readonly Person[];
  one: Person;
  rules: string;
  event: string;
  at: 'loading' | 'shown' | 'failed';
  onPick: (id: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const [starts, ends] = (one.shift ?? '').split(' to ');

  return (
    <>
      <PanelHead title={BW.previewAs} onClose={onClose} />
      <div className="mn-panel-body">
        <label htmlFor="bf-preview-who" className="gs-label">
          {BW.previewWho}
        </label>
        <Select
          id="bf-preview-who"
          value={one.id}
          shown={one.name}
          options={people.map((person) => ({ value: person.id, label: person.name }))}
          onChange={onPick}
        />
        <p className="bf-banner">
          <Glyph name="eye" size={16} weight={2.3} />
          {BW.previewBanner}
        </p>
        {at === 'failed' ? (
          <div className="bf-check-failed" role="alert">
            <p className="rs-missed">
              <Glyph name="alert" size={15} weight={2.2} />
              {BW.didNotWork}
            </p>
            <button type="button" className="gs-pill is-secondary" onClick={onRetry}>
              {BW.tryAgain}
            </button>
          </div>
        ) : at === 'loading' ? (
          <div className="bf-phone bf-bones" role="status" aria-busy="true">
            <p className="visually-hidden">{BW.previewLoading}</p>
            {[0, 1, 2].map((bone) => (
              <span key={bone} className="bf-bone" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <div className="bf-phone" aria-label={`${one.name}’s page`} role="group">
            <p className="myn-event">{event}</p>
            {one.shift == null ? (
              <section className="myn-card">
                <p className="myn-big">{BW.previewNoShift('Saturday')}</p>
              </section>
            ) : (
              <>
                <p className="bf-phone-on">
                  <span className="myn-on-label">{MN.onTonight}</span>{' '}
                  <span className="myn-on-station">{one.station ?? one.job}</span>
                </p>
                <section className="myn-card">
                  <p className="bf-phone-h">{MN.yourShift}</p>
                  <p className="myn-big">{one.job}</p>
                  <p className="myn-time">{MN.times(starts ?? '', ends ?? '')}</p>
                </section>
                <section className="myn-card">
                  <p className="bf-phone-h">{MN.yourLead}</p>
                  {one.id === 'ifeoma' ? (
                    <p className="myn-quiet">{MN.noLead}</p>
                  ) : (
                    <p className="myn-big">Ifeoma Nduka · {MN.floorLead}</p>
                  )}
                </section>
              </>
            )}
            {rules !== '' && (
              <section className="myn-card">
                <p className="bf-phone-h">{MN.beforeYouStart}</p>
                <p className="myn-rules">{rules}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function CheckBody({
  costs,
  at,
  billing,
  sending,
  failed,
  tell,
  onRetry,
  onCopy,
}: {
  costs: Check;
  at: BriefingStart['checkAt'];
  billing: boolean;
  sending: boolean;
  failed: boolean;
  tell: Tell;
  onRetry: () => void;
  onCopy: () => void;
}) {
  const short = costs.smsWaits + costs.whatsAppWaits > 0;

  return (
    <div className="rs-check bf-check" aria-busy={at === 'loading' || sending || undefined}>
      {at === 'loading' ? (
        <p className="bf-working" role="status">
          <span className="pending-spinner desk-turning" aria-hidden="true" />
          {BW.working}
        </p>
      ) : at === 'failed' ? (
        <div className="bf-check-failed" role="alert">
          <p className="rs-missed">
            <Glyph name="alert" size={15} weight={2.2} />
            {BW.costFailed}
          </p>
          <button type="button" className="gs-pill is-secondary" onClick={onRetry}>
            {BW.tryAgain}
          </button>
        </div>
      ) : (
        <>
          <p className="bf-check-people">{BW.people(costs.people)}</p>
          {costs.noMobile > 0 && (
            <p className="rs-check-hint">{BW.noMobileCount(costs.noMobile)}</p>
          )}
          <ul className="bf-check-lines">
            {costs.sms.n > 0 && <li>{BW.smsLine(costs.sms.n, costs.sms.credits)}</li>}
            {costs.whatsApp != null && costs.whatsApp.n > 0 && (
              <li>{BW.whatsAppLine(costs.whatsApp.n, costs.whatsApp.credits)}</li>
            )}
            <li className="bf-check-total">{BW.totalLine(costs.credits)}</li>
          </ul>
          <p className="rs-check-credits">{BW.after(costs.after)}</p>
          {short && (
            <div className="rs-check-short">
              {costs.whatsAppWaits > 0 && (
                <p className="rs-check-wait">
                  <Glyph name="clock" size={15} weight={2.2} />
                  {BW.whatsAppWaits(costs.whatsAppWaits)}
                </p>
              )}
              {costs.smsWaits > 0 && (
                <p className="rs-check-wait">
                  <Glyph name="clock" size={15} weight={2.2} />
                  {BW.smsWaits(costs.smsWaits)}
                </p>
              )}
              <button
                type="button"
                className="desk-text"
                onClick={() =>
                  tell(`${billing ? BW.addCredits : BW.askOwner} has its own design (sc-3963).`)
                }
              >
                {billing ? BW.addCredits : BW.askOwner}
              </button>
            </div>
          )}
          <p className="rs-check-hint">{BW.usage}</p>
          {failed && (
            <p className="rs-missed" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {BW.sendFailed}
            </p>
          )}
          <button type="button" className="desk-text bf-check-copy" onClick={onCopy}>
            {BW.copy}
          </button>
        </>
      )}
    </div>
  );
}
