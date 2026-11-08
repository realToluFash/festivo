import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Chevron, Head, RowWords, TextAction } from '../components/SettingsParts.tsx';
import {
  Amount,
  BudgetDialog,
  BudgetLoading,
  BudgetRow,
  BudgetShell,
  Columns,
  DashedMark,
  MarkWord,
  PageTitle,
  Pane,
  Rows,
} from './BudgetParts.tsx';
import { budgetAt } from './budgetSample.ts';
import { BUDGET_WORDS } from './budgetWords.ts';
import { type SampleEvent } from './events.ts';
import {
  COSTS_KEPT,
  CURRENCY_HEADS,
  type CalibrationKind,
  type CurrencyBlock,
  type NameProblem,
  SOURCES,
  type SaveStart,
  type Source,
  type SourceId,
  calibrationBlocks,
  calibrationOf,
  learnedRow,
  nameProblem,
  nameTaken,
  previewOf,
  sourceLine,
  sourceOf,
  startName,
  vendorPaid,
} from './templates.ts';
import { TEMPLATES_WORDS as W } from './templatesWords.ts';
import './templates.css';

const SEND_MS = 900;

/** sc-96 at a desk: Start from an earlier budget, and Calibration. Save as template opens on Budget. */
export function TemplatesPage({ event, state }: { event: SampleEvent; state: string }) {
  const calibrating = state.startsWith('calibration');
  const title = calibrating ? W.calibrationTitle : W.startTitle;

  return (
    <BudgetShell
      event={event}
      trail={[{ label: BUDGET_WORDS.budget, to: budgetAt() }, { label: title }]}
    >
      {() =>
        calibrating ? (
          <Calibration first={calibrationOf(state)} />
        ) : (
          <StartFrom
            first={sourceOf(state)}
            typeless={state === 'start_no_type'}
            margin={state === 'start_margin'}
          />
        )
      }
    </BudgetShell>
  );
}

function StartFrom({
  first,
  typeless = false,
  margin = false,
}: {
  first: SourceId;
  typeless?: boolean;
  margin?: boolean;
}) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<SourceId>(first);
  const source = SOURCES.find((one) => one.id === picked);
  const preview = previewOf(picked, margin);
  const groups = typeless
    ? [
        {
          name: null,
          sources: SOURCES.filter((one) => !one.template).sort((a, b) =>
            (b.on ?? '').localeCompare(a.on ?? ''),
          ),
        },
        { name: W.templates, sources: SOURCES.filter((one) => one.template) },
      ]
    : [
        { name: W.weddings, sources: SOURCES.filter((one) => one.wedding) },
        { name: W.otherEvents, sources: SOURCES.filter((one) => !one.wedding) },
      ];

  return (
    <>
      <PageTitle title={W.startTitle} />
      <Columns
        left={
          <>
            <p className="tpl-intro">{W.startLine}</p>
            {typeless && <p className="tpl-intro">{W.noType}</p>}
            {groups.map((group) => (
              <SourceGroup
                key={group.name ?? 'events'}
                name={group.name}
                sources={group.sources}
                picked={picked}
                onPick={setPicked}
              />
            ))}
            <TextAction label={W.startEmpty} onClick={() => navigate(budgetAt('first_time'))} />
          </>
        }
        right={
          <Pane label={source?.name ?? ''}>
            <h2 className="tpl-preview-title">{source?.name}</h2>
            <p className="tpl-preview-line">{preview.line}</p>
            <Rows>
              {preview.rows.map((row) => (
                <li key={row.name}>
                  <BudgetRow
                    title={row.name}
                    lines={[row.line]}
                    end={
                      row.value == null ? (
                        <MarkWord mark={<DashedMark />} word={BUDGET_WORDS.notPriced} />
                      ) : (
                        <Amount value={row.value} />
                      )
                    }
                  />
                </li>
              ))}
            </Rows>
            <button type="button" className="tpl-primary" onClick={() => navigate(budgetAt())}>
              {W.startFromThis}
            </button>
          </Pane>
        }
      />
    </>
  );
}

function SourceGroup({
  name,
  sources,
  picked,
  onPick,
}: {
  name: string | null;
  sources: readonly Source[];
  picked: SourceId;
  onPick: (id: SourceId) => void;
}) {
  const id = useId();

  return (
    <section
      className="tpl-group"
      {...(name == null ? { 'aria-label': W.startTitle } : { 'aria-labelledby': id })}
    >
      {name != null && (
        <h2 id={id} className="tpl-caps">
          {name}
        </h2>
      )}
      <ul className="desk-rows bud-rows">
        {sources.map((source) => (
          <li key={source.id}>
            <button
              type="button"
              className={source.id === picked ? 'desk-row bud-row is-on' : 'desk-row bud-row'}
              aria-current={source.id === picked ? 'true' : undefined}
              onClick={() => onPick(source.id)}
            >
              <span className="bud-lead tpl-lead">
                {source.template ? <TemplateMark /> : <Glyph name="calendar" size={20} />}
              </span>
              <RowWords title={source.name} lines={[sourceLine(source)]} />
              <Chevron />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Calibration({ first }: { first: CalibrationKind }) {
  const [kind, setKind] = useState(first);
  const timer = useRef<number | undefined>(undefined);
  const blocks = calibrationBlocks(kind);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <PageTitle title={W.calibrationTitle} />
      {kind === 'loading' ? (
        <BudgetLoading words={W.calibrationLoading} card={false} />
      ) : kind === 'failed' ? (
        <>
          <p className="desk-line is-ink">{W.calibrationFailed}</p>
          <TextAction
            label={W.tryAgain}
            onClick={() => {
              setKind('loading');
              timer.current = window.setTimeout(() => setKind('few'), SEND_MS);
            }}
          />
        </>
      ) : blocks.length === 0 ? (
        <p className="tpl-empty">{W.nothingToLearn}</p>
      ) : (
        blocks.map((block) => <CurrencyPart key={block.currency} block={block} />)
      )}
    </>
  );
}

function CurrencyPart({ block }: { block: CurrencyBlock }) {
  const id = useId();
  const categories = (
    <Rows>
      {block.categories.map((learned) => {
        const row = learnedRow(learned, block.currency);

        return (
          <li key={learned.category}>
            <BudgetRow title={row.name} lines={[row.line]} end={<Amount value={row.value} />} />
          </li>
        );
      })}
    </Rows>
  );

  return (
    <section className="tpl-currency" aria-labelledby={id}>
      <h2 id={id} className="tpl-caps">
        {CURRENCY_HEADS[block.currency]}
      </h2>
      {block.vendors.length === 0 ? (
        categories
      ) : (
        <Columns
          left={
            <div className="desk-block">
              <Head title={W.byCategory} level={3} />
              {categories}
            </div>
          }
          right={
            <div className="desk-block">
              <Head title={W.byVendor} level={3} />
              <Rows>
                {block.vendors.map((vendor) => (
                  <li key={vendor.name}>
                    <BudgetRow
                      title={vendor.name}
                      lines={[W.paidAcross]}
                      end={<Amount value={vendorPaid(vendor)} />}
                    />
                  </li>
                ))}
              </Rows>
            </div>
          }
        />
      )}
    </section>
  );
}

/** Save as template (540): the name, refused at the field before sending or by the server; saved, it closes and says nothing. */
export function SaveTemplateDialog({
  start,
  onDismiss,
  onSaved,
}: {
  start: SaveStart;
  onDismiss: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [name, setName] = useState(() => startName(start));
  const [problem, setProblem] = useState<NameProblem | null>(start);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function save(): void {
    if (busy) return;
    const refused = nameProblem(name);

    if (refused != null) {
      setProblem(refused);
      field.current?.focus();

      return;
    }
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      if (nameTaken(name)) {
        setProblem('taken');
        field.current?.focus();
      } else onSaved();
    }, SEND_MS);
  }

  function typed(next: string): void {
    setName(next);
    if (problem == null) return;
    if (problem === 'taken' || nameProblem(next) == null) setProblem(null);
  }

  return (
    <BudgetDialog
      title={W.saveTitle}
      verb={busy ? BUDGET_WORDS.saving : BUDGET_WORDS.save}
      locked={busy}
      first={field}
      onDismiss={onDismiss}
      onConfirm={save}
    >
      <form
        className="tpl-save"
        noValidate
        onSubmit={(sent: FormEvent) => {
          sent.preventDefault();
          save();
        }}
      >
        <div className="desk-field">
          <label htmlFor={id} className="desk-label">
            {W.name}
          </label>
          <div className={problem == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              ref={field}
              id={id}
              type="text"
              value={name}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={problem != null}
              aria-describedby={problem == null ? `${id}-line` : `${id}-error ${id}-line`}
              onChange={(change) => typed(change.target.value)}
            />
          </div>
          {problem != null && (
            <p
              id={`${id}-error`}
              className="desk-error"
              role={problem === 'taken' ? 'alert' : undefined}
            >
              <Glyph name="alert" size={15} weight={2.2} />
              {W[problem]}
            </p>
          )}
        </div>
        <p id={`${id}-line`} className="tpl-save-line">
          {W.saveLine(COSTS_KEPT)}
        </p>
      </form>
    </BudgetDialog>
  );
}

/** A template, drawn here: the product's icon set has none. */
function TemplateMark() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}
