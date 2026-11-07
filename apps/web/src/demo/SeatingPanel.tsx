import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { Icon } from './SeatingGlyph.tsx';
import {
  type Chair,
  type Colour,
  type Item,
  type Kind,
  type Plan,
  COLOURS,
  GROUP_ORDER,
  SW,
  chairWord,
  endsLine,
  filled,
  initials,
  inside,
  itemLine,
  keepSeats,
  leastUsed,
  lengthOf,
  overlap as overlapping,
  partyTitle,
  peopleIn,
  readCount,
  readFeet,
  shownParties,
  readPlace,
  readRoom,
  readSize,
  reshaped,
  sameName,
  say,
  sectionLine,
  sectionName,
  shapeShort,
  shapeWord,
  sizeOf,
  squeezeWords,
  squeezed,
  stateWord,
  turns,
  withSeats,
} from './seating.ts';
import { useSeating } from './seatingContext.ts';
import { StateMark } from './SeatingRoom.tsx';
import { Mark, TextAction } from '../components/SettingsParts.tsx';

export function Line({
  children,
  tone = 'quiet',
}: {
  children: ReactNode;
  tone?: 'quiet' | 'ink' | 'big';
}) {
  return <p className={tone === 'quiet' ? 'st-line' : `st-line is-${tone}`}>{children}</p>;
}

function Said({ tone, children }: { tone: 'red' | 'amber' | 'green'; children: ReactNode }) {
  if (tone === 'green')
    return (
      <p className="st-added" role="status">
        <Mark kind="yes" />
        {children}
      </p>
    );
  return (
    <p className={`st-alert is-${tone}`} role={tone === 'red' ? 'alert' : 'status'}>
      <Icon name="alert" size={15} weight={2.2} />
      <span>{children}</span>
    </p>
  );
}

function TitleBlock({ title, line }: { title: string; line?: string | undefined }) {
  return (
    <div className="st-title">
      <h2 data-focus="title" tabIndex={-1}>
        {title}
      </h2>
      {line != null && <p>{line}</p>}
    </div>
  );
}

function BackHead({ title, line, onClose }: { title: string; line?: string; onClose: () => void }) {
  return (
    <div className="st-back-head">
      <div className="st-back-row">
        <h2 data-focus="title" tabIndex={-1}>
          {title}
        </h2>
        <button type="button" className="st-icon-button" aria-label={SW.close} onClick={onClose}>
          <Icon name="clear" size={19} weight={2.2} />
        </button>
      </div>
      {line != null && <p className="st-line">{line}</p>}
    </div>
  );
}

function Two({ children }: { children: ReactNode }) {
  return <div className="st-two">{children}</div>;
}

function Acts({ children }: { children: ReactNode }) {
  return <div className="st-acts">{children}</div>;
}

/** A labelled field that applies on Enter or on leaving it (pm, 7 Nov 2026): a refusal is said beside it and nothing is saved. */
export function Field({
  fieldKey,
  label,
  value,
  unit,
  optional = false,
  hint,
  warn,
  maxLength,
  readOnly = false,
  onCommit,
}: {
  fieldKey: string;
  label: string;
  value: string;
  unit?: string | undefined;
  optional?: boolean;
  hint?: string | undefined;
  warn?: string | null | undefined;
  maxLength?: number;
  readOnly?: boolean;
  onCommit: (text: string) => string | null;
}) {
  const { ui } = useSeating();
  const id = useId();
  const seed = ui.seed?.key === fieldKey ? ui.seed : null;
  const [draft, setDraft] = useState(seed?.value ?? value);
  const [error, setError] = useState<string | null>(seed?.error ?? null);
  const editing = useRef(false);
  const shownWarn = warn ?? seed?.warn ?? null;

  const was = useRef(value);

  useEffect(() => {
    if (was.current === value) return;
    was.current = value;
    if (!editing.current) {
      setDraft(value);
      setError(null);
    }
  }, [value]);

  function commit(): void {
    editing.current = false;
    if (draft === value && error == null) return;
    if (draft === value) {
      setError(null);
      return;
    }
    const refused = onCommit(draft);

    setError(refused);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      editing.current = false;
      setDraft(value);
      setError(null);
    }
  }

  const told = [
    error != null && `${id}-error`,
    shownWarn != null && `${id}-warn`,
    hint != null && `${id}-hint`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="st-field">
      <label htmlFor={id} className="st-label">
        {label}
        {optional && <span className="st-optional">{SW.optional}</span>}
      </label>
      <div className={error == null ? 'st-box' : 'st-box is-wrong'}>
        <input
          id={id}
          data-focus={fieldKey}
          type="text"
          value={draft}
          readOnly={readOnly}
          maxLength={maxLength}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => {
            editing.current = true;
            setDraft(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={keys}
        />
        {unit != null && (
          <span className="st-unit" aria-hidden="true">
            {unit}
          </span>
        )}
      </div>
      {error != null && (
        <p id={`${id}-error`} className="st-field-error">
          <Icon name="alert" size={15} weight={2.2} />
          <span>{error}</span>
        </p>
      )}
      {shownWarn != null && (
        <p id={`${id}-warn`} className="st-field-warn">
          <Icon name="alert" size={15} weight={2.2} />
          <span>{shownWarn}</span>
        </p>
      )}
      {hint != null && (
        <p id={`${id}-hint`} className="st-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

function Select({
  fieldKey,
  label,
  value,
  options,
  onPick,
}: {
  fieldKey: string;
  label: string;
  value: string;
  options: readonly { value: string; word: string }[];
  onPick: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="st-field">
      <label htmlFor={id} className="st-label">
        {label}
      </label>
      <div className="st-box is-select">
        <select
          id={id}
          data-focus={fieldKey}
          value={value}
          onChange={(event) => onPick(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.word}
            </option>
          ))}
        </select>
        <Icon name="chevdown" size={16} weight={2.3} />
      </div>
    </div>
  );
}

export function Swatch({ colour, size = 20 }: { colour: Colour | null; size?: 12 | 16 | 20 }) {
  return (
    <span
      className={
        colour == null
          ? `st-swatch is-none is-${size}`
          : `st-swatch is-${colour.toLowerCase()} is-${size}`
      }
      aria-hidden="true"
    />
  );
}

export function Legend() {
  const states: Chair['state'][] = ['taken', 'held', 'empty', 'unusable'];

  return (
    <ul className="st-legend" aria-label={SW.legend}>
      {states.map((state) => (
        <li key={state}>
          <StateMark chair={{ state }} size={16} />
          {stateWord(state)}
        </li>
      ))}
    </ul>
  );
}

function Actions({ item }: { item: Item }) {
  const { duplicate, ask } = useSeating();
  const word =
    item.kind === 'row' ? SW.deleteRow : item.kind === 'single' ? SW.deleteSeat : SW.deleteTable;

  return (
    <Acts>
      {item.kind !== 'single' && (
        <TextAction label={SW.duplicate} onClick={() => duplicate(item.id)} />
      )}
      <TextAction label={word} red onClick={() => ask({ kind: 'deleteItems', ids: [item.id] })} />
    </Acts>
  );
}

function RoomHead({ readOnly }: { readOnly: boolean }) {
  const { ui, open } = useSeating();
  const room = ui.plan.room;

  return (
    <div className="st-block">
      <div className="st-head">
        <h2>{SW.room}</h2>
        {!readOnly && <TextAction label={SW.roomSettings} onClick={() => open({ kind: 'room' })} />}
      </div>
      {room != null && (
        <Line tone="big">
          {say(SW.roomLine, {
            name: room.name,
            width: lengthOf(room.w, ui.units),
            length: lengthOf(room.l, ui.units),
          })}
        </Line>
      )}
    </div>
  );
}

function SnapRow() {
  const { ui, set } = useSeating();

  return (
    <div className="st-switch-row">
      <span id="st-snap">{SW.snap}</span>
      <button
        type="button"
        role="switch"
        className="ev-switch"
        aria-checked={ui.snap}
        aria-labelledby="st-snap"
        onClick={() => set((now) => ({ ...now, snap: !now.snap }))}
      >
        <span className="ev-track" aria-hidden="true">
          <span className="ev-knob" />
        </span>
      </button>
    </div>
  );
}

function SectionsBlock({ readOnly }: { readOnly: boolean }) {
  const { ui, open, set } = useSeating();
  const plan = ui.plan;
  const unsorted = plan.items.some((item) => item.sec == null);
  const tooMany = plan.sections.length >= 30;

  return (
    <section className="st-block" aria-labelledby="st-sections">
      {ui.sectionsRefused && <Said tone="red">{SW.sectionLimit}</Said>}
      <div className="st-head">
        <h2 id="st-sections">
          {tooMany ? say(SW.sectionsCount, { n: plan.sections.length }) : SW.sections}
        </h2>
        {!readOnly && (
          <TextAction
            label={SW.addASection}
            before="plus"
            onClick={() =>
              tooMany
                ? set((now) => ({ ...now, sectionsRefused: true }))
                : open({ kind: 'sectionAdd' })
            }
          />
        )}
      </div>
      {plan.sections.length === 0 ? (
        <Line>{SW.noSections}</Line>
      ) : (
        <ul className="st-rows">
          {plan.sections.map((section) => (
            <li key={section.id} className="st-row">
              <Swatch colour={section.colour} />
              <span className="st-row-words">
                <span className="st-row-name">{section.name}</span>
                <span className="st-row-line">{sectionLine(plan, section.id)}</span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="desk-text"
                  aria-label={`${SW.edit} ${section.name}`}
                  onClick={() => open({ kind: 'sectionEdit', id: section.id })}
                >
                  {SW.edit}
                </button>
              )}
            </li>
          ))}
          {unsorted && (
            <li className="st-row">
              <Swatch colour={null} />
              <span className="st-row-words">
                <span className="st-row-name">{SW.noSection}</span>
                <span className="st-row-line">{sectionLine(plan, null)}</span>
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function NothingChosen() {
  const { ui } = useSeating();

  return (
    <>
      <RoomHead readOnly={ui.readOnly} />
      {ui.readOnly ? <Line>{SW.readOnly}</Line> : <SnapRow />}
      <SectionsBlock readOnly={ui.readOnly} />
      {ui.camera == null || ui.camera.s >= 0.25 ? <Legend /> : null}
    </>
  );
}

function StartForm() {
  const { ui, set, commit } = useSeating();
  const { start } = ui;

  function begin(): void {
    const width = readRoom(start.width, 'width');
    const length = readRoom(start.length, 'length');
    const errors = {
      ...('refused' in width ? { width: width.refused } : {}),
      ...('refused' in length ? { length: length.refused } : {}),
    };

    set((now) => ({ ...now, start: { ...now.start, errors } }));
    if ('refused' in width || 'refused' in length) {
      document
        .querySelector<HTMLElement>(
          `[data-focus="${'refused' in width ? 'startWidth' : 'startLength'}"]`,
        )
        ?.focus();
      return;
    }
    commit(
      null,
      (plan) => ({
        ...plan,
        room: {
          name: start.name.trim() === '' ? 'Main hall' : start.name.trim(),
          w: width.cm,
          l: length.cm,
        },
        items: [],
        sections: [],
      }),
      {
        panel: null,
        people: [],
        bar: { kind: 'tint', words: SW.firstItem },
      },
    );
  }

  function typed(key: 'name' | 'width' | 'length', text: string): void {
    set((now) => ({
      ...now,
      start: {
        ...now.start,
        [key]: text,
        errors: key === 'name' ? now.start.errors : { ...now.start.errors, [key]: undefined },
      },
    }));
  }

  return (
    <form
      className="st-stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        begin();
      }}
    >
      <TitleBlock
        title={SW.startPlan}
        line={say(SW.startLine, { venue: 'The Landmark', city: 'London', whose: 'Ire Events’' })}
      />
      <StartField
        label={SW.roomName}
        optional
        value={start.name}
        onChange={(text) => typed('name', text)}
        fieldKey="startName"
      />
      <Two>
        <StartField
          label={SW.width}
          unit="m"
          value={start.width}
          error={start.errors.width}
          onChange={(text) => typed('width', text)}
          fieldKey="startWidth"
        />
        <StartField
          label={SW.length}
          unit="m"
          value={start.length}
          error={start.errors.length}
          onChange={(text) => typed('length', text)}
          fieldKey="startLength"
        />
      </Two>
      <button type="submit" className="button button-primary st-wide">
        {SW.startPlan}
      </button>
    </form>
  );
}

function StartField({
  label,
  value,
  unit,
  optional = false,
  error,
  fieldKey,
  onChange,
}: {
  label: string;
  value: string;
  unit?: string;
  optional?: boolean;
  error?: string | undefined;
  fieldKey: string;
  onChange: (text: string) => void;
}) {
  const id = useId();

  return (
    <div className="st-field">
      <label htmlFor={id} className="st-label">
        {label}
        {optional && <span className="st-optional">{SW.optional}</span>}
      </label>
      <div className={error == null ? 'st-box' : 'st-box is-wrong'}>
        <input
          id={id}
          data-focus={fieldKey}
          type="text"
          inputMode={unit == null ? 'text' : 'decimal'}
          value={value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error != null}
          aria-describedby={error == null ? undefined : `${id}-error`}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit != null && (
          <span className="st-unit" aria-hidden="true">
            {unit}
          </span>
        )}
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

function RoomSettings() {
  const { ui, set, commit, open, ask } = useSeating();
  const room = ui.plan.room;

  if (room == null) return null;

  function resize(key: 'w' | 'l', text: string): string | null {
    const which = key === 'w' ? 'width' : 'length';
    const typed = text.trim();
    const feet =
      ui.units === 'us' && typed !== '' ? (readFeet(typed) ?? readFeet(`${typed} ft`)) : null;
    const read =
      ui.units !== 'us' || typed === ''
        ? readRoom(text, which)
        : feet == null
          ? { refused: SW.roomRange }
          : readRoom(String(feet / 100), which);

    if ('refused' in read) return read.refused;
    const next = { ...room!, [key]: read.cm };
    const outside = ui.plan.items.filter((item) => !inside(item, next));

    if (outside.length > 0) {
      set((now) => ({
        ...now,
        shrink:
          key === 'w'
            ? { width: read.cm, outside: outside.map((item) => item.id) }
            : { width: now.plan.room?.w ?? read.cm, outside: outside.map((item) => item.id) },
      }));
      return say(SW.shrinkRefused, {
        n: outside.length,
        width: lengthOf(next.w, ui.units),
        length: lengthOf(next.l, ui.units),
      });
    }
    commit(null, (plan) => ({ ...plan, room: next }), { shrink: null });
    return null;
  }

  return (
    <>
      <BackHead title={SW.roomSettings} line={SW.appliesOnLeave} onClose={() => open(null)} />
      <Field
        fieldKey="roomName"
        label={SW.roomName}
        optional
        value={room.name}
        onCommit={(text) => {
          commit(null, (plan) => ({
            ...plan,
            room: { ...room, name: text.trim() === '' ? room.name : text.trim() },
          }));
          return null;
        }}
      />
      <Two>
        <Field
          fieldKey="roomWidth"
          label={SW.width}
          unit={ui.units === 'us' ? undefined : 'm'}
          value={ui.units === 'us' ? lengthOf(room.w, 'us') : String(room.w / 100)}
          onCommit={(text) => resize('w', text)}
        />
        <Field
          fieldKey="roomLength"
          label={SW.length}
          unit={ui.units === 'us' ? undefined : 'm'}
          value={ui.units === 'us' ? lengthOf(room.l, 'us') : String(room.l / 100)}
          onCommit={(text) => resize('l', text)}
        />
      </Two>
      <div className="st-red">
        <TextAction label={SW.deletePlan} red onClick={() => ask({ kind: 'deletePlan' })} />
        <Line>{SW.deletePlanLine}</Line>
      </div>
    </>
  );
}

function SectionForm({ id }: { id: string | null }) {
  const { ui, commit, open, ask, set } = useSeating();
  const plan = ui.plan;
  const section = id == null ? null : plan.sections.find((one) => one.id === id);
  const [colour, setColour] = useState<Colour>(section?.colour ?? leastUsed(plan.sections));
  const nameRef = useRef('');
  const group = useId();

  function refusal(text: string): string | null {
    const name = text.trim();

    if (name === '') return SW.sectionBlank;
    if (plan.sections.some((one) => one.id !== id && sameName(one.name, name)))
      return say(SW.sectionTaken, { name });
    return null;
  }

  function add(): void {
    const field = document.querySelector<HTMLInputElement>('[data-focus="sectionName"]');
    const name = (field?.value ?? nameRef.current).trim();
    const refused = refusal(name);

    if (refused != null) {
      commitRefusal(refused, name);
      return;
    }
    commit(
      null,
      (now) => ({
        ...now,
        sections: [...now.sections, { id: `sec-${now.sections.length + 1}-${name}`, name, colour }],
      }),
      { panel: null },
    );
  }

  function commitRefusal(refused: string, value: string): void {
    set((now) => ({ ...now, seed: { key: 'sectionName', value, error: refused } }));
    window.setTimeout(
      () => document.querySelector<HTMLElement>('[data-focus="sectionName"]')?.focus(),
      0,
    );
  }

  return (
    <>
      <BackHead title={section?.name ?? SW.addASection} onClose={() => open(null)} />
      {section != null && <Line>{SW.appliesOnLeaveOrPick}</Line>}
      <Field
        key={ui.seed?.key === 'sectionName' ? `${ui.seed.value}|${ui.seed.error ?? ''}` : 'name'}
        fieldKey="sectionName"
        label={SW.name}
        value={section?.name ?? ''}
        maxLength={40}
        onCommit={(text) => {
          nameRef.current = text;
          if (section == null) return null;
          const refused = refusal(text);

          if (refused == null)
            commit(null, (now) => ({
              ...now,
              sections: now.sections.map((one) =>
                one.id === section.id ? { ...one, name: text.trim() } : one,
              ),
            }));
          return refused;
        }}
      />
      <fieldset className="st-colours">
        <legend className="st-label">{SW.colour}</legend>
        {COLOURS.map((one) => (
          <label key={one} className="st-colour">
            <input
              type="radio"
              name={group}
              checked={colour === one}
              onChange={() => {
                setColour(one);
                if (section != null)
                  commit(null, (now) => ({
                    ...now,
                    sections: now.sections.map((each) =>
                      each.id === section.id ? { ...each, colour: one } : each,
                    ),
                  }));
              }}
            />
            <Swatch colour={one} size={16} />
            {one}
          </label>
        ))}
      </fieldset>
      {section == null ? (
        <div className="st-pair">
          <button type="button" className="button" onClick={() => open(null)}>
            {SW.cancel}
          </button>
          <button type="button" className="button button-primary" onClick={add}>
            {SW.addSection}
          </button>
        </div>
      ) : (
        <div className="st-red">
          <TextAction
            label={SW.deleteSectionDots}
            red
            onClick={() => ask({ kind: 'deleteSection', id: section.id })}
          />
          <Line>{SW.sectionStays}</Line>
        </div>
      )}
    </>
  );
}

const SHAPES: readonly ('round' | 'rect' | 'head' | 'cocktail')[] = [
  'round',
  'rect',
  'head',
  'cocktail',
];

function sectionOptions(plan: Plan) {
  return [
    ...plan.sections.map((one) => ({ value: one.id, word: one.name })),
    { value: '', word: SW.noSection },
  ];
}

function rotations() {
  return Array.from({ length: 24 }, (_, index) => ({
    value: String(index * 15),
    word: `${index * 15}°`,
  }));
}

function Notice() {
  const { ui } = useSeating();

  if (ui.notice == null) return null;
  return <Said tone={ui.notice.tone}>{ui.notice.words}</Said>;
}

function PlaceFields({ item }: { item: Item }) {
  const { ui, edit } = useSeating();
  const room = ui.plan.room!;
  const units = ui.units;

  function place(axis: 'x' | 'y', text: string): string | null {
    const cm = readPlace(text, units);

    if (cm == null) return say(SW.outside, { name: item.name });
    const at = axis === 'x' ? { x: Math.round(cm) } : { y: Math.round(cm) };

    if (!inside({ ...item, ...at }, room)) return say(SW.outside, { name: item.name });
    edit(item.id, at);
    return null;
  }

  return (
    <>
      <Two>
        <Field
          fieldKey="across"
          label={SW.across}
          value={lengthOf(item.x, units)}
          onCommit={(text) => place('x', text)}
        />
        <Field
          fieldKey="down"
          label={SW.down}
          value={lengthOf(item.y, units)}
          onCommit={(text) => place('y', text)}
        />
      </Two>
      {units === 'us' && <Line>{SW.usHint}</Line>}
    </>
  );
}

function nameRefusal(plan: Plan, item: Item, name: string): string | null {
  if (name.trim() === '') return null;
  if (!plan.items.some((other) => other.id !== item.id && sameName(other.name, name))) return null;
  return say(item.kind === 'single' ? SW.seatTaken : SW.tableTaken, { name: name.trim() });
}

function TableFields({ item }: { item: Item }) {
  const { ui, edit } = useSeating();
  const plan = ui.plan;
  const units = ui.units;
  const round = item.kind === 'round' || item.kind === 'cocktail';
  const unit = units === 'us' ? undefined : 'cm';

  function seats(text: string): string | null {
    const n = readCount(text);

    if (n == null || n < 1) return null;
    const keep = keepSeats(item);

    if (n < keep) return say(SW.belowSeated, { n: filled(item), m: keep });
    edit(item.id, withSeats(item, n));
    return null;
  }

  function size(key: 'd' | 'w' | 'l', text: string): string | null {
    const cm = readSize(text, units);

    if (cm == null || cm < 40) return null;
    edit(item.id, { [key]: Math.round(cm) });
    return null;
  }

  return (
    <div className="st-stack is-tight">
      <TitleBlock title={item.name} line={itemLine(plan, item)} />
      <Notice />
      {ui.note != null && <Line tone="ink">{ui.note}</Line>}
      {squeezed(item) && <Said tone="amber">{squeezeWords(item)}</Said>}
      <Field
        fieldKey="name"
        label={SW.name}
        value={item.name}
        onCommit={(text) => {
          const refused = nameRefusal(plan, item, text);

          if (refused == null && text.trim() !== '') edit(item.id, { name: text.trim() });
          return refused;
        }}
      />
      <Two>
        <Select
          fieldKey="section"
          label={SW.section}
          value={item.sec ?? ''}
          options={sectionOptions(plan)}
          onPick={(value) => edit(item.id, { sec: value === '' ? null : value })}
        />
        <Select
          fieldKey="shape"
          label={SW.shape}
          value={item.kind}
          options={SHAPES.map((kind) => ({ value: kind, word: shapeShort(kind) }))}
          onPick={(value) => {
            const { item: next, note } = reshaped(item, value as (typeof SHAPES)[number]);

            edit(item.id, next, { note });
          }}
        />
      </Two>
      {round ? (
        <Two>
          <Field
            fieldKey="seats"
            label={item.kind === 'cocktail' ? SW.places : SW.seats}
            value={String(item.chairs.length)}
            onCommit={seats}
          />
          <Field
            fieldKey="diameter"
            label={SW.diameter}
            unit={unit}
            value={sizeOf(item.d ?? 180, units)}
            onCommit={(text) => size('d', text)}
          />
        </Two>
      ) : (
        <>
          <Two>
            <Field
              fieldKey="width"
              label={SW.width}
              unit={unit}
              value={sizeOf(item.w ?? 180, units)}
              onCommit={(text) => size('w', text)}
            />
            <Field
              fieldKey="length"
              label={SW.length}
              unit={unit}
              value={sizeOf(item.l ?? 76, units)}
              onCommit={(text) => size('l', text)}
            />
          </Two>
          <Two>
            <Field
              fieldKey="seats"
              label={SW.seats}
              value={String(item.chairs.length)}
              onCommit={seats}
            />
            <Field
              fieldKey="ends"
              label={SW.ends}
              value={String(item.ends ?? 0)}
              onCommit={(text) => {
                const n = readCount(text);

                if (n != null && n <= item.chairs.length) edit(item.id, { ends: n });
                return null;
              }}
            />
          </Two>
          <Line>{endsLine(item)}</Line>
        </>
      )}
      <PlaceFields item={item} />
      {turns(item) && (
        <Select
          fieldKey="rotation"
          label={SW.rotation}
          value={String(item.rot)}
          options={rotations()}
          onPick={(value) => edit(item.id, { rot: Number(value) })}
        />
      )}
      <Overlaps item={item} />
      <Colleague item={item} />
      <Actions item={item} />
    </div>
  );
}

function Overlaps({ item }: { item: Item }) {
  const { ui } = useSeating();
  const over = ui.plan.items.filter((other) => other.id !== item.id && overlapping(item, other));

  return over.length === 0 ? null : (
    <Said tone="amber">{say(SW.overlaps, { name: over.map((one) => one.name).join(', ') })}</Said>
  );
}

function Colleague({ item }: { item: Item }) {
  const { ui } = useSeating();
  const ring = ui.rings[item.id];

  if (ring == null || ring.viewer || !ui.chosen.includes(item.id)) return null;
  return (
    <div className="st-colleague">
      <span className={`st-face p${ring.tone} is-24`} aria-hidden="true">
        {ring.initials}
      </span>
      <p>{say(SW.choseToo, { name: ring.name })}</p>
    </div>
  );
}

function RowFields({ item }: { item: Item }) {
  const { ui, edit, set } = useSeating();
  const plan = ui.plan;
  const chosen = ui.chair?.id === item.id ? ui.chair.i : null;
  const units = ui.units;

  function seats(text: string): string | null {
    const n = readCount(text);

    if (n == null || n < 1) return null;
    const keep = keepSeats(item);

    if (n < keep)
      return say(SW.rowBelowSeated, {
        name: item.chairs[keep - 1]?.who ?? SW.taken,
        n: keep,
        m: keep,
      });
    edit(item.id, withSeats(item, n));
    return null;
  }

  return (
    <div className="st-stack is-tight">
      <TitleBlock title={item.name} line={itemLine(plan, item)} />
      <Notice />
      <Line>{SW.faces}</Line>
      <SeatStrip
        item={item}
        chosen={chosen}
        onPick={(i) => set((now) => ({ ...now, chair: i === chosen ? null : { id: item.id, i } }))}
      />
      {chosen != null && <ChosenSeat item={item} index={chosen} />}
      <Two>
        <Field
          fieldKey="label"
          label={SW.label}
          value={item.label ?? ''}
          onCommit={(text) => {
            const label = text.trim().toUpperCase();

            if (label === '') return null;
            if (
              plan.items.some(
                (other) =>
                  other.id !== item.id &&
                  other.kind === 'row' &&
                  sameName(other.label ?? '', label),
              )
            )
              return say(SW.rowTaken, { label });
            edit(item.id, { label, name: `Row ${label}` });
            return null;
          }}
        />
        <Select
          fieldKey="section"
          label={SW.section}
          value={item.sec ?? ''}
          options={sectionOptions(plan)}
          onPick={(value) => edit(item.id, { sec: value === '' ? null : value })}
        />
      </Two>
      <Two>
        <Field
          fieldKey="seats"
          label={SW.seats}
          value={String(item.chairs.length)}
          onCommit={seats}
        />
        <Field
          fieldKey="spacing"
          label={SW.spacing}
          unit={units === 'us' ? undefined : 'cm'}
          value={sizeOf(item.spacing ?? 50, units)}
          onCommit={(text) => {
            const cm = readSize(text, units);

            if (cm != null && cm >= 44) edit(item.id, { spacing: Math.round(cm) });
            return null;
          }}
        />
      </Two>
      <PlaceFields item={item} />
      <Select
        fieldKey="rotation"
        label={SW.rotation}
        value={String(item.rot)}
        options={rotations()}
        onPick={(value) => edit(item.id, { rot: Number(value) })}
      />
      <Overlaps item={item} />
      <Actions item={item} />
    </div>
  );
}

function SeatStrip({
  item,
  chosen,
  onPick,
}: {
  item: Item;
  chosen: number | null;
  onPick: (index: number) => void;
}) {
  const shown = 5;
  const first = chosen != null && chosen >= shown ? chosen - shown + 1 : 0;

  return (
    <div className="st-strip">
      {item.chairs.slice(first, first + shown).map((chair, offset) => {
        const index = first + offset;

        return (
          <button
            key={index}
            type="button"
            className={index === chosen ? 'st-strip-seat is-on' : 'st-strip-seat'}
            aria-pressed={index === chosen}
            aria-label={`${say(SW.chairTitle, { table: item.name, n: index + 1 })}, ${chairWord(chair)}`}
            onClick={() => onPick(index)}
          >
            <StateMark chair={chair} size={26} />
            <span>{index + 1}</span>
          </button>
        );
      })}
      {item.chairs.length > first + shown && (
        <span className="st-strip-more">
          {say(SW.toTheRight, { n: item.chairs.length - first - shown })}
        </span>
      )}
    </div>
  );
}

function ChosenSeat({ item, index }: { item: Item; index: number }) {
  const { markChair, ui } = useSeating();
  const chair = item.chairs[index] ?? { state: 'empty' };
  const word =
    chair.state === 'taken' && chair.who != null
      ? say(SW.takenBy, { name: chair.who })
      : stateWord(chair.state);

  return (
    <div className="st-block">
      <p className="st-strong">
        {say(SW.rowSeat, { label: item.label ?? '', n: index + 1, word })}
      </p>
      {!ui.readOnly && (
        <Acts>
          <TextAction
            label={chair.state === 'unusable' ? SW.markUsable : SW.markUnusable}
            onClick={() => markChair(item.id, index)}
          />
        </Acts>
      )}
    </div>
  );
}

function SingleFields({ item }: { item: Item }) {
  const { ui, edit, markChair, ask } = useSeating();
  const plan = ui.plan;
  const chair = item.chairs[0] ?? { state: 'empty' };

  return (
    <div className="st-stack is-tight">
      <TitleBlock
        title={item.name}
        line={say(SW.singleLine, { section: sectionName(plan, item) })}
      />
      <Notice />
      <Field
        fieldKey="name"
        label={SW.name}
        value={item.name}
        onCommit={(text) => {
          const refused = nameRefusal(plan, item, text);

          if (refused == null && text.trim() !== '') edit(item.id, { name: text.trim() });
          return refused;
        }}
      />
      <Select
        fieldKey="section"
        label={SW.section}
        value={item.sec ?? ''}
        options={sectionOptions(plan)}
        onPick={(value) => edit(item.id, { sec: value === '' ? null : value })}
      />
      <div className="st-block">
        <p className="st-state-line">
          <StateMark chair={chair} size={22} />
          {chair.state === 'taken' ? SW.taken : stateWord(chair.state)}
        </p>
        <Acts>
          <TextAction
            label={chair.state === 'unusable' ? SW.markUsable : SW.markUnusable}
            onClick={() => markChair(item.id, 0)}
          />
        </Acts>
      </div>
      <PlaceFields item={item} />
      <Overlaps item={item} />
      <Acts>
        <TextAction
          label={SW.deleteSeat}
          red
          onClick={() => ask({ kind: 'deleteItems', ids: [item.id] })}
        />
      </Acts>
    </div>
  );
}

function ChairFields({ item, index }: { item: Item; index: number }) {
  const { ui, markChair } = useSeating();
  const chair = item.chairs[index] ?? { state: 'empty' };

  return (
    <div className="st-stack">
      <TitleBlock
        title={say(SW.chairTitle, { table: item.name, n: index + 1 })}
        line={`${shapeWord(item)} · ${sectionName(ui.plan, item)}`}
      />
      <p className="st-state-line is-big">
        <StateMark chair={chair} size={22} />
        {chairWord(chair)}
      </p>
      {!ui.readOnly && (
        <Acts>
          <TextAction
            label={chair.state === 'unusable' ? SW.markUsable : SW.markUnusable}
            onClick={() => markChair(item.id, index)}
          />
        </Acts>
      )}
      <Notice />
      <Legend />
    </div>
  );
}

function Several({ items }: { items: Item[] }) {
  const { ask } = useSeating();

  return (
    <div className="st-stack">
      <TitleBlock title={say(SW.chosen, { n: items.length })} line={SW.moveTogether} />
      <ul className="st-rows is-dense">
        {items.map((item) => (
          <li key={item.id} className="st-row is-dense">
            <ShapeTile kind={item.kind} />
            <span className="st-row-name">{item.name}</span>
          </li>
        ))}
      </ul>
      <Line>{SW.shiftClick}</Line>
      <Acts>
        <TextAction
          label={SW.deleteThese}
          red
          onClick={() => ask({ kind: 'deleteItems', ids: items.map((item) => item.id) })}
        />
      </Acts>
    </div>
  );
}

export function ShapeTile({ kind, size = 36 }: { kind: Kind; size?: 32 | 36 | 40 }) {
  return (
    <span className={`st-shape-tile is-${size}`} aria-hidden="true">
      <Icon
        name={
          (
            {
              round: 'round',
              rect: 'rect',
              head: 'head',
              cocktail: 'cocktail',
              row: 'row',
              single: 'seat1',
            } as const
          )[kind]
        }
        size={size === 32 ? 20 : 22}
        weight={1.9}
      />
    </span>
  );
}

function ReadFacts({ item }: { item: Item }) {
  const { ui } = useSeating();
  const units = ui.units;
  const facts: [string, string][] = [
    [SW.section, sectionName(ui.plan, item)],
    [SW.shape, shapeWord(item)],
    [item.kind === 'cocktail' ? SW.places : SW.seats, String(item.chairs.length)],
    ...(item.d != null
      ? ([[SW.diameter, `${sizeOf(item.d, units)}${units === 'us' ? '' : ' cm'}`]] as [
          string,
          string,
        ][])
      : []),
    ...(item.w != null
      ? ([[SW.width, `${sizeOf(item.w, units)}${units === 'us' ? '' : ' cm'}`]] as [
          string,
          string,
        ][])
      : []),
    [SW.across, lengthOf(item.x, units)],
    [SW.down, lengthOf(item.y, units)],
  ];

  return (
    <div className="st-stack">
      <TitleBlock title={item.name} line={itemLine(ui.plan, item)} />
      <dl className="st-facts">
        {facts.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Line>{SW.readOnly}</Line>
    </div>
  );
}

function Tray({ chips = true }: { chips?: boolean }) {
  const { ui, set, pick } = useSeating();
  const coming = ui.tray.filter((party) => party.reply === 'coming');
  const count = coming.reduce((sum, party) => sum + peopleIn(party), 0);
  const unsure = ui.tray
    .filter((party) => party.reply !== 'coming')
    .reduce((sum, party) => sum + peopleIn(party), 0);
  const shown = shownParties(ui);
  const groups = [...GROUP_ORDER, SW.noGroup]
    .map((group) => ({
      group,
      n: ui.tray
        .filter(
          (party) =>
            (ui.unsure || party.reply === 'coming') && (party.group ?? SW.noGroup) === group,
        )
        .reduce((sum, party) => sum + peopleIn(party), 0),
    }))
    .filter((one) => one.n > 0);

  return (
    <div className="st-stack is-tray">
      <div className="st-switch-row">
        <span id="st-unsure">{SW.showUnsure}</span>
        <button
          type="button"
          role="switch"
          className="ev-switch"
          aria-checked={ui.unsure}
          aria-labelledby="st-unsure"
          onClick={() => set((now) => ({ ...now, unsure: !now.unsure }))}
        >
          <span className="ev-track" aria-hidden="true">
            <span className="ev-knob" />
          </span>
        </button>
      </div>
      <div className="st-tray-head">
        <h2 id="st-without">{SW.withoutSeat}</h2>
        <span className="st-tray-count">{count}</span>
      </div>
      {ui.unsure && unsure > 0 && (
        <p className="st-line is-strong">{say(SW.moreUnsure, { n: unsure })}</p>
      )}
      {count === 0 && !ui.unsure ? (
        <Line>{SW.everyoneSeated}</Line>
      ) : (
        <>
          <div className="st-search">
            <Icon name="search" size={16} />
            <input
              type="search"
              aria-label={SW.search}
              placeholder={SW.search}
              value={ui.search}
              onChange={(event) => set((now) => ({ ...now, search: event.target.value }))}
            />
          </div>
          {chips && (
            <div className="st-chips">
              {groups.map(({ group, n }) => (
                <button
                  key={group}
                  type="button"
                  role="checkbox"
                  aria-checked={ui.groups.includes(group)}
                  className={ui.groups.includes(group) ? 'st-chip is-on' : 'st-chip'}
                  onClick={() =>
                    set((now) => ({
                      ...now,
                      groups: now.groups.includes(group)
                        ? now.groups.filter((one) => one !== group)
                        : [...now.groups, group],
                    }))
                  }
                >
                  {say(SW.groupCount, { group, n })}
                </button>
              ))}
            </div>
          )}
          {shown.length === 0 ? (
            <div className="st-block">
              <p className="st-strong">{SW.noMatch}</p>
              <Acts>
                <TextAction
                  label={SW.clearSearch}
                  onClick={() => set((now) => ({ ...now, search: '', groups: [] }))}
                />
              </Acts>
            </div>
          ) : (
            <ul className="st-rows" aria-labelledby="st-without">
              {shown.map((party) => (
                <li key={party.id} className="st-party-line">
                  <button
                    type="button"
                    className={ui.picked === party.id ? 'st-party is-on' : 'st-party'}
                    aria-pressed={ui.picked === party.id}
                    disabled={ui.readOnly}
                    onClick={() => pick(ui.picked === party.id ? null : party.id)}
                  >
                    <span className="st-avatar" aria-hidden="true">
                      {initials(party.name)}
                    </span>
                    <span className="st-row-words">
                      <span className="st-row-name">{partyTitle(party)}</span>
                      <span className="st-row-line">
                        {[
                          party.group ?? SW.noGroup,
                          party.reply === 'notSure'
                            ? SW.notSureYet
                            : party.reply === 'noReply'
                              ? SW.noReply
                              : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function TableGuests({ item }: { item: Item }) {
  const { ui, unseatAll, set, focusField } = useSeating();
  const empty = filled(item) === 0;

  return (
    <div className="st-stack">
      <TitleBlock title={item.name} line={itemLine(ui.plan, item)} />
      {empty ? (
        <>
          <Line>{SW.emptyTable}</Line>
          <Tray chips={false} />
        </>
      ) : (
        <>
          <ul className="st-rows is-dense">
            {item.chairs.map((chair, index) => (
              <li key={index} className="st-row is-dense">
                <StateMark chair={chair} size={22} />
                <span className="st-row-words">
                  <span className="st-row-name">{say(SW.seatN, { n: index + 1 })}</span>
                  <span className="st-row-line">{chairWord(chair)}</span>
                </span>
              </li>
            ))}
          </ul>
          {!ui.readOnly && (
            <Acts>
              <TextAction label={SW.unseatAll} onClick={() => unseatAll(item.id)} />
              <TextAction
                label={SW.moveAll}
                onClick={() => set((now) => ({ ...now, pop: { kind: 'moveAll', table: item.id } }))}
              />
              <TextAction
                label={SW.rename}
                onClick={() => {
                  set((now) => ({ ...now, tab: 'arrange' }));
                  focusField('name');
                }}
              />
            </Acts>
          )}
        </>
      )}
    </div>
  );
}

export function SeatingPanel() {
  const { ui, set } = useSeating();
  const plan = ui.plan;
  const chosen = ui.chosen
    .map((id) => plan.items.find((item) => item.id === id))
    .filter((item): item is Item => item != null);
  const chair = ui.chair == null ? null : plan.items.find((item) => item.id === ui.chair?.id);
  const tabs: readonly ['arrange' | 'seat', string][] = [
    ['arrange', SW.arrange],
    ['seat', SW.seat],
  ];
  let body: ReactNode;

  if (ui.tab === 'seat') {
    const table = chosen.length === 1 && ui.picked == null ? chosen[0] : undefined;

    body = table != null && table.kind !== 'single' ? <TableGuests item={table} /> : <Tray />;
  } else if (ui.panel?.kind === 'start') body = <StartForm />;
  else if (ui.panel?.kind === 'room') body = <RoomSettings />;
  else if (ui.panel?.kind === 'sectionAdd')
    body = (
      <>
        <RoomHead readOnly={false} />
        <SectionForm id={null} />
      </>
    );
  else if (ui.panel?.kind === 'sectionEdit')
    body = <SectionForm key={ui.panel.id} id={ui.panel.id} />;
  else if (chair != null && ui.chair != null && chair.kind !== 'row')
    body = <ChairFields item={chair} index={ui.chair.i} />;
  else if (chosen.length > 1) body = <Several items={chosen} />;
  else if (chosen.length === 1 && chosen[0] != null) {
    const item = chosen[0];

    body = ui.readOnly ? (
      <ReadFacts item={item} />
    ) : item.kind === 'row' ? (
      <RowFields key={item.id} item={item} />
    ) : item.kind === 'single' ? (
      <SingleFields key={item.id} item={item} />
    ) : (
      <TableFields key={item.id} item={item} />
    );
  } else body = <NothingChosen />;

  return (
    <aside className="st-panel" aria-label={SW.panel}>
      <div className="st-tabs" role="tablist" aria-label={SW.panel}>
        {tabs.map(([tab, word]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`st-tab-${tab}`}
            aria-selected={ui.tab === tab}
            aria-controls="st-panel-body"
            className={ui.tab === tab ? 'st-tab is-on' : 'st-tab'}
            onClick={() => set((now) => ({ ...now, tab }))}
          >
            {word}
          </button>
        ))}
      </div>
      <div
        className="st-panel-body"
        id="st-panel-body"
        role="tabpanel"
        aria-labelledby={`st-tab-${ui.tab}`}
      >
        {body}
      </div>
    </aside>
  );
}
