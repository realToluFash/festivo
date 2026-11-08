import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Head, Tag, TextAction } from '../components/SettingsParts.tsx';
import {
  AskInRow,
  BudgetRow,
  BudgetShell,
  Columns,
  PageTitle,
  Pane,
  Rows,
} from './BudgetParts.tsx';
import { PAYERS, budgetAt, viewerOf } from './budgetSample.ts';
import { type SampleEvent } from './events.ts';
import {
  BLANK_DRAFT,
  type Desk,
  type Draft,
  type DraftField,
  SCOPES,
  type ShareLink,
  deskStart,
  draftProblems,
  ended,
  linkLine,
  linkOf,
  shareCategories,
  titleInSentence,
  titleOf,
} from './share.ts';
import { SHARE_WORDS as W } from './shareWords.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';
import './share.css';

const FIELDS: readonly DraftField[] = ['category', 'payer', 'endsOn', 'passphrase'];
const REFUSED = new Set([
  'no_category',
  'no_payer',
  'past_date',
  'short_passphrase',
  'long_passphrase',
]);

/** On Budget, Share (sc-94): the event's links as rows at the left, Create a link in place at the right. */
export function SharePage({ event, state }: { event: SampleEvent; state: string }) {
  const [params] = useSearchParams();
  const viewer = viewerOf(params.get('as'));

  return (
    <BudgetShell event={event} trail={[{ label: W.budget, to: budgetAt() }, { label: W.share }]}>
      {() => <Links state={state} by={viewer.name} />}
    </BudgetShell>
  );
}

type Copy = 'copied' | 'refused' | null;

function Links({ state, by }: { state: string; by: string }) {
  const [desk, setDesk] = useState<Desk>(() => deskStart(state));
  const [copy, setCopy] = useState<Copy>(null);
  const [want, setWant] = useState<{ at: string; n: number } | null>(() =>
    REFUSED.has(state)
      ? { at: firstWrong(desk.problems), n: 0 }
      : state === 'created'
        ? { at: 'created', n: 0 }
        : null,
  );
  const page = useRef<HTMLDivElement>(null);
  const made = useRef(0);
  const ids = useId();

  useEffect(() => {
    if (want == null) return;
    const to = page.current?.querySelector<HTMLElement>(`[data-focus="${want.at}"]`);
    to?.focus();
    if (want.at === 'link' && to instanceof HTMLInputElement) to.select();
  }, [want]);

  const focus = (at: string) => setWant((was) => ({ at, n: (was?.n ?? 0) + 1 }));
  const change = (draft: Partial<Draft>) =>
    setDesk((was) => {
      const next = { ...was.draft, ...draft };
      const still = draftProblems(next);
      const problems = Object.fromEntries(
        Object.entries(was.problems).filter(([field]) => still[field as DraftField] != null),
      );

      return { ...was, draft: next, problems };
    });

  function create(event: FormEvent): void {
    event.preventDefault();
    const problems = draftProblems(desk.draft);

    if (Object.keys(problems).length > 0) {
      setDesk((was) => ({ ...was, problems }));
      focus(firstWrong(problems));
      return;
    }

    made.current += 1;
    const one = linkOf(desk.draft, `made-${made.current}`, by);
    setDesk((was) => ({
      ...was,
      links: [one, ...was.links],
      draft: BLANK_DRAFT,
      problems: {},
      created: one.id,
    }));
    setCopy(null);
    focus('created');
  }

  function startOver(): void {
    if (desk.created != null) {
      setDesk((was) => ({ ...was, created: null, draft: BLANK_DRAFT, problems: {} }));
      setCopy(null);
    }
    focus('scope');
  }

  const created = desk.links.find((one) => one.id === desk.created) ?? null;

  return (
    <div ref={page} className="share">
      <PageTitle title={W.share}>
        <TextAction label={W.createALink} before="plus" onClick={startOver} />
      </PageTitle>
      <p className="desk-line">{W.intro}</p>
      <Columns
        left={
          desk.links.length === 0 ? (
            <p className="share-none">{W.noLinks}</p>
          ) : (
            <Rows>
              {desk.links.map((one) => (
                <LinkRow
                  key={one.id}
                  one={one}
                  lit={one.id === desk.created}
                  asking={desk.asking === one.id}
                  onAsk={() => setDesk((was) => ({ ...was, asking: one.id }))}
                  onKeep={() => {
                    setDesk((was) => ({ ...was, asking: null }));
                    focus(`revoke-${one.id}`);
                  }}
                  onRevoke={() => {
                    setDesk((was) => ({
                      ...was,
                      asking: null,
                      links: was.links.map((each) =>
                        each.id === one.id ? { ...each, revoked: true } : each,
                      ),
                    }));
                    focus(`row-${one.id}`);
                  }}
                />
              ))}
            </Rows>
          )
        }
        right={
          created == null ? (
            <Pane label={W.createALink}>
              <CreateForm
                id={ids}
                draft={desk.draft}
                problems={desk.problems}
                onChange={change}
                onCreate={create}
              />
            </Pane>
          ) : (
            <Pane label={W.linkCreated}>
              <Created
                one={created}
                copy={copy}
                onCopy={() => {
                  const done = () => setCopy('copied');
                  const refused = () => {
                    setCopy('refused');
                    focus('link');
                  };
                  if (navigator.clipboard == null) refused();
                  else navigator.clipboard.writeText(created.url).then(done, refused);
                }}
                onDone={() => {
                  setDesk((was) => ({ ...was, created: null }));
                  setCopy(null);
                  focus(`row-${created.id}`);
                }}
              />
            </Pane>
          )
        }
      />
    </div>
  );
}

function firstWrong(problems: Partial<Record<DraftField, string>>): string {
  return FIELDS.find((field) => problems[field] != null) ?? 'scope';
}

function LinkRow({
  one,
  lit,
  asking,
  onAsk,
  onKeep,
  onRevoke,
}: {
  one: ShareLink;
  lit: boolean;
  asking: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onRevoke: () => void;
}) {
  const live = !ended(one);

  return (
    <li className="share-row" tabIndex={-1} data-focus={`row-${one.id}`}>
      <BudgetRow
        title={titleOf(one)}
        tag={<Tag kind={live ? 'yes' : 'ended'} word={live ? W.live : W.ended} />}
        lines={[linkLine(one)]}
        lit={lit}
        end={
          live && !asking ? (
            <button
              type="button"
              className="desk-text is-red"
              data-focus={`revoke-${one.id}`}
              onClick={onAsk}
            >
              {W.revoke}
            </button>
          ) : undefined
        }
      />
      {asking && (
        <AskInRow
          question={W.revokeAsk(titleInSentence(one))}
          keep={W.keep}
          go={W.revoke}
          onKeep={onKeep}
          onGo={onRevoke}
        />
      )}
    </li>
  );
}

function described(id: string, help: boolean, error: string | undefined): string | undefined {
  const told = [help ? `${id}-help` : null, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return told === '' ? undefined : told;
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>{children}</div>
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

function CreateForm({
  id,
  draft,
  problems,
  onChange,
  onCreate,
}: {
  id: string;
  draft: Draft;
  problems: Partial<Record<DraftField, string>>;
  onChange: (draft: Partial<Draft>) => void;
  onCreate: (event: FormEvent) => void;
}) {
  const at = (field: string) => `${id}-${field}`;

  return (
    <form className="share-form" noValidate onSubmit={onCreate}>
      <Head title={W.createALink} />
      <fieldset className="share-scopes">
        <legend className="share-caps">{W.whatItShows}</legend>
        <ul className="desk-rows">
          {SCOPES.map((scope) => (
            <li key={scope}>
              <label className="desk-row share-scope">
                <input
                  type="radio"
                  className="desk-radio"
                  name={at('scope')}
                  checked={draft.scope === scope}
                  data-focus={draft.scope === scope ? 'scope' : undefined}
                  onChange={() => onChange({ scope })}
                />
                <span className="desk-row-name">{W.scope[scope]}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {draft.scope === 'category' && (
        <Field id={at('category')} label={W.category} error={problems.category}>
          <select
            id={at('category')}
            value={draft.category}
            data-focus="category"
            aria-invalid={problems.category != null}
            aria-describedby={described(at('category'), false, problems.category)}
            onChange={(event) => onChange({ category: event.target.value as Draft['category'] })}
          >
            <option value="">{W.chooseCategory}</option>
            {shareCategories().map((category) => (
              <option key={category} value={category}>
                {CATEGORY_WORDS[category]}
              </option>
            ))}
          </select>
          <Glyph name="chevdown" size={16} weight={2.2} className="share-chev" />
        </Field>
      )}
      {draft.scope === 'payer' && (
        <Field id={at('payer')} label={W.payer} error={problems.payer}>
          <select
            id={at('payer')}
            value={draft.payer}
            data-focus="payer"
            aria-invalid={problems.payer != null}
            aria-describedby={described(at('payer'), false, problems.payer)}
            onChange={(event) => onChange({ payer: event.target.value })}
          >
            {draft.payer === '' && <option value="">{W.choosePayer}</option>}
            {PAYERS.map((payer) => (
              <option key={payer.id} value={payer.id}>
                {payer.name}
              </option>
            ))}
          </select>
          <Glyph name="chevdown" size={16} weight={2.2} className="share-chev" />
        </Field>
      )}
      <Field id={at('ends')} label={W.endsOn} help={W.endsOnHelp} error={problems.endsOn}>
        <input
          id={at('ends')}
          type="date"
          value={draft.endsOn}
          data-focus="endsOn"
          aria-invalid={problems.endsOn != null}
          aria-describedby={described(at('ends'), true, problems.endsOn)}
          onChange={(event) => onChange({ endsOn: event.target.value })}
        />
      </Field>
      <Field
        id={at('passphrase')}
        label={W.passphraseOptional}
        help={W.passphraseHelp}
        error={problems.passphrase}
      >
        <input
          id={at('passphrase')}
          type="password"
          value={draft.passphrase}
          autoComplete="new-password"
          spellCheck={false}
          data-focus="passphrase"
          aria-invalid={problems.passphrase != null}
          aria-describedby={described(at('passphrase'), true, problems.passphrase)}
          onChange={(event) => onChange({ passphrase: event.target.value })}
        />
      </Field>
      <button type="submit" className="share-primary">
        {W.createALink}
      </button>
    </form>
  );
}

function Created({
  one,
  copy,
  onCopy,
  onDone,
}: {
  one: ShareLink;
  copy: Copy;
  onCopy: () => void;
  onDone: () => void;
}) {
  const id = useId();

  return (
    <div className="share-created">
      <div className="desk-head">
        <h2 tabIndex={-1} data-focus="created">
          {W.linkCreated}
        </h2>
      </div>
      <p className="desk-line">{W.createdLine(titleOf(one))}</p>
      <div className="desk-field share-link">
        <label htmlFor={id} className="desk-label">
          {W.theLink}
        </label>
        <div className="desk-box">
          <input
            id={id}
            type="text"
            readOnly
            value={one.url}
            data-focus="link"
            aria-describedby={copy === 'refused' ? `${id}-refused` : undefined}
          />
        </div>
      </div>
      <div className="share-actions">
        <TextAction label={W.copyTheLink} before="copy" onClick={onCopy} />
        <button type="button" className="desk-text share-quiet" onClick={onDone}>
          {W.done}
        </button>
      </div>
      <div role="status">
        {copy === 'copied' && (
          <p className="share-copied">
            <Glyph name="tick" size={15} weight={2.6} />
            {W.copied}
          </p>
        )}
        {copy === 'refused' && (
          <p id={`${id}-refused`} className="share-copied is-ink">
            {W.copyRefused}
          </p>
        )}
      </div>
    </div>
  );
}
