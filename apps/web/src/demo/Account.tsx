import { contactActions, initials, zoneLabel } from '@soirely/domain';
import { useId, useState } from 'react';

import {
  ACCOUNT_WORDS as W,
  type Contact,
  type DialogStart,
  KIND_WORDS,
  type Kind,
  accountStart,
  canAdd,
  cardLine,
  contactsFoot,
  madePrimary,
  opening,
  primaryFirst,
  primaryOf,
  rowLine,
  verifiedWords,
} from './account.ts';
import {
  AddEmailDialog,
  AddPhoneDialog,
  NameDialog,
  ProveDialog,
  VerifyDialog,
  ZoneDialog,
} from './AccountDialogs.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import type { Viewer } from './settings.ts';
import {
  Ask,
  Card,
  CardStep,
  Chevron,
  Head,
  OnCard,
  RowWords,
  TitleRow,
} from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';
import './account.css';

const ICONS: Record<Kind, GlyphName> = { email: 'mail', phone: 'phone' };

/** Your account at a desk in B · Summary first (Web-Account-*.dc.html): the app's page, the same for every role. */
export function Account({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const [start] = useState(() => accountStart(state, viewer));
  const [name, setName] = useState(start.name);
  const [zone, setZone] = useState(start.zone);
  const [emails, setEmails] = useState(start.emails);
  const [phones, setPhones] = useState(start.phones);
  const [said, setSaid] = useState(start.said);
  const [open, setOpen] = useState(start.open);
  const [ask, setAsk] = useState(start.ask);
  const [dialog, setDialog] = useState<DialogStart | null>(start.dialog);
  const all = [...emails, ...phones];
  const opened = all.find((row) => row.id === open) ?? null;
  const card = cardLine(emails, phones, said);
  const primary = primaryOf(emails);
  const target = all.find((row) => row.id === dialog?.contact) ?? null;
  const setRows = (kind: Kind) => (kind === 'email' ? setEmails : setPhones);

  function finish(words: string): void {
    setDialog(null);
    setOpen(null);
    setSaid(words);
  }

  function verify(row: Contact): void {
    setDialog(
      opening('verify', { contact: row.id, channel: row.kind === 'email' ? 'email' : 'whatsApp' }),
    );
  }

  function remove(row: Contact): void {
    setRows(row.kind)((rows) => rows.filter((other) => other.id !== row.id));
    setOpen(null);
    setAsk(null);
    setSaid(W.removed(row.shown));
  }

  function promote(row: Contact): void {
    setRows(row.kind)((rows) => madePrimary(rows, row.id));
    finish(KIND_WORDS[row.kind].madePrimary(row.shown));
  }

  function act(row: Contact, action: 'verify' | 'primary' | 'remove'): void {
    const offers = contactActions(row);
    if (action === 'verify') verify(row);
    else if (action === 'primary') {
      if (row.kind === 'email') setAsk('promote');
      else promote(row);
    } else if (offers.askBeforeRemoving) setAsk('remove');
    else remove(row);
  }

  return (
    <div className="desk-page">
      <div className="desk-column">
        <TitleRow title={W.title} tell={tell} />
        <Card size="person">
          <div>
            <div className="desk-who">
              <span className="desk-disc" aria-hidden="true">
                {initials(name)}
              </span>
              <div className="desk-who-words">
                <p className="desk-name">{name}</p>
                <OnCard>{primary?.shown}</OnCard>
              </div>
            </div>
            <div aria-live="polite">
              {card.line != null && (
                <p className={card.done ? 'account-said is-done' : 'account-said'}>
                  {card.done && (
                    <span className="desk-mark is-yes account-done" aria-hidden="true">
                      <Glyph name="tick" size={11} weight={3.4} />
                    </span>
                  )}
                  {card.line}
                </p>
              )}
            </div>
          </div>
          {card.waiting != null && (
            <CardStep label={W.sendCode} onClick={() => card.waiting && verify(card.waiting)} />
          )}
        </Card>
        <section className="desk-block">
          <Head title={W.about} />
          <ul className="desk-rows account-rows">
            <li>
              <button
                type="button"
                className="desk-row account-row"
                onClick={() => setDialog(opening('name', { typed: name }))}
              >
                <Lead name="user" />
                <RowWords title={name} lines={[W.yourName]} />
                <Chevron />
              </button>
            </li>
            <li>
              <button
                type="button"
                className="desk-row account-row"
                onClick={() => setDialog(opening('zone'))}
              >
                <Lead name="globe" />
                <RowWords title={zoneLabel(zone)} lines={[W.zoneLine(zone.id)]} />
                <Chevron />
              </button>
            </li>
          </ul>
        </section>
        {(['email', 'phone'] as const).map((kind) => (
          <Contacts
            key={kind}
            kind={kind}
            rows={kind === 'email' ? emails : phones}
            open={open}
            onToggle={(row) => setOpen((now) => (now === row.id ? null : row.id))}
            onAct={act}
            onAdd={() => setDialog(opening(kind === 'email' ? 'addEmail' : 'addPhone'))}
          />
        ))}
      </div>
      {ask === 'promote' && opened != null && (
        <Ask
          title={W.promoteTitle}
          line={W.promoteLine(primary?.shown ?? '')}
          keep={W.keepPrimary(primary?.shown ?? '')}
          go={W.promoteGo}
          red={false}
          onKeep={() => setAsk(null)}
          onGo={() => {
            setAsk(null);
            setDialog(opening('confirm', { contact: opened.id }));
          }}
        />
      )}
      {ask === 'remove' && opened != null && (
        <Ask
          title={KIND_WORDS[opened.kind].removeTitle}
          line={W.removeLine}
          keep={W.keepIt}
          go={W.removeIt}
          onKeep={() => setAsk(null)}
          onGo={() => remove(opened)}
        />
      )}
      {dialog?.kind === 'name' && (
        <NameDialog
          start={dialog}
          saved={name}
          onClose={() => setDialog(null)}
          onSaved={(next) => {
            setName(next);
            finish(W.nameSaved(next));
          }}
        />
      )}
      {dialog?.kind === 'zone' && (
        <ZoneDialog
          start={dialog}
          now={zone}
          onClose={() => setDialog(null)}
          onSaved={(next) => {
            setZone(next);
            finish(W.zoneSaved(zoneLabel(next)));
          }}
        />
      )}
      {dialog?.kind === 'addEmail' && (
        <AddEmailDialog
          start={dialog}
          rows={emails}
          onClose={() => setDialog(null)}
          onAdded={(shown) => {
            setEmails((rows) => [...rows, added('email', shown)]);
            finish(W.added);
          }}
        />
      )}
      {dialog?.kind === 'addPhone' && (
        <AddPhoneDialog
          start={dialog}
          rows={phones}
          onClose={() => setDialog(null)}
          onAdded={(shown) => {
            setPhones((rows) => [...rows, added('phone', shown)]);
            finish(W.added);
          }}
        />
      )}
      {dialog?.kind === 'confirm' && target != null && (
        <ProveDialog
          start={dialog}
          onClose={() => setDialog(null)}
          onProved={() => promote(target)}
        />
      )}
      {dialog?.kind === 'verify' && target != null && (
        <VerifyDialog
          start={dialog}
          row={target}
          onClose={() => setDialog(null)}
          onVerified={() => {
            setRows(target.kind)((rows) =>
              rows.map((row) => (row.id === target.id ? { ...row, verified: true } : row)),
            );
            finish(verifiedWords(target));
          }}
        />
      )}
    </div>
  );
}

function added(kind: Kind, shown: string): Contact {
  return { id: `${kind}-${shown}`, kind, shown, verified: false, primary: false };
}

function Lead({ name }: { name: GlyphName }) {
  return (
    <span className="account-lead" aria-hidden="true">
      <Glyph name={name} size={22} />
    </span>
  );
}

/** A section of addresses or numbers: the primary first and still, every other row opening in place under a Violet rule. */
function Contacts({
  kind,
  rows,
  open,
  onToggle,
  onAct,
  onAdd,
}: {
  kind: Kind;
  rows: readonly Contact[];
  open: string | null;
  onToggle: (row: Contact) => void;
  onAct: (row: Contact, action: 'verify' | 'primary' | 'remove') => void;
  onAdd: () => void;
}) {
  const id = useId();
  const words = KIND_WORDS[kind];

  return (
    <section className="desk-block">
      <Head title={words.title}>
        {canAdd(rows) && (
          <button type="button" className="desk-text" onClick={onAdd}>
            {words.add}
          </button>
        )}
      </Head>
      <ul className="desk-rows account-rows">
        {primaryFirst(rows).map((row) => {
          const rowWords = (
            <>
              <Lead name={ICONS[kind]} />
              <RowWords
                title={row.shown}
                tag={
                  !row.verified && (
                    <span className="desk-tag is-notyet">
                      <span className="desk-mark is-notyet" aria-hidden="true" />
                      {W.unverified}
                    </span>
                  )
                }
                lines={[rowLine(row)]}
              />
            </>
          );

          if (row.primary)
            return (
              <li key={row.id} className="desk-row">
                {rowWords}
              </li>
            );

          const on = row.id === open;
          const offers = contactActions(row);
          const panel = `${id}-${row.id}`;

          return (
            <li key={row.id}>
              <button
                type="button"
                className={on ? 'desk-row account-row is-open' : 'desk-row account-row'}
                aria-expanded={on}
                aria-controls={on ? panel : undefined}
                onClick={() => onToggle(row)}
              >
                {rowWords}
                <Glyph
                  name={on ? 'chevup' : 'chevdown'}
                  size={18}
                  weight={2.4}
                  className="desk-chevron"
                />
              </button>
              {on && (
                <div id={panel} className="account-open" role="group" aria-label={row.shown}>
                  <div className="account-acts">
                    {offers.verify && (
                      <button
                        type="button"
                        className="desk-text"
                        onClick={() => onAct(row, 'verify')}
                      >
                        {W.sendCode}
                      </button>
                    )}
                    {offers.makePrimary && (
                      <button
                        type="button"
                        className="desk-text"
                        onClick={() => onAct(row, 'primary')}
                      >
                        {W.makePrimary}
                      </button>
                    )}
                    {offers.remove && (
                      <button
                        type="button"
                        className="desk-text is-red"
                        onClick={() => onAct(row, 'remove')}
                      >
                        {offers.askBeforeRemoving ? W.removeAsking : W.remove}
                      </button>
                    )}
                  </div>
                  <p className="desk-note">{W.removeLine}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="desk-foot">{contactsFoot(kind, rows)}</p>
    </section>
  );
}
