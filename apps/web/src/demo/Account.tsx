import { DemoBell } from './DemoBell.tsx';
import { DemoOffline } from './DemoOffline.tsx';
import { contactActions, initials, primaryOf, zoneLabel } from '@soirely/domain';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ACCOUNT_WORDS as W,
  type Contact,
  type DialogStart,
  KIND_WORDS,
  type Kind,
  PHONE_COUNTRY,
  ZONES,
  accountStart,
  canAdd,
  cardLine,
  contactsFoot,
  madePrimary,
  opening,
  phoneShown,
  rowLine,
  sampleCodeSource,
  sampleProof,
  sampleSave,
  verifiedWords,
} from './account.ts';
import {
  AddEmailDialog,
  AddPhoneDialog,
  NameDialog,
  ProveDialog,
  VerifyDialog,
  ZoneDialog,
} from '../components/AccountDialogs.tsx';
import { SAMPLE } from './rules.ts';
import type { Viewer } from './settings.ts';
import { saveName, savedNameOf } from './savedName.ts';
import { AboutRow, ContactsBlock, PersonCard, RowOffers } from '../components/AccountParts.tsx';
import { Bones } from '../components/GeneralParts.tsx';
import { Ask, Head, TextAction, TitleRow } from '../components/SettingsParts.tsx';
import type { Tell } from '../components/SettingsParts.tsx';

/** Your account at a desk in B · Summary first (Web-Account-*.dc.html): the app's page, the same for every role. */
export function Account({ viewer, state, tell }: { viewer: Viewer; state: string; tell: Tell }) {
  const { t } = useTranslation();
  const [start] = useState(() => accountStart(state, viewer));
  const [load, setLoad] = useState<'loading' | 'failed' | 'loaded'>(
    state === 'loading' || state === 'failed' ? state : 'loaded',
  );
  const [name, setName] = useState(() => savedNameOf(viewer.key) ?? start.name);
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
        <DemoOffline />
        <TitleRow title={W.title} bell={<DemoBell tell={tell} />} />
        <PersonCard
          initials={initials(name)}
          name={name}
          address={primary?.shown ?? null}
          said={card.line == null ? null : { text: card.line, done: card.done }}
          step={
            card.waiting == null
              ? null
              : { label: W.sendCode, onClick: () => card.waiting && verify(card.waiting) }
          }
        />
        <section className="desk-block">
          <Head title={W.about} />
          <ul className="desk-rows account-rows">
            <AboutRow
              lead="user"
              title={name}
              line={W.yourName}
              onOpen={() => setDialog(opening('name', { typed: name }))}
            />
            <AboutRow
              lead="globe"
              title={zoneLabel(zone)}
              line={W.zoneLine(zone.id)}
              onOpen={() => setDialog(opening('zone'))}
            />
          </ul>
        </section>
        {load !== 'loaded'
          ? (['email', 'phone'] as const).map((kind) => (
              <section key={kind} className="desk-block">
                <Head title={KIND_WORDS[kind].title} />
                {load === 'failed' ? (
                  <div className="desk-failed" role="alert">
                    <p className="desk-line">
                      {t(kind === 'email' ? 'contacts.emailsFailed' : 'contacts.phonesFailed')}
                    </p>
                    <TextAction
                      label={t('error.retry')}
                      onClick={() => {
                        setLoad('loading');
                        window.setTimeout(() => setLoad('loaded'), 700);
                      }}
                    />
                  </div>
                ) : (
                  <Bones count={kind === 'email' ? 2 : 1} label={t('pending.loading')} />
                )}
              </section>
            ))
          : (['email', 'phone'] as const).map((kind) => (
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
          onSave={(next) =>
            sampleSave(null, () => {
              setName(next);
              saveName(viewer.key, next);
              finish(W.nameSaved(next));
            })
          }
        />
      )}
      {dialog?.kind === 'zone' && (
        <ZoneDialog
          zones={ZONES}
          now={zoneLabel(zone)}
          start={dialog}
          onClose={() => setDialog(null)}
          onSave={(next) =>
            sampleSave(null, () => {
              setZone(next);
              finish(W.zoneSaved(zoneLabel(next)));
            })
          }
        />
      )}
      {dialog?.kind === 'addEmail' && (
        <AddEmailDialog
          start={dialog}
          onClose={() => setDialog(null)}
          onAdd={(address) =>
            sampleSave(linked(emails, address) ? KIND_WORDS.email.linked : null, () => {
              setEmails((rows) => [...rows, added('email', address)]);
              finish(W.added);
            })
          }
        />
      )}
      {dialog?.kind === 'addPhone' && (
        <AddPhoneDialog
          startCountry={PHONE_COUNTRY}
          start={dialog}
          onClose={() => setDialog(null)}
          onAdd={(country, number) => {
            const shown = phoneShown(country, number);

            return sampleSave(linked(phones, shown) ? KIND_WORDS.phone.linked : null, () => {
              setPhones((rows) => [...rows, added('phone', shown)]);
              finish(W.added);
            });
          }}
        />
      )}
      {dialog?.kind === 'confirm' && target != null && (
        <ProveDialog
          via="password"
          twoFactorOn
          returned={null}
          purpose={{ kind: 'makePrimary', address: target.id }}
          start={{
            password: dialog.tried ? SAMPLE.password : '',
            typed: dialog.typed,
            tried: dialog.tried,
          }}
          prove={sampleProof}
          onClose={() => setDialog(null)}
          onProved={() => promote(target)}
        />
      )}
      {dialog?.kind === 'verify' && target != null && (
        <VerifyDialog
          kind={target.kind}
          source={sampleCodeSource(dialog)}
          start={dialog}
          row={target}
          onClose={() => setDialog(null)}
          onVerified={async () => {
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

function linked(rows: readonly Contact[], shown: string): boolean {
  return rows.some((row) => row.shown.toLowerCase() === shown.trim().toLowerCase());
}

/** A section of addresses or numbers, with the offers its opened row makes. */
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
  const words = KIND_WORDS[kind];

  return (
    <ContactsBlock
      kind={kind}
      title={words.title}
      add={canAdd(rows) ? words.add : null}
      rows={rows}
      open={open}
      unverified={W.unverified}
      lineOf={rowLine}
      foot={contactsFoot(kind, rows)}
      onToggle={onToggle}
      onAdd={onAdd}
      renderOffers={(row) => {
        const offers = contactActions(row);

        return (
          <RowOffers line={W.removeLine}>
            {offers.verify && (
              <button type="button" className="desk-text" onClick={() => onAct(row, 'verify')}>
                {W.sendCode}
              </button>
            )}
            {offers.makePrimary && (
              <button type="button" className="desk-text" onClick={() => onAct(row, 'primary')}>
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
          </RowOffers>
        );
      }}
    />
  );
}
