import { type KeyboardEvent, useId, useRef, useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { offButton } from '../offButton.ts';
import {
  type Draft,
  EVENT_NAME,
  HOSTS,
  MW,
  PAGE_WHEN,
  channelWord,
  filled,
  many,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { OnEscape, TickChip } from './MessagesCompose.tsx';
import {
  type Invite,
  type InvitePerson,
  IW,
  emailLines,
  goesBySms,
  goesByWhatsApp,
  inviteAudienceOf,
  inviteChipWords,
  inviteCheckOf,
  inviteGoing,
  inviteLines,
  inviteReachOf,
  iw,
  noteProblem,
  refusalLine,
  refusalTitle,
  smsOf,
  whatsAppInvitationOf,
} from './messagesInvite.ts';
import { WhatsAppReach, WhereGlyph } from './MessagesParts.tsx';
import { PreviewAs } from './MessagesPreview.tsx';
import { PW } from './messagesPreviewWords.ts';
import { ToPopover } from './MessagesTo.tsx';
import { WaitBlock } from './MessagesWaits.tsx';
import './messagesInvite.css';

/** Email and SMS (sc-3971), and WhatsApp once its template is approved (sc-45251). */
function channelsFor(invite: Invite) {
  return invite.wa == null ? (['email', 'sms'] as const) : (['email', 'sms', 'whatsApp'] as const);
}

/** sc-3950's reach line and sc-3954's instead line, whenever WhatsApp is ticked. */
function ReachLines({ whatsApp, instead }: { whatsApp: string | null; instead: string | null }) {
  return (
    <>
      {whatsApp != null && <WhatsAppReach line={whatsApp} />}
      {instead != null && <p className="mg-instead">{instead}</p>}
    </>
  );
}
const LANGUAGES = new Intl.DisplayNames(['en'], { type: 'language' });

function sendKeys(event: KeyboardEvent, then: () => void): void {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;

  event.preventDefault();
  then();
}

/** New message on the invitation (sc-3971): To and Email and SMS at its head, Soirely's words shown and not edited, and the hosts' note in the box. */
export function InviteCompose({ opening }: { opening: boolean }) {
  const { inbox, act, focus, to: event } = useInbox();
  const draft = inbox.draft;
  const [toOpen, setToOpen] = useState(opening || draft?.openTo === true);
  const chip = useRef<HTMLButtonElement>(null);
  const byId = useId();

  if (draft?.invite == null) return null;

  const invite = draft.invite;
  const groups = event.book.groups;
  const audience = inviteAudienceOf(draft.to, invite, groups);
  const first = audience.everyone[0] ?? null;
  const set = (next: Partial<Invite>) =>
    act({ kind: 'draft', draft: { invite: { ...invite, ...next } } });

  function send(): void {
    if (noteProblem(invite.note) != null) {
      set({ tooLong: true });
      focus('note');
      return;
    }
    act({ kind: 'draft', draft: { step: 'check', invite: { ...invite, seeAll: false } } });
    focus('check');
  }

  function edit(): void {
    act({ kind: 'draft', draft: { step: 'write' } });
    focus('note');
  }

  return (
    <div className="mg-in is-compose">
      <h2 className="desk-unseen">{MW.invitation}</h2>
      {draft.step !== 'preview' && (
        <header className="mg-to-head">
          <div className="mg-to-row">
            <span className="mg-to-label">{MW.to}</span>
            <div className="mg-to-at">
              <button
                ref={chip}
                type="button"
                className="mg-to-chip"
                aria-haspopup="dialog"
                aria-expanded={toOpen}
                data-focus="to-chip"
                onClick={() => setToOpen((open) => !open)}
              >
                {inviteChipWords(draft.to, invite, audience)}
                <Glyph name="chevdown" size={14} weight={2.6} />
              </button>
              {toOpen && (
                <ToPopover
                  to={draft.to}
                  chip={chip}
                  onPick={(to) =>
                    act({
                      kind: 'draft',
                      draft: {
                        to,
                        invite: {
                          note: invite.note,
                          again: invite.again,
                          ...(invite.wa == null ? {} : { wa: invite.wa }),
                        },
                      },
                    })
                  }
                  onClose={(back) => {
                    setToOpen(false);
                    if (back) focus('to-chip');
                  }}
                />
              )}
            </div>
          </div>
          <div className="mg-by-row" role="group" aria-labelledby={byId}>
            <span id={byId} className="mg-by-label">
              {MW.letThemKnowBy}
            </span>
            <InviteTicks draft={draft} invite={invite} />
          </div>
          {draft.step === 'write' && (
            <ReachLines {...inviteReachOf(draft.to, invite, draft.ticks, groups)} />
          )}
        </header>
      )}
      <div className={draft.step === 'preview' ? 'mg-compose-body is-top' : 'mg-compose-body'}>
        {draft.step === 'preview' ? (
          <InvitePreview draft={draft} invite={invite} people={audience.everyone} />
        ) : (
          <>
            <InviteWords person={first} />
            {draft.step === 'check' && (
              <InviteCheck draft={draft} invite={invite} onChange={edit} />
            )}
            {draft.step === 'write' && inbox.cancelled && (
              <p className="mg-status" role="status">
                <Glyph name="info" size={15} weight={2.2} />
                {IW.cancelled}
              </p>
            )}
          </>
        )}
      </div>
      {draft.step === 'preview' ? (
        <div className="mg-preview-bar">
          <button type="button" className="desk-text" data-focus="preview-edit" onClick={edit}>
            <Glyph name="pen" size={17} weight={2.2} />
            {MW.edit}
          </button>
          <button type="button" className="desk-text" aria-pressed="true" onClick={edit}>
            <Glyph name="eye" size={17} weight={2.2} />
            {MW.previewOn}
          </button>
          <span className="today-grow" />
          <button type="button" className="mg-send" aria-label={MW.send} onClick={send}>
            <Glyph name="send" size={20} weight={2.4} />
          </button>
        </div>
      ) : (
        <NoteBox
          invite={invite}
          held={draft.step !== 'write'}
          previewOff={first == null ? PW.nobodyToPreview : null}
          onNote={(note) =>
            set({ note, tooLong: invite.tooLong === true && noteProblem(note) != null })
          }
          onSend={send}
          onPreview={() => {
            act({ kind: 'draft', draft: { step: 'preview' } });
            focus('preview-edit');
          }}
        />
      )}
    </div>
  );
}

function InviteTicks({ draft, invite }: { draft: Draft; invite: Invite }) {
  const { act } = useInbox();

  return (
    <div className="mg-ticks">
      {channelsFor(invite).map((channel) => (
        <TickChip
          key={channel}
          word={channelWord(channel)}
          on={draft.ticks[channel]}
          onToggle={() =>
            act({
              kind: 'draft',
              draft: { ticks: { ...draft.ticks, [channel]: !draft.ticks[channel] } },
            })
          }
        />
      ))}
    </div>
  );
}

/** Soirely's own words, a grey inset as Tell guests has them, filled in for the first guest A to Z. */
function InviteWords({ person }: { person: InvitePerson | null }) {
  const words = inviteLines(person?.greet ?? '');

  return (
    <div className="mg-tell-part mi-words">
      <p className="mg-tell-label">
        {person == null ? MW.invitation : iw.filled(IW.asSeenBy, { name: person.name })}
      </p>
      <div className="mg-tell-box mi-box">
        <p className="mi-box-title">{words.title}</p>
        {(person == null ? words.lines.slice(1) : words.lines).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <p className="mg-tell-hint">{MW.eachLanguage}</p>
    </div>
  );
}

function NoteBox({
  invite,
  held,
  previewOff,
  onNote,
  onSend,
  onPreview,
}: {
  invite: Invite;
  held: boolean;
  previewOff: string | null;
  onNote: (note: string) => void;
  onSend: () => void;
  onPreview: () => void;
}) {
  const noteId = useId();
  const hintId = useId();
  const wrongId = useId();
  const offId = useId();
  const problem = invite.tooLong === true ? noteProblem(invite.note) : null;

  return (
    <form
      className={held ? 'mg-composer is-held' : 'mg-composer'}
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <label htmlFor={noteId} className="mg-tell-label mi-note-label">
        {IW.noteForGuests}
        <span className="mg-optional">{MW.optional}</span>
      </label>
      <textarea
        id={noteId}
        className={problem == null ? 'mg-tell-note mi-note' : 'mg-tell-note mi-note is-wrong'}
        value={invite.note}
        readOnly={held}
        aria-invalid={problem != null || undefined}
        aria-describedby={problem == null ? hintId : `${wrongId} ${hintId}`}
        data-focus="note"
        onChange={(event) => onNote(event.target.value)}
        onKeyDown={(event) => sendKeys(event, onSend)}
      />
      {problem != null && (
        <p id={wrongId} className="mg-tell-hint is-wrong">
          <Glyph name="alert" size={15} weight={2.2} />
          {problem}
        </p>
      )}
      {!held && (
        <div className="mg-tools">
          <button
            type="button"
            className="desk-text mg-preview-tool"
            data-focus="preview"
            aria-describedby={previewOff == null ? undefined : offId}
            {...offButton(previewOff != null)}
            onClick={onPreview}
          >
            <Glyph name="eye" size={17} weight={2.2} />
            {MW.preview}
          </button>
          <span id={hintId} className="mg-goes-page mi-hint">
            {invite.wa == null ? IW.noteHint : MW.noteHint}
          </span>
          <button
            type="submit"
            className="mg-send"
            aria-label={MW.send}
            aria-keyshortcuts="Meta+Enter Control+Enter"
            data-focus="send"
          >
            <Glyph name="send" size={20} weight={2.4} />
          </button>
        </div>
      )}
      {!held && previewOff != null && (
        <p id={offId} className="mg-why">
          <Glyph name="info" size={16} weight={2.2} />
          <span>{previewOff}</span>
        </p>
      )}
    </form>
  );
}

/** The check on an invitation: B's card, with who already has it under the title and nobody within reach refused. */
function InviteCheck({
  draft,
  invite,
  onChange,
}: {
  draft: Draft;
  invite: Invite;
  onChange: () => void;
}) {
  const { inbox, act, focus, tell, to } = useInbox();
  const groups = to.book.groups;
  const check = inviteCheckOf(draft.to, invite, draft.ticks, groups, inbox.balance);
  const sentenceId = useId();
  const radios = useId();
  const set = (next: Partial<Invite>) =>
    act({ kind: 'draft', draft: { invite: { ...invite, ...next } } });
  const change = (
    <button
      type="button"
      className="desk-text"
      onClick={() => {
        onChange();
        focus('note');
      }}
    >
      {MW.changeIt}
    </button>
  );
  const cant = check.cant > 0 && (
    <div className="mg-cant">
      {!check.refused && <p className="mg-cant-head">{iw.many('cantBeReached', check.cant)}</p>}
      {check.cantNamed.map((one) => (
        <p key={one.name}>{[one.name, ...one.why].join(' · ')}</p>
      ))}
      {check.cant > check.cantNamed.length && (
        <button
          type="button"
          className="desk-text"
          onClick={() => tell(`${filled(MW.seeAll, { count: check.cant })} has its own design.`)}
        >
          {filled(MW.seeAll, { count: check.cant })}
        </button>
      )}
    </div>
  );

  return (
    <div
      className="mg-check mi-check"
      role="alertdialog"
      aria-label={MW.checkName}
      aria-describedby={sentenceId}
    >
      <OnEscape
        then={() => {
          act({ kind: 'draft', draft: { step: 'write' } });
          focus('send');
        }}
      />
      {check.refused ? (
        <>
          <p id={sentenceId} className="mg-check-sentence" tabIndex={-1} data-focus="check">
            {refusalTitle(check.count)}
          </p>
          <p className="mg-check-line mi-refused">
            <Glyph name="alert" size={15} weight={2.2} />
            {refusalLine(check.count)}
          </p>
          <InviteTicks draft={draft} invite={invite} />
          {cant}
          <div className="mg-check-acts">{change}</div>
        </>
      ) : (
        <>
          <p id={sentenceId} className="mg-check-sentence" tabIndex={-1} data-focus="check">
            {many('cannotUndo', check.count)}
          </p>
          {invite.seeAll === true ? (
            <AlreadyAll draft={draft} invite={invite} onBack={() => set({ seeAll: false })} />
          ) : (
            <>
              {check.already > 0 && (
                <div className="mg-cant mi-already">
                  <p className="mg-cant-head">{iw.many('already', check.already)}</p>
                  {check.named.map((one) => (
                    <p key={one.id}>{`${one.name} · ${one.line}`}</p>
                  ))}
                  {check.already > check.named.length && (
                    <button
                      type="button"
                      className="desk-text"
                      onClick={() => {
                        set({ seeAll: true });
                        focus('back-check');
                      }}
                    >
                      {filled(MW.seeAll, { count: check.already })}
                    </button>
                  )}
                </div>
              )}
              {check.choice && (
                <fieldset className="mg-radios mi-radios">
                  <legend className="desk-unseen">{iw.many('already', check.already)}</legend>
                  {[false, true].map((again) => (
                    <label key={String(again)} className="mg-radio-row">
                      <input
                        type="radio"
                        name={radios}
                        className="desk-radio"
                        checked={invite.again === again}
                        onChange={() => set({ again })}
                      />
                      {again ? IW.sendAgain : IW.leaveThemOut}
                    </label>
                  ))}
                </fieldset>
              )}
              <InviteTicks draft={draft} invite={invite} />
              {check.pills.length > 0 && (
                <ul className="mg-pills">
                  {check.pills.map((pill) => (
                    <li key={pill.channel}>
                      <WhereGlyph where={pill.channel} size={15} />
                      {channelWord(pill.channel)} · {pill.count}
                    </li>
                  ))}
                </ul>
              )}
              <ReachLines whatsApp={check.whatsApp} instead={check.instead} />
              {cant}
              {check.credits != null && <p className="mg-credits">{check.credits}</p>}
              {check.waits != null && <WaitBlock waits={check.waits} />}
            </>
          )}
          <div className="mg-check-acts">
            <button
              type="button"
              className="button button-primary mg-go"
              data-focus="go"
              onClick={() => {
                act({ kind: 'go', invite: inviteGoing(draft, groups) });
                focus('cancel');
              }}
            >
              {many('sendTo', check.count)}
            </button>
            {change}
          </div>
        </>
      )}
    </div>
  );
}

/** See all, open in the card: everyone who already has their invitation, A to Z, with how and when. */
function AlreadyAll({
  draft,
  invite,
  onBack,
}: {
  draft: Draft;
  invite: Invite;
  onBack: () => void;
}) {
  const { focus, to } = useInbox();
  const { already } = inviteAudienceOf(draft.to, invite, to.book.groups);

  return (
    <div className="mi-all">
      <button
        type="button"
        className="desk-text"
        data-focus="back-check"
        onClick={() => {
          onBack();
          focus('check');
        }}
      >
        <Glyph name="back" size={17} weight={2.3} />
        {IW.backToCheck}
      </button>
      <ul className="mi-all-list" aria-label={iw.many('already', already.length)}>
        {already.map((one) => (
          <li key={one.id}>
            <span className="mi-all-name">{one.name}</span>
            <span className="mi-all-line">{one.line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function languageLine(person: InvitePerson): string {
  if (person.language == null)
    return filled(PW.organisationLanguage, { language: LANGUAGES.of('en') ?? 'English' });

  const language = LANGUAGES.of(person.language.code) ?? person.language.code;

  return filled(person.language.chose ? PW.choseLanguage : MW.inLanguage, { language });
}

/** Preview on the invitation: what Soirely sends one guest by each ticked channel they have, and the note as their page shows it. */
function InvitePreview({
  draft,
  invite,
  people,
}: {
  draft: Draft;
  invite: Invite;
  people: readonly InvitePerson[];
}) {
  const { act, mesh } = useInbox();
  const sendsId = useId();
  const person = people.find((one) => one.id === invite.as) ?? people[0];

  if (person == null) return null;

  const note = invite.note.trim();
  const email = emailLines();
  const sms = smsOf(person.greet);
  const words = inviteLines(person.greet);
  const shownEmail = draft.ticks.email && person.email;
  const shownSms = goesBySms(person, draft.ticks, invite.wa);
  const shownWa = goesByWhatsApp(person, draft.ticks, invite.wa);
  const wa = whatsAppInvitationOf(person, invite.noReplyBy === true);

  return (
    <div className="mg-preview">
      <div className="mg-preview-top">
        <h3 className="mg-preview-heading">{filled(MW.previewAs, { name: person.name })}</h3>
        <PreviewAs
          options={people.map((one) => ({
            id: one.id,
            words: filled(PW.option, {
              name: one.name,
              language: LANGUAGES.of(one.language?.code ?? 'en') ?? 'English',
            }),
          }))}
          who={person.id}
          first={false}
          onPick={(as) => act({ kind: 'draft', draft: { invite: { ...invite, as } } })}
        />
      </div>
      <div className="mg-preview-cols">
        {note !== '' && (
          <div className="mg-page">
            <div className={`mg-page-cover today-cover is-${mesh}`}>
              <span className="desk-piece p1" aria-hidden="true" />
              <span className="desk-piece p2" aria-hidden="true" />
              <span className="desk-piece p4" aria-hidden="true" />
              <p className="mg-page-name">{EVENT_NAME}</p>
              <p className="mg-page-when">{PAGE_WHEN}</p>
            </div>
            <figure className="mg-page-figure">
              <p className="mg-page-subject">{iw.filled(IW.noteFromHosts, { hosts: HOSTS })}</p>
              <blockquote>{note}</blockquote>
            </figure>
          </div>
        )}
        {(shownEmail || shownSms || shownWa) && (
          <section className="mg-sends" aria-labelledby={sendsId}>
            <h3 id={sendsId}>{MW.whatSoirelySends}</h3>
            {shownEmail && (
              <div className="mg-email">
                <p className="mg-notice-head">
                  <WhereGlyph where="email" />
                  {email.from}
                </p>
                <div className="mg-notice-words">
                  <p>
                    {words.lines[0]}
                    <br />
                    {words.lines[1]}
                  </p>
                  {[MW.replyYes, MW.replyNo, MW.replyNotSure].map((answer) => (
                    <span key={answer} className="mg-email-button">
                      {answer}
                    </span>
                  ))}
                  {email.foot.map((line) => (
                    <p key={line} className="mi-email-foot">
                      {line}
                    </p>
                  ))}
                  <span className="mg-email-stop">{email.stop}</span>
                </div>
              </div>
            )}
            {shownSms && (
              <div className="mg-notice">
                <p className="mg-notice-head">
                  <WhereGlyph where="sms" />
                  {many('smsParts', sms.parts)}
                </p>
                <p className="mg-notice-bubble">{sms.text}</p>
              </div>
            )}
            {shownWa && (
              <div className="mg-notice">
                <p className="mg-notice-head">
                  <WhereGlyph where="whatsApp" />
                  {MW.whatsAppTemplate}
                </p>
                <div
                  className="mg-notice-bubble is-wa mi-wa"
                  lang={wa.lang === 'en' ? undefined : wa.lang}
                >
                  {wa.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <span>{wa.button}</span>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      <ul className="mg-preview-lines">
        <li>
          {person.greet === person.name
            ? filled(MW.greetedAs, { name: person.name })
            : filled(PW.greetedAs, { greetAs: person.greet })}
        </li>
        <li>{languageLine(person)}</li>
        {note !== '' && <li>{MW.onlyOurs}</li>}
      </ul>
    </div>
  );
}
