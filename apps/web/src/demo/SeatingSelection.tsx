import { type ReactNode, useEffect, useId, useRef } from 'react';

import { Icon, type IconName } from './SeatingGlyph.tsx';
import { type Item, type Plan, SW, isTable, many, say } from './seating.ts';
import { useSeating } from './seatingContext.ts';
import type { Ui } from './seatingSeed.ts';
import {
  type Edge,
  type Fold,
  EDGES,
  aligned,
  copiesOf,
  gapRefusal,
  gridOf,
  kindLines,
  outsider,
  readColumns,
  readGap,
  readStart,
  renamed,
  spaced,
  summaryOf,
  thingsOf,
  tooBig,
  withMoved,
} from './selection.ts';
import { TextAction } from '../components/SettingsParts.tsx';

const EDGE_WORDS: Record<Edge, { word: string; tip: string; done: string; icon: IconName }> = {
  left: { word: SW.alignLeft, tip: SW.tipLeft, done: SW.doneLeft, icon: 'alignLeft' },
  centre: { word: SW.alignCentre, tip: SW.tipCentre, done: SW.doneCentre, icon: 'alignCentre' },
  right: { word: SW.alignRight, tip: SW.tipRight, done: SW.doneRight, icon: 'alignRight' },
  top: { word: SW.alignTop, tip: SW.tipTop, done: SW.doneTop, icon: 'alignTop' },
  middle: { word: SW.alignMiddle, tip: SW.tipMiddle, done: SW.doneMiddle, icon: 'alignMiddle' },
  bottom: { word: SW.alignBottom, tip: SW.tipBottom, done: SW.doneBottom, icon: 'alignBottom' },
};

/** One tool, one step: the whole plan is kept for Undo and the status line says what happened. */
function stepped(now: Ui, plan: Plan, words: string, chosen: string[] = now.chosen): Ui {
  return {
    ...now,
    plan,
    chosen,
    undo: { plan: now.plan, tray: now.tray },
    bar: { kind: 'undo', words, does: 'undo' },
    save: 'saving',
    refused: null,
    notice: null,
  };
}

function refusedAtWall(now: Ui, name: string): Ui {
  return { ...now, bar: { kind: 'amber', words: say(SW.edgeRefused, { name }) } };
}

export function ChooseBar() {
  const { ui, set, choose } = useSeating();
  const hint = useId();

  return (
    <>
      <div className="st-choose" role="group" aria-label={SW.chooseBar}>
        <button
          type="button"
          className="st-tool"
          onClick={() => {
            choose(ui.plan.items.map((item) => item.id));
            set((now) => ({ ...now, kindMenu: false, tab: 'arrange' }));
          }}
        >
          <Icon name="selectAll" size={18} weight={2.1} />
          {SW.selectAll}
        </button>
        <button
          type="button"
          className={ui.kindMenu ? 'st-tool is-on' : 'st-tool'}
          aria-haspopup="menu"
          aria-expanded={ui.kindMenu}
          onClick={() => set((now) => ({ ...now, kindMenu: !now.kindMenu, menu: false }))}
        >
          {SW.selectKind}
          <Icon name="chevdown" size={15} weight={2.4} />
        </button>
        <button
          type="button"
          className={ui.adding ? 'st-choice is-on' : 'st-choice'}
          aria-pressed={ui.adding}
          aria-describedby={ui.adding ? hint : undefined}
          onClick={() => set((now) => ({ ...now, adding: !now.adding, kindMenu: false }))}
        >
          <Icon name={ui.adding ? 'choiceOn' : 'choiceAdd'} size={18} weight={2.1} />
          {SW.addToChoice}
        </button>
      </div>
      {ui.adding && (
        <p id={hint} className="st-hint">
          {SW.addHint}
        </p>
      )}
      {ui.kindMenu && <KindMenu />}
    </>
  );
}

function KindMenu() {
  const { ui, set, choose } = useSeating();
  const first = useRef<HTMLButtonElement>(null);
  const { kinds, sections } = kindLines(ui.plan);
  const pick = (ids: string[]) => {
    choose(ids);
    set((now) => ({ ...now, kindMenu: false, tab: 'arrange' }));
  };
  const firstOn = [...kinds, ...sections].find((line) => line.ids.length > 0)?.key;

  useEffect(() => first.current?.focus(), []);

  const lines = (group: typeof kinds) =>
    group.map((line) => (
      <button
        key={line.key}
        ref={line.key === firstOn ? first : undefined}
        type="button"
        role="menuitem"
        className="st-menu-row st-kind-row"
        disabled={line.ids.length === 0}
        onClick={() => pick(line.ids)}
      >
        <span>{line.word}</span>
        <span className="st-kind-count">{line.ids.length === 0 ? SW.none : line.ids.length}</span>
      </button>
    ));

  return (
    <div className="st-kind-menu" role="menu" aria-label={SW.selectKind}>
      <div role="group" aria-labelledby="st-kinds-head">
        <p id="st-kinds-head" className="st-menu-head">
          {SW.kindsGroup}
        </p>
        {lines(kinds)}
      </div>
      {sections.length > 0 && (
        <div role="group" aria-labelledby="st-sections-head">
          <p id="st-sections-head" className="st-menu-head">
            {SW.sectionsGroup}
          </p>
          {lines(sections)}
        </div>
      )}
    </div>
  );
}

export function RulesStrip() {
  const rules: readonly [IconName, string, string?][] = [
    ['plus', SW.ruleAdd],
    ['minus', SW.ruleRemove],
    ['choiceAdd', SW.ruleBox],
    ['tick', SW.ruleFloor],
    ['map', SW.ruleTouch, 'is-touch'],
  ];

  return (
    <div className="st-float st-keys st-rules" role="note" aria-label={SW.rules}>
      {rules.map(([icon, words, extra]) => (
        <span key={words} className={extra == null ? 'st-key' : `st-key ${extra}`}>
          <Icon name={icon} size={16} weight={2.2} />
          {words}
        </span>
      ))}
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
  error?: string | null | undefined;
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
          <Icon name="alert" size={15} weight={2.2} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function Refused() {
  const { ui } = useSeating();

  if (ui.refused == null) return null;
  return (
    <p className="st-alert is-red" role="alert">
      <Icon name="alert" size={15} weight={2.2} />
      <span>{ui.refused}</span>
    </p>
  );
}

function GridFold({ items }: { items: Item[] }) {
  const { ui, set, focusField } = useSeating();
  const grid = ui.grid;
  const type = (key: 'columns' | 'gap', text: string) =>
    set((now) => ({ ...now, grid: { ...now.grid, [key]: text }, refused: null }));

  function apply(): void {
    const columns = readColumns(grid.columns);
    const gap = readGap(grid.gap, ui.units);
    const errors = {
      ...(columns == null ? { columns: SW.columnsRange } : {}),
      ...(gap == null ? { gap: gapRefusal(ui.units) } : {}),
    };

    if (columns == null || gap == null) {
      set((now) => ({ ...now, grid: { ...now.grid, errors }, refused: null }));
      focusField(columns == null ? 'gridColumns' : 'gridGap');
      return;
    }
    const { moved, w, l } = gridOf(items, columns, gap);
    const big = tooBig(ui.plan, w, l, ui.units);
    const out = outsider(ui.plan, moved);

    if (big != null || out != null) {
      set((now) => ({
        ...now,
        grid: { ...now.grid, errors: {} },
        refused: big ?? say(SW.edgeRefused, { name: out?.name ?? '' }),
      }));
      return;
    }
    set((now) => ({
      ...stepped(
        now,
        withMoved(now.plan, moved),
        many('gridDone', Math.min(columns, items.length), {
          things: thingsOf(items),
        }),
      ),
      grid: { ...now.grid, errors: {} },
    }));
  }

  return (
    <div className="st-fold-body">
      <div className="st-two">
        <PressField
          fieldKey="gridColumns"
          label={SW.columns}
          value={grid.columns}
          error={grid.errors.columns}
          onChange={(text) => type('columns', text)}
        />
        <PressField
          fieldKey="gridGap"
          label={ui.units === 'us' ? SW.gapFeet : SW.gapMetres}
          value={grid.gap}
          error={grid.errors.gap}
          onChange={(text) => type('gap', text)}
        />
      </div>
      {readColumns(grid.columns) != null && readGap(grid.gap, ui.units) != null && (
        <p className="st-line">{SW.gridPreview}</p>
      )}
      <Refused />
      <button type="button" className="button" onClick={apply}>
        {SW.apply}
      </button>
    </div>
  );
}

function RenumberFold({ items }: { items: Item[] }) {
  const { ui, set, focusField } = useSeating();
  const mixed = items.some((item) => !isTable(item));

  function apply(): void {
    const start = readStart(ui.renumber.start);

    if (start == null) {
      set((now) => ({ ...now, renumber: { ...now.renumber, error: SW.startRange } }));
      focusField('renumberStart');
      return;
    }
    const { moved, clash } = renamed(ui.plan, items, start);

    if (clash != null) {
      set((now) => ({
        ...now,
        renumber: { ...now.renumber, error: say(SW.renumberClash, { name: clash }) },
      }));
      focusField('renumberStart');
      return;
    }
    const words = many('renumbered', moved.length, {
      from: start,
      to: start + moved.length - 1,
    });

    set((now) => ({
      ...stepped(now, withMoved(now.plan, moved), words),
      renumber: { ...now.renumber, error: null },
    }));
  }

  return (
    <div className="st-fold-body">
      <PressField
        fieldKey="renumberStart"
        label={SW.startAt}
        value={ui.renumber.start}
        error={ui.renumber.error}
        onChange={(text) =>
          set((now) => ({ ...now, renumber: { start: text, error: now.renumber.error } }))
        }
      />
      <p className="st-line">{SW.renumberOrder}</p>
      {mixed && <p className="st-line">{SW.renumberKeeps}</p>}
      <button type="button" className="button" onClick={apply}>
        {SW.apply}
      </button>
    </div>
  );
}

function SectionFold({ items }: { items: Item[] }) {
  const { ui, set } = useSeating();
  const id = useId();

  function apply(): void {
    const sec = ui.plan.sections.find((one) => one.id === ui.sectionPick) ?? null;
    const things = thingsOf(items);
    const words =
      sec == null
        ? say(SW.unsectioned, { things })
        : say(SW.sectioned, { things, section: sec.name });
    const moved = items.map((item) => ({ ...item, sec: sec?.id ?? null }));

    set((now) => stepped(now, withMoved(now.plan, moved), words));
  }

  return (
    <div className="st-fold-body">
      <div className="st-field">
        <label htmlFor={id} className="st-label">
          {SW.section}
        </label>
        <div className="st-box is-select">
          <select
            id={id}
            data-focus="sectionPick"
            value={ui.sectionPick}
            onChange={(event) => set((now) => ({ ...now, sectionPick: event.target.value }))}
          >
            {ui.plan.sections.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
            <option value="">{SW.noSection}</option>
          </select>
          <Icon name="chevdown" size={16} weight={2.3} />
        </div>
      </div>
      <button type="button" className="button" onClick={apply}>
        {SW.apply}
      </button>
    </div>
  );
}

const FOLDS: readonly [Fold, string][] = [
  ['grid', SW.grid],
  ['renumber', SW.renumber],
  ['section', SW.section],
];

/** Two or more chosen (sc-4717): what they are, then Align, Space evenly, the three folds, Duplicate and Delete. */
export function SelectionPanel({ items }: { items: Item[] }) {
  const { ui, set, ask } = useSeating();
  const spaceNote = useId();
  const few = items.length < 3;

  function align(edge: Edge): void {
    const moved = aligned(items, edge);
    const out = outsider(ui.plan, moved);

    set((now) =>
      out != null
        ? refusedAtWall(now, out.name)
        : stepped(
            now,
            withMoved(now.plan, moved),
            say(EDGE_WORDS[edge].done, { things: thingsOf(items) }),
          ),
    );
  }

  function space(axis: 'across' | 'down'): void {
    const moved = spaced(items, axis);
    const out = outsider(ui.plan, moved);
    const words = say(axis === 'across' ? SW.spacedAcross : SW.spacedDown, {
      things: thingsOf(items),
    });

    set((now) =>
      out != null ? refusedAtWall(now, out.name) : stepped(now, withMoved(now.plan, moved), words),
    );
  }

  function duplicate(): void {
    const made = copiesOf(ui.plan, items);

    set((now) => {
      if ('refused' in made)
        return {
          ...now,
          bar: { kind: 'amber', words: say(SW.copyRefused, { name: made.refused.name }) },
        };
      return stepped(
        now,
        { ...now.plan, items: [...now.plan.items, ...made.copies] },
        many('duplicatedMany', made.copies.length),
        made.copies.map((item) => item.id),
      );
    });
  }

  return (
    <div className="st-stack">
      <div className="st-title">
        <h2 data-focus="title" tabIndex={-1}>
          {say(SW.chosen, { n: items.length })}
        </h2>
        <p>{summaryOf(items)}</p>
      </div>
      <p className="st-line">{ui.adding ? SW.escKeeps : SW.shiftClick}</p>
      <Section title={SW.align}>
        <div className="st-align">
          {EDGES.map((edge) => {
            const words = EDGE_WORDS[edge];

            return (
              <span key={edge} className="st-align-one">
                <button
                  type="button"
                  className="st-align-button"
                  aria-describedby={`st-tip-${edge}`}
                  onClick={() => align(edge)}
                >
                  <Icon name={words.icon} size={18} weight={2.1} />
                  {words.word}
                </button>
                <span id={`st-tip-${edge}`} role="tooltip" className="st-tooltip">
                  {words.tip}
                </span>
              </span>
            );
          })}
        </div>
      </Section>
      <Section title={SW.spaceEvenly}>
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
              <Icon name={axis === 'across' ? 'spaceAcross' : 'spaceDown'} size={18} weight={2.1} />
              {axis === 'across' ? SW.across : SW.down}
            </button>
          ))}
        </div>
        {few && (
          <p id={spaceNote} className="st-line">
            {SW.spaceThree}
          </p>
        )}
      </Section>
      <div className="st-folds">
        {FOLDS.map(([fold, word]) => {
          const open = ui.fold === fold;

          return (
            <div key={fold} className={open ? 'st-fold is-open' : 'st-fold'}>
              <button
                type="button"
                className="st-fold-head"
                aria-expanded={open}
                aria-controls={`st-fold-${fold}`}
                onClick={() => set((now) => ({ ...now, fold: open ? null : fold, refused: null }))}
              >
                {word}
                <Icon name="chevdown" size={16} weight={2.3} />
              </button>
              <div id={`st-fold-${fold}`} hidden={!open}>
                {open && fold === 'grid' && <GridFold items={items} />}
                {open && fold === 'renumber' && <RenumberFold items={items} />}
                {open && fold === 'section' && <SectionFold items={items} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="st-acts">
        <TextAction label={SW.duplicate} before="copy" onClick={duplicate} />
        <TextAction
          label={SW.deleteMany}
          red
          onClick={() => ask({ kind: 'deleteItems', ids: items.map((item) => item.id) })}
        />
      </div>
    </div>
  );
}
