import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import {
  CardStep,
  Field,
  Head,
  Mark,
  OnCard,
  RowWords,
  TextAction,
} from '../components/SettingsParts.tsx';
import { offButton } from '../offButton.ts';
import { useLater } from '../useLater.ts';
import { type CostLine, lineState, money, moneyRange, wholeRange } from './budget.ts';
import {
  AlertInset,
  Amount,
  BudgetCard,
  BudgetDialog,
  BudgetLoading,
  BudgetRow,
  BudgetShell,
  CardStrong,
  Columns,
  Figure,
  GlassTags,
  InfoLine,
  LiveLine,
  MoneyField,
  NotLiveStrip,
  OpenMark,
  PageTitle,
  Pane,
  Rows,
  UndoBar,
} from './BudgetParts.tsx';
import { fieldsWrong } from './budgetHome.ts';
import { LINK_WORDS, type LinkState, budgetAt } from './budgetSample.ts';
import { BUDGET_WORDS as B } from './budgetWords.ts';
import { type SampleEvent } from './events.ts';
import {
  type Book,
  type ChooseStart,
  type FormStart,
  type Mode,
  type Notice,
  PERCENT_TYPED,
  type PayerEntry,
  SEND_MS,
  type SendKind,
  type Split,
  addPayer,
  applyChoice,
  budgetRange,
  canAddPayer,
  checkFixed,
  checkPercents,
  choicesFor,
  coveredBy,
  coversOf,
  editPayer,
  fixedForm,
  flagWords,
  flaggedLines,
  hasPayer,
  inBudgetOrder,
  nameProblem,
  nextNoPayer,
  noPayer,
  noteProblem,
  notPricedFor,
  openFirst,
  percentProblem,
  paidOf,
  percentText,
  rangeOf,
  replacesNote,
  shareOf,
  splitWords,
  startOf,
  stillToCome,
  withLink,
  withPayer,
  withoutPayer,
} from './payers.ts';
import { PAYERS_WORDS as W } from './payersWords.ts';
import './payers.css';

interface Sending {
  payerId: string;
  kind: SendKind;
  n: number;
}

const linkWords = (payer: PayerEntry): string =>
  payer.passphrase === true && payer.link !== 'revoked'
    ? `${LINK_WORDS[payer.link]} ${W.asksPassphrase}`
    : LINK_WORDS[payer.link];

const rowLine = (payer: PayerEntry): string =>
  [payer.note, linkWords(payer)].filter((one) => one !== '').join(' · ');

const unsent = (payer: PayerEntry): boolean => payer.link === 'notSent' || payer.link === 'revoked';

/** Who is paying at a desk (sc-91), with sc-1300's Send in the payer's pane; Choose who pays is its own page. */
export function PayersPage({ event, state }: { event: SampleEvent; state: string }) {
  const [params] = useSearchParams();
  const [start] = useState(() => startOf(state, params.get('payer')));
  const [book, setBook] = useState(start.book);
  const [openId, setOpenId] = useState(start.open);
  const [notice, setNotice] = useState<Notice | null>(start.notice);
  const [said, setSaid] = useState(0);
  const [form, setForm] = useState<FormStart | null>(start.form);
  const [send, setSend] = useState<Sending | null>(
    start.send == null ? null : { ...start.send, n: 0 },
  );
  const [choosing, setChoosing] = useState<ChooseStart | null>(start.choose);
  const [toTitle, setToTitle] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const later = useLater();
  const navigate = useNavigate();
  const [washed, setWashed] = useState(state === 'payers_live');
  const link = `${window.location.origin}/demo/share/payer`;

  useEffect(() => {
    if (toTitle > 0) title.current?.focus();
  }, [toTitle]);

  const moved = () => setToTitle((n) => n + 1);
  const open =
    book.payers.find((one) => one.id === openId) ??
    book.payers.find((one) => one.id === openFirst(book.payers));

  function choose(next: ChooseStart): void {
    setNotice(null);
    setChoosing(next);
    moved();
  }

  function chosen(ticked: readonly string[], split: Split | null): void {
    setWashed(false);
    setBook((now) => applyChoice(now, ticked, split));
    setChoosing(null);
    moved();
  }

  function addPressed(): void {
    if (!canAddPayer(book.payers)) {
      setNotice({ kind: 'cap' });
      setSaid((n) => n + 1);

      return;
    }
    setForm({ id: null, name: '', note: '', error: null });
  }

  function confirmForm(
    name: RefObject<HTMLInputElement | null>,
    note: RefObject<HTMLInputElement | null>,
  ): void {
    if (form == null) return;
    const problem = nameProblem(form.name, book.payers, form.id);
    const noteError = noteProblem(form.note);
    if (problem != null || noteError != null) {
      setForm({ ...form, error: problem, noteError });
      (problem != null ? name : note).current?.focus();

      return;
    }
    setWashed(false);
    if (form.id == null) {
      const added = addPayer(book, form.name, form.note);
      setBook(added.book);
      setOpenId(added.id);
    } else setBook(editPayer(book, form.id, form.name, form.note));
    setNotice(null);
    setSend(null);
    setForm(null);
  }

  function removePressed(payer: PayerEntry): void {
    const count = coveredBy(book, payer.id).length;
    if (count > 0) {
      setNotice({ kind: 'refused', payerId: payer.id, count });
      setSaid((n) => n + 1);

      return;
    }
    const next = withoutPayer(book, payer.id);
    setWashed(false);
    setBook(next);
    setNotice({ kind: 'removed', payer, index: book.payers.indexOf(payer) });
    setOpenId(openFirst(next.payers));
    setSend(null);
    moved();
  }

  function undo(payer: PayerEntry, index: number): void {
    setWashed(false);
    setBook((now) => withPayer(now, payer, index));
    setNotice(null);
    moved();
  }

  async function copy(payerId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setSend((now) => ({ payerId, kind: 'copied', n: (now?.n ?? 0) + 1 }));
    } catch {
      setSend((now) => ({ payerId, kind: 'refused', n: (now?.n ?? 0) + 1 }));
    }
  }

  function sendPressed(payer: PayerEntry): void {
    if (send?.payerId === payer.id && send.kind === 'busy') return;
    const share = () =>
      start.shares
        ? setSend((now) => ({ payerId: payer.id, kind: 'shared', n: (now?.n ?? 0) + 1 }))
        : void copy(payer.id);
    if (!unsent(payer)) {
      share();

      return;
    }
    setSend((now) => ({ payerId: payer.id, kind: 'busy', n: now?.n ?? 0 }));
    later(SEND_MS, () => {
      setBook((now) => withLink(now, payer.id, 'sent'));
      share();
    });
  }

  function openPayer(id: string): void {
    setOpenId(id);
    setSend((now) => (now?.kind === 'busy' ? now : null));
  }

  const trail = [
    { label: B.budget, to: budgetAt() },
    { label: choosing == null ? W.title : W.chooseTitle },
  ];

  return (
    <BudgetShell event={event} trail={trail}>
      {() =>
        choosing != null ? (
          <ChooseWhoPays
            book={book}
            start={choosing}
            titleRef={title}
            onDone={chosen}
            onAdd={() => {
              setChoosing(null);
              addPressed();
            }}
          />
        ) : state === 'payers_loading' ? (
          <>
            <PageTitle title={W.title} titleRef={title} />
            <BudgetLoading words={W.loading} />
          </>
        ) : (
          <>
            <PageTitle title={W.title} titleRef={title}>
              <TextAction label={W.addAPayer} before="plus" onClick={addPressed} />
              {book.lines.length > 0 && book.payers.length > 0 && (
                <TextAction
                  label={W.chooseWhoPays}
                  onClick={() => choose({ ticked: [], mode: 'one' })}
                />
              )}
            </PageTitle>
            {washed && <LiveLine words={W.live} />}
            {state === 'payers_not_live' && (
              <NotLiveStrip words={W.notLive} onTry={() => void navigate(budgetAt('payers'))} />
            )}
            {notice?.kind === 'cap' && (
              <p key={said} className="desk-error py-alert" role="alert">
                <Glyph name="alert" size={15} weight={2.2} />
                {W.cap}
              </p>
            )}
            {notice?.kind === 'refused' && (
              <div key={said} className="py-refused">
                <AlertInset>
                  {W.coversCosts(
                    book.payers.find((one) => one.id === notice.payerId)?.name ?? '',
                    notice.count,
                  )}
                </AlertInset>
                <TextAction
                  label={W.chooseWhoPays}
                  onClick={() => choose({ ticked: coveredBy(book, notice.payerId), mode: 'one' })}
                />
              </div>
            )}
            {notice?.kind === 'removed' && (
              <UndoBar
                words={W.removed(notice.payer.name)}
                onUndo={() => undo(notice.payer, notice.index)}
              />
            )}
            {flaggedLines(book).map((line) => (
              <Flag
                key={line.id}
                book={book}
                line={line}
                onChange={() =>
                  choose({
                    ticked: [line.id],
                    mode: 'fixed',
                    ...fixedForm(book.splits[line.id]),
                    checked: true,
                  })
                }
              />
            ))}
            {book.lines.length === 0 ? (
              <>
                <p className="py-empty">{W.noCosts}</p>
                <Link className="desk-text" to={budgetAt()}>
                  <Glyph name="back" size={17} weight={2.3} />
                  {W.budget}
                </Link>
                {book.payers.length > 0 ? (
                  <Rows>
                    {book.payers.map((one) => (
                      <li key={one.id}>
                        <BudgetRow title={one.name} lines={[rowLine(one)]} />
                      </li>
                    ))}
                  </Rows>
                ) : (
                  <>
                    <p className="py-empty">{W.noPayers}</p>
                    <TextAction label={W.addAPayer} before="plus" onClick={addPressed} />
                  </>
                )}
              </>
            ) : open == null ? (
              <>
                <p className="py-empty">{W.noPayers}</p>
                <TextAction label={W.addAPayer} before="plus" onClick={addPressed} />
              </>
            ) : (
              <Columns
                left={
                  <>
                    <PayersCard
                      event={event}
                      book={book}
                      onNext={(id) => choose({ ticked: [id], mode: 'one' })}
                    />
                    <Rows>
                      {book.payers.map((one) => (
                        <li key={one.id}>
                          <BudgetRow
                            title={one.name}
                            lines={[rowLine(one)]}
                            end={<Amount value={moneyRange(...shareOf(book, one.id))} />}
                            lit={one.id === open.id}
                            open={one.id === open.id}
                            washed={washed && (one.id === 'obi' || one.id === 'bakare')}
                            onOpen={() => openPayer(one.id)}
                          />
                        </li>
                      ))}
                    </Rows>
                  </>
                }
                right={
                  <PayerPane
                    book={book}
                    payer={open}
                    paid={start.paidShown ? (paidOf(book, start.payments).get(open.id) ?? 0) : null}
                    send={send?.payerId === open.id ? send : null}
                    link={link}
                    washed={washed}
                    eventName={event.name}
                    onShared={() => {
                      setSend(null);
                      setBook((now) =>
                        now.payers.find((one) => one.id === open.id)?.link === 'notSent'
                          ? withLink(now, open.id, 'sent')
                          : now,
                      );
                    }}
                    onSend={() => sendPressed(open)}
                    onEdit={() =>
                      setForm({ id: open.id, name: open.name, note: open.note, error: null })
                    }
                    onRemove={() => removePressed(open)}
                  />
                }
              />
            )}
            {form != null && (
              <PayerDialog
                form={form}
                onChange={setForm}
                onDismiss={() => setForm(null)}
                onConfirm={confirmForm}
              />
            )}
          </>
        )
      }
    </BudgetShell>
  );
}

function PayersCard({
  event,
  book,
  onNext,
}: {
  event: SampleEvent;
  book: Book;
  onNext: (id: string) => void;
}) {
  const none = noPayer(book);
  const next = nextNoPayer(book);

  return (
    <BudgetCard event={event} label={W.hasAPayer}>
      <GlassTags tags={[{ word: W.payers(book.payers.length) }]} />
      <Figure>{wholeRange(...hasPayer(book))}</Figure>
      <OnCard>
        {W.outOf(wholeRange(...budgetRange(book)), wholeRange(...none.range), none.lines.length)}
      </OnCard>
      {next != null && (
        <>
          <CardStrong>{W.next(next.name)}</CardStrong>
          <div className="bud-card-foot">
            <CardStep label={W.chooseWhoPays} onClick={() => onNext(next.id)} />
          </div>
        </>
      )}
    </BudgetCard>
  );
}

function Flag({ book, line, onChange }: { book: Book; line: CostLine; onChange: () => void }) {
  const words = flagWords(book, line);

  return (
    <div className="py-flag">
      <p className="py-flag-title">{words.title}</p>
      <p className="py-flag-line">{words.line}</p>
      <TextAction label={W.changeTheAmounts} onClick={onChange} />
    </div>
  );
}

function LinkMark({ link }: { link: LinkState }) {
  if (link === 'revoked') return null;
  if (link === 'sent') return <OpenMark />;

  return <Mark kind={link === 'opened' ? 'yes' : 'ended'} />;
}

function PayerPane({
  book,
  payer,
  paid,
  send,
  link,
  washed,
  eventName,
  onSend,
  onShared,
  onEdit,
  onRemove,
}: {
  book: Book;
  payer: PayerEntry;
  paid: number | null;
  send: Sending | null;
  link: string;
  washed: boolean;
  eventName: string;
  onSend: () => void;
  onShared: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const head = useId();
  const share = shareOf(book, payer.id);
  const still = paid == null ? null : stillToCome(share, paid);
  const covers = coversOf(book, payer.id);
  const notPriced = notPricedFor(book, payer.id);
  const kind = send?.kind ?? null;
  const busy = kind === 'busy';
  const first = unsent(payer);
  const moved = washed && (payer.id === 'obi' || payer.id === 'bakare');

  return (
    <Pane label={payer.name}>
      <h2 className="py-name">{payer.name}</h2>
      {payer.note !== '' && <p className="py-note">{payer.note}</p>}
      <Rows>
        <li>
          <BudgetRow
            title={W.theirShare}
            lines={[
              share[0] === share[1] ? W.fixedShare : B.rangeLine,
              ...(notPriced > 0 ? [B.notPricedCount(notPriced)] : []),
            ]}
            end={<Amount value={moneyRange(...share)} />}
            washed={moved}
          />
        </li>
        {paid != null && still != null && (
          <>
            <li>
              <BudgetRow title={W.paid} end={<Amount value={money(paid)} />} />
            </li>
            <li>
              <BudgetRow
                title={W.stillToCome}
                end={
                  <Amount
                    value={still[1] === 0 ? W.nothingStillToCome : moneyRange(still[0], still[1])}
                  />
                }
              />
            </li>
          </>
        )}
      </Rows>
      {covers.length > 0 && (
        <section className="desk-block" aria-labelledby={head}>
          <Head title={<span id={head}>{W.covers}</span>} level={3} />
          <Rows>
            {covers.map((one) => (
              <li key={one.lineId}>
                <BudgetRow
                  title={one.name}
                  lines={[one.how]}
                  end={<Amount value={one.notPriced ? B.notPriced : moneyRange(...one.part)} />}
                />
              </li>
            ))}
          </Rows>
        </section>
      )}
      <div className="py-send-foot">
        <div className="py-said" role="status">
          {kind === 'copied' && (
            <p className="py-copied">
              <Glyph name="tick" size={15} weight={2.6} />
              {W.linkCopied}
            </p>
          )}
        </div>
        {kind === 'failed' && (
          <p className="desk-error py-alert" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {W.notCreated}
          </p>
        )}
        {kind === 'refused' && <LinkField key={send?.n} link={link} />}
        {kind !== 'failed' && kind !== 'refused' && payer.link !== 'revoked' && (
          <p className="py-link">
            <span className="py-link-mark">
              <LinkMark link={payer.link} />
            </span>
            {linkWords(payer)}
          </p>
        )}
        <button
          type="button"
          className={busy ? 'py-send is-busy' : 'py-send'}
          aria-label={busy || first ? undefined : W.sendAgainTo(payer.name)}
          aria-busy={busy || undefined}
          {...offButton(busy, { dim: false })}
          onClick={onSend}
        >
          {busy ? W.sending : first ? W.sendTo(payer.name) : W.sendAgain}
        </button>
      </div>
      <div className="py-actions">
        <TextAction label={W.edit} onClick={onEdit} />
        <TextAction label={W.remove} red onClick={onRemove} />
      </div>
      {kind === 'shared' && (
        <BudgetDialog
          title={W.browserSheet}
          verb={W.close}
          cancel={false}
          onDismiss={onShared}
          onConfirm={onShared}
        >
          <p className="desk-line is-ink">{W.message(eventName)}</p>
          <p className="desk-line py-shared-link">{link}</p>
        </BudgetDialog>
      )}
    </Pane>
  );
}

function LinkField({ link }: { link: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {W.theLink}
      </label>
      <div className="desk-box">
        <input
          ref={input}
          id={id}
          type="text"
          value={link}
          readOnly
          spellCheck={false}
          aria-describedby={`${id}-line`}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <p id={`${id}-line`} className="py-refused-line">
        {W.copyRefused}
      </p>
    </div>
  );
}

function PayerDialog({
  form,
  onChange,
  onDismiss,
  onConfirm,
}: {
  form: FormStart;
  onChange: (form: FormStart) => void;
  onDismiss: () => void;
  onConfirm: (
    name: RefObject<HTMLInputElement | null>,
    note: RefObject<HTMLInputElement | null>,
  ) => void;
}) {
  const name = useRef<HTMLInputElement>(null);
  const note = useRef<HTMLInputElement>(null);
  const wrong = [form.error, form.noteError].filter((one) => one != null).length;

  return (
    <BudgetDialog
      title={form.id == null ? W.addTitle : W.editTitle}
      verb={form.id == null ? W.add : W.save}
      first={form.error == null && form.noteError != null ? note : name}
      onDismiss={onDismiss}
      onConfirm={() => onConfirm(name, note)}
    >
      {wrong > 0 && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {fieldsWrong(wrong)}
        </p>
      )}
      <div className="desk-fields">
        <Field
          label={W.name}
          value={form.name}
          inputRef={name}
          error={form.error}
          autoComplete="off"
          onChange={(value) => onChange({ ...form, name: value, error: null })}
        />
        <Field
          label={W.note}
          value={form.note}
          help={W.noteHelp}
          error={form.noteError ?? null}
          inputRef={note}
          autoComplete="off"
          onChange={(value) =>
            onChange({
              ...form,
              note: value,
              noteError: form.noteError == null ? null : noteProblem(value),
            })
          }
        />
      </div>
    </BudgetDialog>
  );
}

const amountWords = (line: CostLine): string => {
  const state = lineState(line);

  return state === 'notPriced'
    ? B.notPriced
    : state === 'nothingYet'
      ? B.nothingYet
      : moneyRange(...rangeOf(line));
};

function ChooseWhoPays({
  book,
  start,
  titleRef,
  onDone,
  onAdd,
}: {
  book: Book;
  start: ChooseStart;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onDone: (ticked: readonly string[], split: Split | null) => void;
  onAdd: () => void;
}) {
  const [ticked, setTicked] = useState<readonly string[]>(start.ticked);
  const [mode, setMode] = useState<Mode>(start.mode);
  const [payer, setPayer] = useState(start.payer ?? '');
  const [percents, setPercents] = useState<Record<string, string>>({ ...start.percents });
  const [amounts, setAmounts] = useState<Record<string, string>>({ ...start.amounts });
  const [rest, setRest] = useState(start.rest ?? '');
  const [checked, setChecked] = useState(start.checked === true);
  const [stale, setStale] = useState(start.stale ?? null);
  const [tries, setTries] = useState(start.checked === true ? 1 : 0);
  const who = useRef<HTMLDivElement>(null);
  const radios = useId();
  const totalError = useId();

  useEffect(() => {
    if (tries > 0) who.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [tries]);

  const choices = choicesFor(ticked.length);
  const picked = choices.includes(mode) ? mode : 'one';
  const percent = checkPercents(book, ticked, percents);
  const fixed = checkFixed(book, ticked[0] ?? '', amounts, rest);
  const note = replacesNote(book, ticked);
  const off = ticked.length === 0;
  const percentWrong = checked && percent.error != null && Object.keys(percent.fields).length === 0;
  const payerError = checked && picked === 'one' && payer === '' ? W.choosePayer : null;
  const restError = checked && picked === 'fixed' && rest === '' ? W.chooseRest : null;

  function save(): void {
    if (off) return;
    setStale(null);
    const split: Split | null =
      picked === 'one'
        ? payer === ''
          ? null
          : { kind: 'one', payerId: payer }
        : picked === 'percent'
          ? percent.split
          : rest === ''
            ? null
            : fixed.split;
    if (split == null) {
      setChecked(true);
      setTries((n) => n + 1);

      return;
    }
    onDone(ticked, split);
  }

  return (
    <>
      <PageTitle title={W.chooseTitle} titleRef={titleRef} />
      {stale != null && <AlertInset>{W.stale(stale)}</AlertInset>}
      <div className="py-choose">
        <section className="py-choose-side" aria-label={B.costs}>
          <TextAction
            label={W.selectNoPayer}
            onClick={() => setTicked(noPayer(book).lines.map((line) => line.id))}
          />
          <ul className="desk-rows">
            {inBudgetOrder(book.lines).map((line) => (
              <li key={line.id}>
                <label className="desk-row py-pick">
                  <input
                    type="checkbox"
                    className="py-check"
                    checked={ticked.includes(line.id)}
                    onChange={() =>
                      setTicked((now) =>
                        now.includes(line.id)
                          ? now.filter((id) => id !== line.id)
                          : [...now, line.id],
                      )
                    }
                  />
                  <RowWords
                    title={line.name}
                    lines={[`${amountWords(line)} · ${splitWords(book, line)}`]}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
        <div ref={who} className="py-choose-side">
          {book.payers.length === 0 ? (
            <TextAction label={W.addAPayer} before="plus" onClick={onAdd} />
          ) : (
            <>
              {note != null && <InfoLine>{note}</InfoLine>}
              <fieldset className="py-choices">
                <legend className="py-legend">{W.whoPays}</legend>
                <ul className="desk-rows">
                  {choices.map((choice) => (
                    <li key={choice}>
                      <label className="desk-row py-pick">
                        <input
                          type="radio"
                          className="desk-radio"
                          name={radios}
                          checked={choice === picked}
                          onChange={() => setMode(choice)}
                        />
                        <RowWords title={W[choice]} />
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              {picked === 'one' && (
                <PickField
                  label={W.payer}
                  value={payer}
                  payers={book.payers}
                  error={payerError}
                  onChange={setPayer}
                />
              )}
              {picked === 'percent' && (
                <>
                  {book.payers.map((one) => {
                    const part = percent.parts.get(one.id);
                    const typed = (percents[one.id] ?? '').trim();

                    return (
                      <PercentField
                        key={one.id}
                        label={W.percentLabel(one.name)}
                        value={percents[one.id] ?? ''}
                        help={
                          part == null ||
                          typed === '' ||
                          Number(typed) === 0 ||
                          percentProblem(typed) != null
                            ? null
                            : moneyRange(...part)
                        }
                        errorId={percentWrong ? totalError : null}
                        error={checked ? (percent.fields[one.id] ?? null) : null}
                        onChange={(value) => {
                          if (PERCENT_TYPED.test(value))
                            setPercents((now) => ({ ...now, [one.id]: value }));
                        }}
                      />
                    );
                  })}
                  <p className={percentWrong ? 'py-total is-wrong' : 'py-total'}>
                    {W.total(percentText(percent.total))}
                  </p>
                  {percentWrong && (
                    <p id={totalError} className="desk-error py-alert">
                      <Glyph name="alert" size={15} weight={2.2} />
                      {percent.error}
                    </p>
                  )}
                </>
              )}
              {picked === 'fixed' && (
                <>
                  {book.payers
                    .filter((one) => one.id !== rest)
                    .map((one) => (
                      <MoneyField
                        key={one.id}
                        label={W.amountLabel(one.name)}
                        value={amounts[one.id] ?? ''}
                        error={checked ? (fixed.errors[one.id] ?? null) : null}
                        onChange={(value) => setAmounts((now) => ({ ...now, [one.id]: value }))}
                      />
                    ))}
                  <PickField
                    label={W.whoCoversTheRest}
                    value={rest}
                    payers={book.payers}
                    help={W.restNow(moneyRange(...fixed.rest))}
                    error={restError}
                    onChange={setRest}
                  />
                </>
              )}
              <div className="py-actions">
                <button
                  type="button"
                  className={off ? 'desk-text py-leave is-off' : 'desk-text py-leave'}
                  {...offButton(off, { dim: false })}
                  onClick={() => onDone(ticked, null)}
                >
                  {W.leave}
                </button>
                <button
                  type="button"
                  className={off ? 'desk-text is-off' : 'desk-text'}
                  {...offButton(off, { dim: false })}
                  onClick={save}
                >
                  {W.save}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PickField({
  label,
  value,
  payers,
  help,
  error = null,
  onChange,
}: {
  label: string;
  value: string;
  payers: readonly PayerEntry[];
  help?: string;
  error?: string | null;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box ev-select' : 'desk-box ev-select is-wrong'}>
        <select
          id={id}
          value={value}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        >
          {value === '' && <option value="">{W.choosePayerOption}</option>}
          {payers.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </select>
        <Glyph name="chevdown" size={18} weight={2.3} />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

function PercentField({
  label,
  value,
  help,
  errorId,
  error = null,
  onChange,
}: {
  label: string;
  value: string;
  help: string | null;
  errorId: string | null;
  error?: string | null;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const told = [help == null ? null : `${id}-help`, errorId, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          spellCheck={false}
          aria-invalid={errorId != null || error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help py-figure">
          {help}
        </p>
      )}
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}
