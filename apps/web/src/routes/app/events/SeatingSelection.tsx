import { type MeasurementSystem, type SeatingPlan } from '@soirely/api-client';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph, type GlyphName } from '../../../components/Glyph.tsx';
import { Ask, TextAction } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { focusWhenFree } from '../../../layers.ts';
import { Refused, Select } from './SeatingParts.tsx';
import { type FloorItem, type Placement, itemName } from './seatingItems.ts';
import {
  type Axis,
  type Edge,
  type KindLine,
  COLUMNS_MAX,
  EDGES,
  START_MAX,
  aligned,
  gridOf,
  kindLines,
  onlyTables,
  outsider,
  readGap,
  readWhole,
  renumbered,
  spaced,
  summaryOf,
} from './seatingSelection.ts';
import { lengthWords } from './seatingUnits.ts';

export type Fold = 'grid' | 'renumber' | 'section';

export interface GridDraft {
  columns: string;
  gap: string;
}

/** What the status line says after a step: Undo while it can be undone, amber when the step was refused. */
export interface StepBar {
  tone: 'undo' | 'amber';
  words: string;
  undo?: () => void;
}

const EDGE_GLYPHS: Record<Edge, GlyphName> = {
  left: 'alignLeft',
  centre: 'alignCentre',
  right: 'alignRight',
  top: 'alignTop',
  middle: 'alignMiddle',
  bottom: 'alignBottom',
};

const EDGE_KEYS: Record<Edge, string> = {
  left: 'Left',
  centre: 'Centre',
  right: 'Right',
  top: 'Top',
  middle: 'Middle',
  bottom: 'Bottom',
};

export function ChooseBar({
  plan,
  adding,
  kindMenu,
  onChoose,
  onAdding,
  onKindMenu,
}: {
  plan: SeatingPlan;
  adding: boolean;
  kindMenu: boolean;
  onChoose: (ids: string[]) => void;
  onAdding: (on: boolean) => void;
  onKindMenu: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const hint = useId();
  const kindButton = useRef<HTMLButtonElement>(null);
  const all = [...plan.tables, ...plan.rows, ...plan.singleSeats].map((one) => one.id);

  return (
    <>
      <div className="st-choose" role="group" aria-label={t('seating.chooseBar')}>
        <button type="button" className="st-tool" onClick={() => onChoose(all)}>
          <Glyph name="selectAll" size={18} weight={2.1} />
          {t('seating.selectAll')}
        </button>
        <button
          ref={kindButton}
          type="button"
          className={kindMenu ? 'st-tool is-on' : 'st-tool'}
          aria-haspopup="menu"
          aria-expanded={kindMenu}
          onClick={() => onKindMenu(!kindMenu)}
        >
          {t('seating.selectKind')}
          <Glyph name="chevdown" size={15} weight={2.4} />
        </button>
        <button
          type="button"
          className={adding ? 'st-choice is-on' : 'st-choice'}
          aria-pressed={adding}
          aria-describedby={adding ? hint : undefined}
          onClick={() => onAdding(!adding)}
        >
          <Glyph name={adding ? 'choiceOn' : 'choiceAdd'} size={18} weight={2.1} />
          {t('seating.addToChoice')}
        </button>
      </div>
      {adding && (
        <p id={hint} className="st-hint">
          {t('seating.addHint')}
        </p>
      )}
      {kindMenu && <KindMenu plan={plan} back={kindButton} onChoose={onChoose} />}
    </>
  );
}

function KindMenu({
  plan,
  back,
  onChoose,
}: {
  plan: SeatingPlan;
  back: RefObject<HTMLButtonElement | null>;
  onChoose: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const first = useRef<HTMLButtonElement>(null);
  const kindsHead = useId();
  const sectionsHead = useId();
  const { kinds, sections } = kindLines(plan);
  const firstOn = [...kinds, ...sections].find((line) => line.ids.length > 0)?.key;

  useEffect(() => {
    const toggle = back.current;

    first.current?.focus();
    return () => {
      const focused = document.activeElement;

      if (focused == null || focused === document.body || !focused.isConnected) toggle?.focus();
    };
  }, [back]);

  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    const rows = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    ];
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const to: Record<string, number> = {
      ArrowDown: (at + 1) % rows.length,
      ArrowUp: (at - 1 + rows.length) % rows.length,
      Home: 0,
      End: rows.length - 1,
    };
    const next = rows[to[event.key] ?? -1];

    if (next == null) return;
    event.preventDefault();
    next.focus();
  };

  const lines = (group: KindLine[]) =>
    group.map((line) => (
      <button
        key={line.key}
        ref={line.key === firstOn ? first : undefined}
        type="button"
        role="menuitem"
        className="st-menu-row st-kind-row"
        disabled={line.ids.length === 0}
        onClick={() => onChoose(line.ids)}
      >
        <span>{'name' in line.word ? line.word.name : t(line.word.key)}</span>
        <span className="st-kind-count">
          {line.ids.length === 0 ? t('seating.none') : line.ids.length}
        </span>
      </button>
    ));

  return (
    <div
      className="st-kind-menu"
      role="menu"
      aria-label={t('seating.selectKind')}
      tabIndex={-1}
      onKeyDown={step}
    >
      <div role="group" aria-labelledby={kindsHead}>
        <p id={kindsHead} className="st-menu-head">
          {t('seating.kindsGroup')}
        </p>
        {lines(kinds)}
      </div>
      {sections.length > 0 && (
        <div role="group" aria-labelledby={sectionsHead}>
          <p id={sectionsHead} className="st-menu-head">
            {t('seating.sectionsGroup')}
          </p>
          {lines(sections)}
        </div>
      )}
    </div>
  );
}

export function RulesStrip() {
  const { t } = useTranslation();
  const rules: readonly [GlyphName, string, string?][] = [
    ['plus', 'seating.ruleAdd'],
    ['minus', 'seating.ruleRemove'],
    ['choiceAdd', 'seating.ruleBox'],
    ['tick', 'seating.ruleFloor'],
    ['map', 'seating.ruleTouch', 'is-touch'],
  ];

  return (
    <div className="st-float st-keys st-rules" role="note" aria-label={t('seating.rules')}>
      {rules.map(([glyph, key, extra]) => (
        <span key={key} className={extra == null ? 'st-key' : `st-key ${extra}`}>
          <Glyph name={glyph} size={16} weight={2.2} />
          {t(key)}
        </span>
      ))}
    </div>
  );
}

export function StepLine({ bar, onUndo }: { bar: StepBar; onUndo: () => void }) {
  const { t } = useTranslation();

  return (
    <div className={`st-bar is-inline is-${bar.tone}`} role="status" aria-live="polite">
      <Glyph name={bar.tone === 'undo' ? 'tick' : 'alert'} size={17} weight={2.2} />
      <p>{bar.words}</p>
      {bar.undo != null && (
        <span className="st-bar-acts">
          <button type="button" className="desk-text" onClick={onUndo}>
            {t('seating.undo')}
          </button>
        </span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();

  return (
    <section className="st-tool-group" aria-labelledby={id}>
      <h3 id={id} className="st-tool-head">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Checked on Apply, not as it is typed; the first field that fails takes the focus. */
function PressField({
  fieldKey,
  label,
  value,
  error,
  onChange,
}: {
  fieldKey: string;
  label: string;
  value: string;
  error: string | null;
  onChange: (text: string) => void;
}) {
  const id = useId();

  return (
    <div className="st-field">
      <label htmlFor={id} className="st-label">
        {label}
      </label>
      <div className={error == null ? 'st-box' : 'st-box is-wrong'}>
        <input
          id={id}
          data-focus={fieldKey}
          type="text"
          inputMode="decimal"
          value={value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error != null && (
        <p id={`${id}-error`} className="st-field-error">
          <Glyph name="alert" size={15} weight={2.2} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function focusField(key: string): void {
  focusWhenFree(() => document.querySelector(`.st-panel [data-focus="${key}"]`));
}

export interface SelectionSteps {
  /** Align, Space evenly or a grid: one step that Undo puts back. */
  move: (moved: Placement[], words: string) => void;
  /** Refused before anything was sent: the status line turns amber and nothing moves. */
  refuse: (words: string) => void;
  rename: (names: { id: string; version: number; name: string }[], words: string) => void;
  section: (sectionId: string | null, words: string) => void;
  duplicate: () => void;
  askDelete: () => void;
}

function GridFold({
  plan,
  system,
  items,
  draft,
  onDraft,
  steps,
}: {
  plan: SeatingPlan;
  system: MeasurementSystem;
  items: FloorItem[];
  draft: GridDraft;
  onDraft: (draft: GridDraft) => void;
  steps: SelectionSteps;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [errors, setErrors] = useState<{ columns: string | null; gap: string | null }>({
    columns: null,
    gap: null,
  });
  const [refused, setRefused] = useState<string | null>(null);
  const lengths = (cm: number) => lengthWords(t, locale, cm, system);

  function gridWords(columns: number): string {
    const tables = onlyTables(items);
    const count = items.length;

    return columns === 1
      ? t(tables ? 'seating.gridColumnTables' : 'seating.gridColumnItems', { count })
      : t(tables ? 'seating.gridDoneTables' : 'seating.gridDoneItems', { count, columns });
  }

  function apply(): void {
    const columns = readWhole(draft.columns, COLUMNS_MAX);
    const gap = readGap(draft.gap, system, locale);

    setErrors({
      columns: columns == null ? t('seating.columnsRange') : null,
      gap: gap == null ? t(system === 'us' ? 'seating.gapRangeFeet' : 'seating.gapRange') : null,
    });
    setRefused(null);
    if (columns == null || gap == null) {
      focusField(columns == null ? 'gridColumns' : 'gridGap');
      return;
    }
    const { moved, w, l } = gridOf(items, columns, gap);

    if (w > plan.widthCm + 0.5) {
      setRefused(t('seating.gridWide', { size: lengths(w), room: lengths(plan.widthCm) }));
      return;
    }
    if (l > plan.lengthCm + 0.5) {
      setRefused(t('seating.gridLong', { size: lengths(l), room: lengths(plan.lengthCm) }));
      return;
    }
    const out = outsider(plan, items, moved);

    if (out != null) {
      setRefused(t('seating.edgeRefused', { name: itemName(t, out) }));
      return;
    }
    steps.move(moved, gridWords(Math.min(columns, items.length)));
  }

  return (
    <div className="st-fold-body">
      <div className="st-two">
        <PressField
          fieldKey="gridColumns"
          label={t('seating.columns')}
          value={draft.columns}
          error={errors.columns}
          onChange={(columns) => {
            onDraft({ ...draft, columns });
            setRefused(null);
          }}
        />
        <PressField
          fieldKey="gridGap"
          label={t(system === 'us' ? 'seating.gapFeet' : 'seating.gapMetres')}
          value={draft.gap}
          error={errors.gap}
          onChange={(gap) => {
            onDraft({ ...draft, gap });
            setRefused(null);
          }}
        />
      </div>
      {readWhole(draft.columns, COLUMNS_MAX) != null &&
        readGap(draft.gap, system, locale) != null && (
          <p className="st-line">{t('seating.gridPreview')}</p>
        )}
      {refused != null && <Refused>{refused}</Refused>}
      <button type="button" className="button" onClick={apply}>
        {t('seating.apply')}
      </button>
    </div>
  );
}

function RenumberFold({
  plan,
  items,
  steps,
}: {
  plan: SeatingPlan;
  items: FloorItem[];
  steps: SelectionSteps;
}) {
  const { t } = useTranslation();
  const [start, setStart] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const mixed = items.some((item) => item.kind !== 'table');

  function apply(): void {
    const from = readWhole(start, START_MAX);

    if (from == null) {
      setError(t('seating.startRange'));
      focusField('renumberStart');
      return;
    }
    const { names, clash } = renumbered(plan, items, from, (n) =>
      t('seating.tableNumbered', { n }),
    );

    if (clash != null) {
      setError(t('seating.renumberClash', { name: clash }));
      focusField('renumberStart');
      return;
    }
    setError(null);
    steps.rename(
      names,
      t('seating.renumbered', {
        count: names.length,
        from,
        to: from + names.length - 1,
      }),
    );
  }

  return (
    <div className="st-fold-body">
      <PressField
        fieldKey="renumberStart"
        label={t('seating.startAt')}
        value={start}
        error={error}
        onChange={setStart}
      />
      <p className="st-line">{t('seating.renumberOrder')}</p>
      {mixed && <p className="st-line">{t('seating.renumberKeeps')}</p>}
      <button type="button" className="button" onClick={apply}>
        {t('seating.apply')}
      </button>
    </div>
  );
}

function SectionFold({
  plan,
  items,
  steps,
}: {
  plan: SeatingPlan;
  items: FloorItem[];
  steps: SelectionSteps;
}) {
  const { t } = useTranslation();
  const [pick, setPick] = useState(plan.sections[0]?.id ?? '');

  function apply(): void {
    const section = plan.sections.find((one) => one.id === pick) ?? null;
    const tables = onlyTables(items);
    const count = items.length;

    steps.section(
      section?.id ?? null,
      section == null
        ? t(tables ? 'seating.unsectionedTables' : 'seating.unsectionedItems', { count })
        : t(tables ? 'seating.sectionedTables' : 'seating.sectionedItems', {
            count,
            section: section.name,
          }),
    );
  }

  return (
    <div className="st-fold-body">
      <Select
        fieldKey="sectionPick"
        label={t('seating.section')}
        value={pick}
        options={[
          ...plan.sections.map((one) => ({ value: one.id, word: one.name })),
          { value: '', word: t('seating.noSection') },
        ]}
        onPick={setPick}
      />
      <button type="button" className="button" onClick={apply}>
        {t('seating.apply')}
      </button>
    </div>
  );
}

const FOLDS: readonly [Fold, string][] = [
  ['grid', 'seating.grid'],
  ['renumber', 'seating.renumber'],
  ['section', 'seating.section'],
];

/** Two or more chosen (sc-4717): what they are, then Align, Space evenly, the three folds, Duplicate and Delete. */
export function SelectionPanel({
  plan,
  system,
  items,
  adding,
  fold,
  onFold,
  grid,
  onGrid,
  steps,
}: {
  plan: SeatingPlan;
  system: MeasurementSystem;
  items: FloorItem[];
  adding: boolean;
  fold: Fold | null;
  onFold: (fold: Fold | null) => void;
  grid: GridDraft;
  onGrid: (draft: GridDraft) => void;
  steps: SelectionSteps;
}) {
  const { t } = useTranslation();
  const spaceNote = useId();
  const renumberNote = useId();
  const tips = useId();
  const few = items.length < 3;
  const noTables = !items.some((item) => item.kind === 'table');
  const tables = onlyTables(items);
  const count = items.length;

  const moveOrRefuse = (moved: Placement[], words: string) => {
    const out = outsider(plan, items, moved);

    if (out == null) steps.move(moved, words);
    else steps.refuse(t('seating.edgeRefused', { name: itemName(t, out) }));
  };

  const align = (edge: Edge) =>
    moveOrRefuse(
      aligned(items, edge),
      t(`seating.done${EDGE_KEYS[edge]}${tables ? 'Tables' : 'Items'}`, { count }),
    );

  const space = (axis: Axis) =>
    moveOrRefuse(
      spaced(items, axis),
      axis === 'across'
        ? t(tables ? 'seating.spacedAcrossTables' : 'seating.spacedAcrossItems', { count })
        : t(tables ? 'seating.spacedDownTables' : 'seating.spacedDownItems', { count }),
    );

  return (
    <div className="st-stack">
      <div className="st-title">
        <h2 data-focus="title" tabIndex={-1}>
          {t('seating.chosenCount', { count: items.length })}
        </h2>
        <p>{summaryOf(t, items)}</p>
      </div>
      <p className="st-line">{t(adding ? 'seating.escKeeps' : 'seating.shiftClick')}</p>
      <Section title={t('seating.align')}>
        <div className="st-align">
          {EDGES.map((edge) => (
            <span key={edge} className="st-align-one">
              <button
                type="button"
                className="st-align-button"
                aria-describedby={`${tips}-${edge}`}
                onClick={() => align(edge)}
              >
                <Glyph name={EDGE_GLYPHS[edge]} size={18} weight={2.1} />
                {t(`seating.align${EDGE_KEYS[edge]}`)}
              </button>
              <span id={`${tips}-${edge}`} role="tooltip" className="st-tooltip">
                {t(`seating.tip${EDGE_KEYS[edge]}`)}
              </span>
            </span>
          ))}
        </div>
      </Section>
      <Section title={t('seating.spaceEvenly')}>
        <div className="st-two">
          {(['across', 'down'] as const).map((axis) => (
            <button
              key={axis}
              type="button"
              className="st-align-button"
              disabled={few}
              aria-describedby={few ? spaceNote : undefined}
              onClick={() => space(axis)}
            >
              <Glyph
                name={axis === 'across' ? 'spaceAcross' : 'spaceDown'}
                size={18}
                weight={2.1}
              />
              {t(axis === 'across' ? 'seating.across' : 'seating.down')}
            </button>
          ))}
        </div>
        {few && (
          <p id={spaceNote} className="st-line">
            {t('seating.spaceThree')}
          </p>
        )}
      </Section>
      <div className="st-folds">
        {FOLDS.map(([one, word]) => {
          const shut = one === 'renumber' && noTables;
          const open = fold === one && !shut;

          return (
            <div key={one} className={open ? 'st-fold is-open' : 'st-fold'}>
              <button
                type="button"
                className="st-fold-head"
                aria-expanded={open}
                aria-controls={`${tips}-fold-${one}`}
                disabled={shut}
                aria-describedby={shut ? renumberNote : undefined}
                onClick={() => onFold(open ? null : one)}
              >
                {t(word)}
                <Glyph name="chevdown" size={16} weight={2.3} />
              </button>
              {shut && (
                <p id={renumberNote} className="st-line">
                  {t('seating.renumberTables')}
                </p>
              )}
              <div id={`${tips}-fold-${one}`} hidden={!open}>
                {open && one === 'grid' && (
                  <GridFold
                    plan={plan}
                    system={system}
                    items={items}
                    draft={grid}
                    onDraft={onGrid}
                    steps={steps}
                  />
                )}
                {open && one === 'renumber' && (
                  <RenumberFold plan={plan} items={items} steps={steps} />
                )}
                {open && one === 'section' && (
                  <SectionFold plan={plan} items={items} steps={steps} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="st-acts">
        <TextAction label={t('seating.duplicate')} before="copy" onClick={steps.duplicate} />
        <TextAction label={t('seating.deleteMany')} red onClick={steps.askDelete} />
      </div>
    </div>
  );
}

/** Nobody can be seated until sc-4013, so the ask always says nobody is in them. */
export function DeleteItemsAsk({
  items,
  onKeep,
  onGo,
}: {
  items: FloorItem[];
  onKeep: () => void;
  onGo: (items: FloorItem[]) => void;
}) {
  const { t } = useTranslation();
  const tables = items.every((item) => item.kind === 'table');
  const count = items.length;

  if (count === 0) return null;
  return (
    <Ask
      title={t(tables ? 'seating.deleteTablesAsk' : 'seating.deleteItemsAsk', { count })}
      line={t('seating.nobodyInThem')}
      keep={t('seating.keepThem')}
      go={t(tables ? 'seating.deleteTablesGo' : 'seating.deleteItemsGo', { count })}
      onKeep={onKeep}
      onGo={() => onGo(items)}
    />
  );
}
