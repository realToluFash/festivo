import { formattingLocale } from '@soirely/domain';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Glyph } from './Glyph.tsx';
import type { Load } from './members.ts';
import { type HeldStep, heldStepPath } from './security.ts';
import type { Viewer } from './settings.ts';
import {
  Ask,
  Card,
  CardStep,
  Choices,
  Dialog,
  Head,
  Note,
  OnCard,
  RowWords,
  Says,
  Tag,
  TextAction,
  TitleRow,
} from './SettingsParts.tsx';
import {
  type ChangeRow,
  EDIT_TITLES,
  EMAIL_NOTE,
  type Edit,
  LIMIT_INTRO,
  MARK_WORD,
  type Mark,
  REFUSALS,
  type RuleRow,
  type RulesPage,
  applied,
  changeRows,
  changedFoot,
  changesBetween,
  choicesOf,
  effectsOf,
  holdOf,
  inForce,
  refusalOf,
  roleOf,
  rulesCard,
  signInRulesStart,
  standFoot,
  staysLine,
  whereYouStand,
} from './signInRules.ts';
import type { Tell } from './TodayParts.tsx';
import './signInRules.css';

const RETRY_MS = 1200;

function wallClock(at: Date): string {
  const two = (value: number) => String(value).padStart(2, '0');

  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}T${two(at.getHours())}:${two(at.getMinutes())}`;
}

/** Sign-in rules at a desk in B · Where you stand (Web-SignInRules-*.dc.html): owners and admins change a rule from its row. */
export function SignInRules({
  viewer,
  state,
  tell,
}: {
  viewer: Viewer;
  state: string;
  tell: Tell;
}) {
  const navigate = useNavigate();
  const locale = useMemo(() => formattingLocale('en', navigator.language), []);
  const [now] = useState(() => wallClock(new Date()));
  const [start] = useState(() => signInRulesStart(state, viewer.name, now));
  const [load, setLoad] = useState<Load | 'retrying'>(start.load);
  const [page, setPage] = useState(start.page);
  const [edit, setEdit] = useState<Edit | null>(start.edit);
  const thisYear = Number(now.slice(0, 4));

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  if (load !== 'loaded')
    return (
      <Page>
        <TitleRow title="Sign-in rules" tell={tell} />
        {load === 'failed' ? <Failed onRetry={() => setLoad('retrying')} /> : <Loading />}
      </Page>
    );

  const role = roleOf(viewer);
  const hold = holdOf(page, role);
  const rows = whereYouStand(page, role, locale, thisYear);
  const card = rulesCard(rows, role, hold);
  const changedFootLine = changedFoot(hold);
  const standFootLine = standFoot(page);
  const toSecurity = (step: HeldStep | null) => {
    if (step != null) void navigate(heldStepPath(step, viewer));
  };
  const save = (next: Edit) => {
    const after = { ...page, ...applied(next.key, next.picked, page) };
    const moved = changesBetween(page, after, wallClock(new Date()), viewer.name);

    setPage({ ...after, seen: moved[0]?.at ?? page.seen, changes: [...moved, ...page.changes] });
    setEdit(null);
  };

  return (
    <Page>
      <TitleRow title="Sign-in rules" tell={tell} />
      <Card>
        <Says>{card.says}</Says>
        <OnCard>{card.line}</OnCard>
        {card.step != null && (
          <CardStep label={card.step.label} onClick={() => toSecurity(card.step)} />
        )}
      </Card>
      <section className="desk-block">
        <Head title="Where you stand" />
        <ul className="desk-rows signin-rows">
          {rows.map((rule) => (
            <li key={rule.key}>
              {hold == null ? (
                <button
                  type="button"
                  className="desk-row"
                  onClick={() =>
                    setEdit({ key: rule.key, picked: inForce(rule.key, page), ask: false })
                  }
                >
                  <RuleWords rule={rule} />
                  <span className="signin-change">Change</span>
                </button>
              ) : (
                <div className="desk-row">
                  <RuleWords rule={rule} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {standFootLine != null && <p className="desk-foot">{standFootLine}</p>}
      </section>
      <section className="desk-block">
        <Head title="What changed" />
        <Changes changes={changeRows(page.changes, page.seen, locale, thisYear)} />
        {changedFootLine != null && <p className="desk-foot">{changedFootLine}</p>}
      </section>
      {edit != null && hold == null && (
        <EditDialog
          edit={edit}
          page={page}
          onStep={toSecurity}
          onEdit={setEdit}
          onClose={() => setEdit(null)}
          onSave={save}
        />
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

/** The mark, its word for a screen reader, the rule in a few words and one line about you. */
function RuleWords({ rule }: { rule: RuleRow }) {
  return (
    <>
      <RuleMark mark={rule.mark} />
      <span className="desk-unseen">{MARK_WORD[rule.mark]} </span>
      <RowWords title={rule.title} lines={[rule.line]} />
    </>
  );
}

/** Met is the green tick, needs you the amber half disc, and doesn't apply a grey disc with a bar. */
function RuleMark({ mark }: { mark: Mark }) {
  return (
    <span
      className={`signin-mark is-${mark === 'notApplicable' ? 'not-applicable' : mark}`}
      aria-hidden="true"
    >
      {mark === 'met' && <Glyph name="tick" size={13} weight={3.2} />}
      {mark === 'notApplicable' && <span />}
    </span>
  );
}

function Changes({ changes }: { changes: readonly ChangeRow[] }) {
  if (changes.length === 0)
    return (
      <ul className="desk-rows">
        <li className="desk-row">
          <RowWords
            title="No changes yet"
            lines={['These are the rules every organisation starts with.']}
          />
        </li>
      </ul>
    );

  return (
    <ul className="desk-rows">
      {changes.map((change) => (
        <li key={change.key} className="desk-row">
          <RowWords
            title={change.title}
            tag={change.isNew && <Tag kind="now" word="New" />}
            lines={[change.line]}
          />
        </li>
      ))}
    </ul>
  );
}

/** One rule's choices, what saving does, and nothing saved before the verb. */
function EditDialog({
  edit,
  page,
  onStep,
  onEdit,
  onClose,
  onSave,
}: {
  edit: Edit;
  page: RulesPage;
  onStep: (step: HeldStep) => void;
  onEdit: (edit: Edit) => void;
  onClose: () => void;
  onSave: (edit: Edit) => void;
}) {
  const none = useRef<HTMLElement>(null);
  const changed = edit.picked !== inForce(edit.key, page);
  const refusal = refusalOf(edit.key, edit.picked, page);
  const refused = refusal == null ? null : REFUSALS[refusal];

  return (
    <>
      <Dialog
        title={EDIT_TITLES[edit.key]}
        verb="Save"
        on={changed && refusal == null}
        first={none}
        onDismiss={() => (changed ? onEdit({ ...edit, ask: true }) : onClose())}
        onConfirm={() => onSave(edit)}
      >
        {edit.key === 'limit' && <Note>{LIMIT_INTRO}</Note>}
        <Choices
          legend={EDIT_TITLES[edit.key]}
          hideLegend
          choices={choicesOf(edit.key, page)}
          picked={edit.picked}
          onPick={(picked) => onEdit({ ...edit, picked })}
        />
        {refused == null ? (
          <div className="desk-after">
            <Head title="What happens when you save" level={3} />
            {effectsOf(page, applied(edit.key, edit.picked, page), page.passwordOnly).map(
              (line) => (
                <p key={line} className="desk-line">
                  {line}
                </p>
              ),
            )}
            {changed && <p className="desk-foot">{EMAIL_NOTE}</p>}
          </div>
        ) : (
          <div className="signin-refusal" role="alert">
            <Glyph name="alert" size={20} weight={2.2} />
            <div className="desk-after">
              <p className="desk-empty-title">{refused.title}</p>
              <p className="desk-line">{refused.line}</p>
              <TextAction label={refused.step.label} onClick={() => onStep(refused.step)} />
            </div>
          </div>
        )}
      </Dialog>
      {edit.ask && (
        <Ask
          title="Discard your change?"
          line={staysLine(edit.key, page)}
          keep="Keep editing"
          go="Discard"
          onKeep={() => onEdit({ ...edit, ask: false })}
          onGo={onClose}
        />
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="desk-loading" role="status" aria-label="Loading the sign-in rules…">
      <span className="desk-unseen">Loading the sign-in rules…</span>
      <span className="desk-sunk is-card" aria-hidden="true" />
      <ul className="desk-rows signin-rows" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <li key={bar} className="desk-row is-bones">
            <span className="desk-sunk signin-mark" />
            <span className="desk-row-words">
              <span className={`desk-sunk is-title b${bar}`} />
              <span className={`desk-sunk is-line b${bar}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="desk-failed" role="alert">
      <h2>We could not load the sign-in rules.</h2>
      <p className="desk-line">Check your connection and try again.</p>
      <TextAction label="Try again" onClick={onRetry} />
    </div>
  );
}
