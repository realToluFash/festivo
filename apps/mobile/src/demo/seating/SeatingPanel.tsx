import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { OnOffSwitch } from '../../components/OnOffSwitch.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { Avatar, Pill } from '../../components/SettingsParts.tsx';
import { Row, RowList, TextAction } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import type { Action } from './SeatingActs.ts';
import { filled, free, overlapping } from './SeatingGeometry.ts';
import {
  type Seating,
  chairWord,
  editable,
  groupCounts,
  hexOf,
  isTable,
  itemOf,
  length,
  noSectionLine,
  partySize,
  partyWho,
  roomLine,
  sectionName,
  sectionOf,
  sectionRowLine,
  shapeChoice,
  shapeWord,
  titleLine,
  trayCount,
  trayShown,
} from './SeatingModel.ts';
import { FieldBox, Notice, SelectBox, StateMark, Swatch } from './SeatingParts.tsx';
import {
  COLOURS,
  type ChairState,
  type Item,
  NOT_SURE_OR_NO_REPLY,
  NOT_YET,
  ORG,
  type Party,
  VENUE,
} from './SeatingSample.ts';
import { W, say } from './SeatingWords.ts';

type Go = (action: Action) => void;

function Title({ title, line }: { title: string; line?: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text size={20} weight="bold" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {line != null && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.line]}>
          {line}
        </Text>
      )}
    </View>
  );
}

function Head({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.head}>
      <Text size={17} weight="bold" accessibilityRole="header" style={styles.grow}>
        {title}
      </Text>
      {right}
    </View>
  );
}

function BackHead({
  title,
  line,
  onClose,
}: {
  title: string;
  line?: string | undefined;
  onClose: () => void;
}) {
  return (
    <View style={styles.titleBlock}>
      <View style={styles.head}>
        <Text
          size={20}
          weight="bold"
          accessibilityRole="header"
          style={[styles.grow, styles.title]}
        >
          {title}
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={W.close}
          testID="seating.panel.close"
        >
          <Glyph name="x" size={18} ink={tokens.colorInk} weight={2.4} />
        </Pressable>
      </View>
      {line != null && (
        <Text size={14} weight="medium" style={[styles.secondary, styles.line]}>
          {line}
        </Text>
      )}
    </View>
  );
}

function Two({ children }: { children: ReactNode }) {
  return <View style={styles.two}>{children}</View>;
}

function Half({ children }: { children: ReactNode }) {
  return <View style={styles.half}>{children}</View>;
}

function Small({ text }: { text: string }) {
  return (
    <Text size={13} weight="medium" style={[styles.secondary, styles.small]}>
      {text}
    </Text>
  );
}

const LEGEND: readonly ChairState[] = ['taken', 'held', 'empty', 'unusable'];
const STATE_WORD: Record<ChairState, string> = {
  taken: W.taken,
  held: W.held,
  empty: W.empty,
  unusable: W.unusable,
};

export function Legend() {
  return (
    <View style={styles.legend}>
      {LEGEND.map((state) => (
        <View key={state} style={styles.legendItem}>
          <StateMark state={state} side={16} />
          <Text size={13} weight="medium" style={styles.secondary}>
            {STATE_WORD[state]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Sections({ m, go }: { m: Seating; go: Go }) {
  const write = editable(m);
  const rows = [
    ...m.sections.map((s) => ({
      key: s.key,
      inset: 32,
      row: (
        <Row
          title={s.name}
          line={sectionRowLine(m, s.key)}
          lead={<Swatch hex={hexOf(s.colour)} />}
          trail={
            write ? (
              <TextAction
                label={W.edit}
                onPress={() => go({ type: 'arrange', shows: 'sectionEdit', key: s.key })}
                accessibilityLabel={`${W.edit} ${s.name}`}
                testID={`seating.section.${s.key}.edit`}
              />
            ) : undefined
          }
        />
      ),
    })),
    {
      key: 'none',
      inset: 32,
      row: <Row title={W.noSection} line={noSectionLine(m)} lead={<Swatch hex={null} />} />,
    },
  ];
  return (
    <View>
      <Head
        title={m.arrange === 'sectionLimit' ? say.sectionsCount(m.sections.length) : W.sections}
        right={
          write ? (
            <TextAction
              label={W.addSection}
              glyph="plus"
              onPress={() => go({ type: 'arrange', shows: 'sectionAdd' })}
              testID="seating.section.add"
            />
          ) : undefined
        }
      />
      {m.sections.length === 0 ? <Small text={W.noSections} /> : <RowList items={rows} />}
    </View>
  );
}

function NothingChosen({ m, go }: { m: Seating; go: Go }) {
  const write = editable(m);
  return (
    <>
      {m.arrange === 'sectionLimit' && <Notice words={W.sectionLimit} tone="red" />}
      <View>
        <Head
          title={W.room}
          right={
            write ? (
              <TextAction
                label={W.roomSettings}
                onPress={() => go({ type: 'arrange', shows: 'roomSettings' })}
                testID="seating.roomSettings"
              />
            ) : undefined
          }
        />
        <Text size={15} weight="medium" style={styles.secondary}>
          {roomLine(m)}
        </Text>
      </View>
      {m.readOnly ? (
        <Small text={W.readOnly} />
      ) : (
        <View style={styles.switchRow}>
          <Text size={15} weight="semibold" style={styles.grow}>
            {W.snap}
          </Text>
          <OnOffSwitch
            on={m.snap}
            words={{ on: W.on, off: W.off }}
            label={W.snap}
            disabled={!write}
            onChange={() => go({ type: 'snap' })}
            testID="seating.snap"
          />
        </View>
      )}
      <Sections m={m} go={go} />
      <Legend />
    </>
  );
}

function StartForm({ m, go }: { m: Seating; go: Go }) {
  const s = m.start;
  return (
    <>
      <Title
        title={W.startPlan}
        line={
          m.units === 'us'
            ? say.startLineFeet(VENUE.name, VENUE.town)
            : say.startLine(VENUE.name, VENUE.town, ORG)
        }
      />
      <FieldBox
        label={W.roomName}
        optional
        value={s.name}
        onText={(text) => go({ type: 'startDraft', key: 'name', text })}
        onDone={() => undefined}
        testID="seating.start.name"
      />
      <Two>
        <Half>
          <FieldBox
            label={W.width}
            unit={m.units === 'us' ? 'ft' : 'm'}
            numbers
            value={s.width}
            error={s.errors.width || null}
            onText={(text) => go({ type: 'startDraft', key: 'width', text })}
            onDone={() => undefined}
            testID="seating.start.width"
          />
        </Half>
        <Half>
          <FieldBox
            label={W.length}
            unit={m.units === 'us' ? 'ft' : 'm'}
            numbers
            value={s.length}
            error={s.errors.length || null}
            focus={s.errors.length != null && s.errors.length !== ''}
            onText={(text) => go({ type: 'startDraft', key: 'length', text })}
            onDone={() => undefined}
            testID="seating.start.length"
          />
        </Half>
      </Two>
      <Pill
        label={W.startPlan}
        height={tokens.sizeHit}
        onPress={() => go({ type: 'startPlan' })}
        testID="seating.start.go"
      />
    </>
  );
}

function RoomSettings({ m, go }: { m: Seating; go: Go }) {
  const d = m.roomDraft;
  const apply = () => go({ type: 'roomApply' });
  return (
    <>
      <BackHead
        title={W.roomSettings}
        line={W.appliesOnLeave}
        onClose={() => go({ type: 'arrange', shows: 'room' })}
      />
      {m.fields.changedBy != null && <Notice words={m.fields.changedBy} tone="amber" />}
      <FieldBox
        label={W.roomName}
        optional
        value={d.name}
        onText={(text) => go({ type: 'roomDraft', key: 'name', text })}
        onDone={apply}
        testID="seating.room.name"
      />
      <Two>
        <Half>
          <FieldBox
            label={W.width}
            unit={m.units === 'us' ? undefined : 'm'}
            numbers
            value={d.width}
            onText={(text) => go({ type: 'roomDraft', key: 'width', text })}
            onDone={apply}
            testID="seating.room.width"
          />
        </Half>
        <Half>
          <FieldBox
            label={W.length}
            unit={m.units === 'us' ? undefined : 'm'}
            numbers
            value={d.length}
            onText={(text) => go({ type: 'roomDraft', key: 'length', text })}
            onDone={apply}
            testID="seating.room.length"
          />
        </Half>
      </Two>
      {d.error != null && <Notice words={d.error} tone="red" />}
      <TextAction
        label={W.deletePlan}
        removes
        consequence={W.deletePlanLine}
        onPress={() => go({ type: 'ask', ask: { kind: 'deletePlan' } })}
        testID="seating.deletePlan"
      />
    </>
  );
}

function ColourGrid({
  on,
  onPick,
}: {
  on: string;
  onPick: (colour: (typeof COLOURS)[number][0]) => void;
}) {
  return (
    <View style={styles.colours} accessibilityRole="radiogroup">
      {COLOURS.map(([name, hex]) => (
        <Pressable
          key={name}
          onPress={() => onPick(name)}
          style={styles.colour}
          accessibilityRole="radio"
          accessibilityState={{ checked: name === on }}
          accessibilityLabel={name}
          testID={`seating.colour.${name}`}
        >
          <RadioMark on={name === on} />
          <Swatch hex={hex} side={16} />
          <Text size={15} weight={name === on ? 'semibold' : 'medium'} accessible={false}>
            {name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionForm({ m, go }: { m: Seating; go: Go }) {
  const f = m.sectionForm;
  const adding = m.arrange === 'sectionAdd';
  const section = sectionOf(m, m.sectionKey);
  return (
    <>
      <BackHead
        title={adding ? W.addSection : (section?.name ?? W.addSection)}
        line={adding ? undefined : W.appliesOnLeaveOrColour}
        onClose={() => go({ type: 'arrange', shows: 'room' })}
      />
      <FieldBox
        label={W.name}
        value={f.name}
        error={f.error}
        focus={adding}
        onText={(name) => go({ type: 'sectionName', name })}
        onDone={() => (adding ? undefined : go({ type: 'sectionApply' }))}
        testID="seating.section.name"
      />
      <Text size={tokens.typeButton.size} weight="medium">
        {W.colour}
      </Text>
      <ColourGrid on={f.colour} onPick={(colour) => go({ type: 'sectionColour', colour })} />
      {adding ? (
        <View style={styles.pair}>
          <Pill
            label={W.cancel}
            kind="secondary"
            full={false}
            height={tokens.sizeHit}
            onPress={() => go({ type: 'arrange', shows: 'room' })}
            testID="seating.section.cancel"
          />
          <Pill
            label={W.addSectionVerb}
            full={false}
            height={tokens.sizeHit}
            onPress={() => go({ type: 'sectionAdd' })}
            testID="seating.section.submit"
          />
        </View>
      ) : (
        <TextAction
          label={W.deleteSectionOpener}
          removes
          consequence={W.sectionStays}
          onPress={() =>
            go({ type: 'ask', ask: { kind: 'deleteSection', key: m.sectionKey ?? '' } })
          }
          testID="seating.section.delete"
        />
      )}
    </>
  );
}

function Facts({ m, it }: { m: Seating; it: Item }) {
  const facts: [string, string][] = [
    [W.section, sectionName(m, it)],
    [W.shape, shapeWord(it)],
    [W.seats, String(it.chairs.length)],
    ...(it.kind === 'round' || it.kind === 'cocktail'
      ? ([[W.diameter, m.units === 'us' ? length(m, it.d) : `${it.d} cm`]] as [string, string][])
      : []),
    [W.across, length(m, it.x)],
    [W.down, length(m, it.y)],
  ];
  return (
    <View>
      {facts.map(([key, value]) => (
        <View key={key} style={styles.fact} accessible accessibilityLabel={`${key}, ${value}`}>
          <Text
            size={14.5}
            weight="medium"
            accessible={false}
            style={[styles.grow, styles.secondary]}
          >
            {key}
          </Text>
          <Text size={15} weight="semibold" accessible={false}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function fieldsOf(m: Seating, go: Go, it: Item) {
  const us = m.units === 'us';
  const off = !editable(m);
  return function field(key: string, label: string, value: string, unit?: string) {
    return (
      <FieldBox
        label={label}
        value={m.fields.drafts[key] ?? value}
        unit={us ? undefined : unit}
        numbers={key !== 'Name' && key !== 'Label'}
        error={m.fields.errors[key]}
        focus={m.fields.focus === key}
        off={off}
        onText={(text) => go({ type: 'draft', key, text })}
        onDone={() => go({ type: 'apply', key })}
        testID={`seating.field.${key}.${it.id}`}
      />
    );
  };
}

function Notes({ m, it }: { m: Seating; it: Item }) {
  const ring = m.rings[it.id];
  return (
    <>
      {m.fields.added != null && <Notice words={m.fields.added} tone="green" />}
      {m.fields.changedBy != null && <Notice words={m.fields.changedBy} tone="amber" />}
      {ring != null && !ring.viewer && m.fields.changedBy == null && (
        <Notice words={say.bothChose(ring.name)} tone="note" />
      )}
      {m.fields.note != null && <Notice words={m.fields.note} tone="note" />}
      {m.fields.warn != null && <Notice words={m.fields.warn} tone="amber" />}
    </>
  );
}

function sizeOf(m: Seating, cm: number): string {
  return m.units === 'us' ? length(m, cm) : String(cm);
}

function TableFields({ m, go, it }: { m: Seating; go: Go; it: Item }) {
  const field = fieldsOf(m, go, it);
  const off = !editable(m);
  const round = it.kind === 'round' || it.kind === 'cocktail';
  return (
    <>
      <Title title={it.name} line={titleLine(m, it)} />
      <Notes m={m} it={it} />
      {field('Name', W.name, it.name)}
      <Two>
        <Half>
          <SelectBox
            label={W.section}
            value={sectionName(m, it)}
            off={off}
            onOpen={() => go({ type: 'pop', pop: { kind: 'select', field: 'Section' } })}
            testID="seating.select.section"
          />
        </Half>
        <Half>
          <SelectBox
            label={W.shape}
            value={shapeChoice(it)}
            off={off}
            onOpen={() => go({ type: 'pop', pop: { kind: 'select', field: 'Shape' } })}
            testID="seating.select.shape"
          />
        </Half>
      </Two>
      {round ? (
        <Two>
          <Half>
            {field('Seats', it.kind === 'cocktail' ? W.places : W.seats, String(it.chairs.length))}
          </Half>
          <Half>{field('Diameter', W.diameter, sizeOf(m, it.d), 'cm')}</Half>
        </Two>
      ) : (
        <>
          <Two>
            <Half>{field('Width', W.width, sizeOf(m, it.w), 'cm')}</Half>
            <Half>{field('Length', W.length, sizeOf(m, it.l), 'cm')}</Half>
          </Two>
          <Two>
            <Half>{field('Seats', W.seats, String(it.chairs.length))}</Half>
            <Half>{field('Ends', W.ends, String(it.ends))}</Half>
          </Two>
          <Small text={endsLine(it)} />
        </>
      )}
      <Two>
        <Half>{field('Across', W.across, length(m, it.x))}</Half>
        <Half>{field('Down', W.down, length(m, it.y))}</Half>
      </Two>
      {m.units === 'us' && <Small text={W.usHint} />}
      {(it.kind === 'rect' || it.kind === 'head') && (
        <SelectBox
          label={W.rotation}
          value={`${it.rot}°`}
          off={off}
          onOpen={() => go({ type: 'pop', pop: { kind: 'select', field: 'Rotation' } })}
          testID="seating.select.rotation"
        />
      )}
      <Refused m={m} keys={['Shape', 'Rotation']} />
      <Overlap m={m} it={it} />
      {!off && <ItemActions go={go} it={it} remove={W.deleteTable} />}
    </>
  );
}

function Refused({ m, keys }: { m: Seating; keys: readonly string[] }) {
  const words = keys.map((key) => m.fields.errors[key]).find((w) => w != null);
  return words == null ? null : <Notice words={words} tone="red" />;
}

function Overlap({ m, it }: { m: Seating; it: Item }) {
  const over = overlapping(
    it,
    m.items.filter((o) => o.id !== m.ghost?.id),
  )[0];
  return over == null ? null : <Notice words={say.overlaps(over.name)} tone="amber" />;
}

function ItemActions({ go, it, remove }: { go: Go; it: Item; remove: string }) {
  return (
    <View style={styles.actions}>
      <TextAction
        label={W.duplicate}
        onPress={() => go({ type: 'duplicate' })}
        testID="seating.duplicate"
      />
      <TextAction
        label={remove}
        removes
        onPress={() => go({ type: 'ask', ask: { kind: 'deleteItem', id: it.id } })}
        testID="seating.delete"
      />
    </View>
  );
}

export function endsLine(it: Item): string {
  const n = it.chairs.length;
  const e = it.ends;
  const left = Math.ceil(e / 2);
  const right = Math.floor(e / 2);
  if (it.kind === 'head')
    return `${n - e} along the side facing the room${e > 0 ? `, ${left} on the left end, ${right} on the right.` : '.'}`;
  const side = n - e;
  return `${left} on the left end, ${right} on the right, ${Math.ceil(side / 2)} and ${Math.floor(side / 2)} down the sides.`;
}

function SeatStrip({ m, go, it }: { m: Seating; go: Go; it: Item }) {
  const shown = it.chairs.slice(0, 5);
  return (
    <View style={styles.strip}>
      {shown.map((chair, i) => (
        <Pressable
          key={i}
          onPress={() => go({ type: 'tapChair', id: it.id, chair: i })}
          style={[styles.stripSeat, m.chair === i && styles.lit]}
          accessibilityRole="button"
          accessibilityState={{ selected: m.chair === i }}
          accessibilityLabel={say.chairName(i + 1, chairWord(it, i))}
          testID={`seating.strip.${i}`}
        >
          <StateMark state={chair.state} side={26} />
          <Text
            size={12}
            weight="semibold"
            accessible={false}
            style={[styles.secondary, styles.figures]}
          >
            {String(i + 1)}
          </Text>
        </Pressable>
      ))}
      {it.chairs.length > 5 && (
        <Text size={13} weight="medium" style={styles.secondary}>
          {say.moreRight(it.chairs.length - 5)}
        </Text>
      )}
    </View>
  );
}

function RowFields({ m, go, it }: { m: Seating; go: Go; it: Item }) {
  const field = fieldsOf(m, go, it);
  const off = !editable(m);
  const chair = m.chair == null ? null : it.chairs[m.chair];
  return (
    <>
      <Title title={it.name} line={titleLine(m, it)} />
      <Notes m={m} it={it} />
      <Small text={W.facesFront} />
      <SeatStrip m={m} go={go} it={it} />
      {chair != null && m.chair != null && (
        <View>
          <Text size={15} weight="semibold">
            {say.rowSeat(
              it.label,
              m.chair + 1,
              chair.state === 'taken' && chair.who != null
                ? say.takenBy(chair.who)
                : chairWord(it, m.chair),
            )}
          </Text>
          {!off && (
            <TextAction
              label={chair.state === 'unusable' ? W.markUsable : W.markUnusable}
              onPress={() => go({ type: 'mark', id: it.id, chair: m.chair ?? 0 })}
              testID="seating.row.mark"
            />
          )}
          {m.fields.errors.chair != null && <Notice words={m.fields.errors.chair} tone="red" />}
        </View>
      )}
      <Two>
        <Half>{field('Label', W.label, it.label)}</Half>
        <Half>
          <SelectBox
            label={W.section}
            value={sectionName(m, it)}
            off={off}
            onOpen={() => go({ type: 'pop', pop: { kind: 'select', field: 'Section' } })}
            testID="seating.select.section"
          />
        </Half>
      </Two>
      <Two>
        <Half>{field('Seats', W.seats, String(it.chairs.length))}</Half>
        <Half>{field('Spacing', W.spacing, sizeOf(m, it.spacing), 'cm')}</Half>
      </Two>
      <Two>
        <Half>{field('Across', W.across, length(m, it.x))}</Half>
        <Half>{field('Down', W.down, length(m, it.y))}</Half>
      </Two>
      <SelectBox
        label={W.rotation}
        value={`${it.rot}°`}
        off={off}
        onOpen={() => go({ type: 'pop', pop: { kind: 'select', field: 'Rotation' } })}
        testID="seating.select.rotation"
      />
      <Refused m={m} keys={['Rotation']} />
      {!off && <ItemActions go={go} it={it} remove={W.deleteRow} />}
    </>
  );
}

function SingleFields({ m, go, it }: { m: Seating; go: Go; it: Item }) {
  const field = fieldsOf(m, go, it);
  const off = !editable(m);
  const state = it.chairs[0]?.state ?? 'empty';
  return (
    <>
      <Title title={it.name} line={say.singleLine(sectionName(m, it))} />
      <Notes m={m} it={it} />
      {field('Name', W.name, it.name)}
      <SelectBox
        label={W.section}
        value={sectionName(m, it)}
        off={off}
        onOpen={() => go({ type: 'pop', pop: { kind: 'select', field: 'Section' } })}
        testID="seating.select.section"
      />
      <View style={styles.stateRow}>
        <StateMark state={state} />
        <Text size={15} weight="semibold" style={styles.grow}>
          {STATE_WORD[state]}
        </Text>
      </View>
      {!off && (
        <TextAction
          label={state === 'unusable' ? W.markUsable : W.markUnusable}
          onPress={() => go({ type: 'mark', id: it.id, chair: 0 })}
          testID="seating.single.mark"
        />
      )}
      {m.fields.errors.chair != null && <Notice words={m.fields.errors.chair} tone="red" />}
      <Two>
        <Half>{field('Across', W.across, length(m, it.x))}</Half>
        <Half>{field('Down', W.down, length(m, it.y))}</Half>
      </Two>
      {!off && (
        <TextAction
          label={W.deleteSeat}
          removes
          onPress={() => go({ type: 'ask', ask: { kind: 'deleteItem', id: it.id } })}
          testID="seating.delete"
        />
      )}
    </>
  );
}

function ChairPanel({ m, go, it, chair }: { m: Seating; go: Go; it: Item; chair: number }) {
  const state = it.chairs[chair]?.state ?? 'empty';
  return (
    <>
      <Title
        title={say.chairTitle(it.name, chair + 1)}
        line={`${shapeWord(it)} · ${sectionName(m, it)}`}
      />
      <View style={styles.stateRow}>
        <StateMark state={state} />
        <Text size={16} weight="semibold" style={styles.grow}>
          {chairWord(it, chair)}
        </Text>
      </View>
      {editable(m) && (
        <TextAction
          label={state === 'unusable' ? W.markUsable : W.markUnusable}
          onPress={() => go({ type: 'mark', id: it.id, chair })}
          testID="seating.chair.mark"
        />
      )}
      {m.fields.errors.chair != null && <Notice words={m.fields.errors.chair} tone="red" />}
      <Legend />
    </>
  );
}

/** Arrange: the chosen item's fields, each applying as it is entered; with nothing chosen, the room, Snap to grid, Sections and the legend. */
export function ArrangePanel({ m, go }: { m: Seating; go: Go }) {
  if (m.load === 'start') return <StartForm m={m} go={go} />;
  if (m.arrange === 'roomSettings') return <RoomSettings m={m} go={go} />;
  if (m.arrange === 'sectionAdd' || m.arrange === 'sectionEdit')
    return <SectionForm m={m} go={go} />;
  const it = itemOf(m, m.chosen);
  if (it == null) return <NothingChosen m={m} go={go} />;
  if (m.chair != null && isTable(it)) return <ChairPanel m={m} go={go} it={it} chair={m.chair} />;
  if (m.readOnly)
    return (
      <>
        <Title title={it.name} line={titleLine(m, it)} />
        <Facts m={m} it={it} />
        <Small text={W.readOnly} />
      </>
    );
  if (it.kind === 'row') return <RowFields m={m} go={go} it={it} />;
  if (it.kind === 'single') return <SingleFields m={m} go={go} it={it} />;
  return <TableFields m={m} go={go} it={it} />;
}

export function ChairRow({
  it,
  index,
  selected = false,
  onPress,
  trail,
}: {
  it: Item;
  index: number;
  selected?: boolean;
  onPress?: (() => void) | undefined;
  trail?: ReactNode;
}) {
  const chair = it.chairs[index];
  const press =
    onPress == null
      ? {}
      : { onPress, accessibilityLabel: say.chairName(index + 1, chairWord(it, index)) };
  return (
    <Row
      title={say.seatNumber(index + 1)}
      line={chairWord(it, index)}
      lead={<StateMark state={chair?.state ?? 'empty'} />}
      selected={selected}
      trail={trail}
      pad={6}
      {...press}
      testID={`seating.chairRow.${it.id}.${index}`}
    />
  );
}

function TableGuests({ m, go, it }: { m: Seating; go: Go; it: Item }) {
  const write = editable(m);
  if (filled(it) === 0)
    return (
      <>
        <Title title={it.name} line={titleLine(m, it)} />
        <Small text={W.nobodyHere} />
        <Tray m={m} go={go} chips={false} />
      </>
    );
  return (
    <>
      <Title title={it.name} line={titleLine(m, it)} />
      <RowList
        items={it.chairs.map((_, i) => ({
          key: String(i),
          inset: 34,
          row: <ChairRow it={it} index={i} />,
        }))}
      />
      {write && (
        <View style={styles.actions}>
          <TextAction
            label={W.unseatEveryone}
            onPress={() => go({ type: 'unseatAll', id: it.id })}
            testID="seating.unseatAll"
          />
          <TextAction
            label={W.moveEveryone}
            onPress={() => go({ type: 'pop', pop: { kind: 'moveAll', id: it.id } })}
            testID="seating.moveAll"
          />
          <TextAction
            label={W.rename}
            onPress={() => go({ type: 'tapItem', id: it.id })}
            testID="seating.rename"
          />
        </View>
      )}
    </>
  );
}

function PartyRow({
  m,
  go,
  party,
  pickable,
}: {
  m: Seating;
  go: Go;
  party: Party;
  pickable: boolean;
}) {
  const who = say.party(partyWho(party), party.plus);
  const line = [party.group, party.reply].filter((w) => w != null && w !== '').join(' · ');
  return (
    <Row
      title={who}
      line={line === '' ? undefined : line}
      lead={<Avatar initials={initialsOf(partyWho(party))} side={36} />}
      selected={m.picked === party.id}
      pad={8}
      {...(pickable
        ? {
            onPress: () => go({ type: 'pick', id: party.id }),
            accessibilityLabel: [who, line].filter(Boolean).join(', '),
          }
        : {})}
      testID={`seating.party.${party.id}`}
    />
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/u)
    .filter((w) => w !== '' && w !== 'of')
    .slice(-2)
    .map((w) => w[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/** Without a seat (sc-4016): its count, a search by name, a chip per group, each party with its group; a pick lights it. */
export function Tray({
  m,
  go,
  chips = true,
  phone = false,
}: {
  m: Seating;
  go: Go;
  chips?: boolean;
  phone?: boolean;
}) {
  const pickable = editable(m);
  const shown = trayShown(m);
  const count = trayCount(m.tray);
  if (m.tray.length === 0)
    return (
      <View style={styles.trayGap}>
        <Head
          title={phone ? say.tab(W.withoutSeat, 0) : W.withoutSeat}
          right={phone ? undefined : <Count n={0} />}
        />
        <Small text={W.everyoneSeated} />
      </View>
    );
  return (
    <View style={styles.trayGap}>
      <View style={styles.switchRow}>
        <Text size={14.5} weight="semibold" style={styles.grow}>
          {W.showNotYet}
        </Text>
        <OnOffSwitch
          on={m.showNotYet}
          words={{ on: W.on, off: W.off }}
          label={W.showNotYet}
          onChange={() => go({ type: 'notYet' })}
          testID="seating.notYet"
        />
      </View>
      <Head
        title={phone ? say.tab(W.withoutSeat, count) : W.withoutSeat}
        right={phone ? undefined : <Count n={count} />}
      />
      {m.showNotYet && <Small text={say.moreNotYet(NOT_SURE_OR_NO_REPLY)} />}
      <Field label={W.searchByName}>
        <TextField
          value={m.search}
          autoFocus={m.search !== '' && m.held}
          placeholder={W.searchByName}
          returnKeyType="search"
          onChangeText={(text) => go({ type: 'search', text })}
          accessibilityLabel={W.searchByName}
          testID="seating.search"
        />
      </Field>
      {chips && (
        <View style={styles.chips}>
          {groupCounts(m).map(({ group, n }) => (
            <Pressable
              key={group}
              onPress={() => go({ type: 'group', group })}
              style={[styles.chip, m.group === group && styles.chipOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: m.group === group }}
              accessibilityLabel={say.groupChip(group, n)}
              testID={`seating.group.${group}`}
            >
              <Text
                size={13}
                weight="semibold"
                accessible={false}
                style={m.group === group ? styles.accent : styles.secondary}
              >
                {say.groupChip(group, n)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {shown.length === 0 ? (
        <View>
          <Text size={15} weight="semibold">
            {W.noMatch}
          </Text>
          <TextAction
            label={W.clearSearch}
            onPress={() => go({ type: 'clearSearch' })}
            testID="seating.clearSearch"
          />
        </View>
      ) : (
        <RowList
          items={[...shown, ...(m.showNotYet ? NOT_YET : [])].map((party) => ({
            key: party.id,
            inset: 48,
            selected: m.picked === party.id,
            row: (
              <PartyRow m={m} go={go} party={party} pickable={pickable && party.reply == null} />
            ),
          }))}
        />
      )}
    </View>
  );
}

function Count({ n }: { n: number }) {
  return (
    <Text size={18} weight="bold" style={styles.figures}>
      {String(n)}
    </Text>
  );
}

/** Seat: Without a seat, or a chosen table's guests and its menu. */
export function SeatPanel({ m, go }: { m: Seating; go: Go }) {
  const it = itemOf(m, m.chosen);
  if (it != null && m.picked == null) return <TableGuests m={m} go={go} it={it} />;
  return <Tray m={m} go={go} />;
}

export function roomFor(m: Seating, n: number): Item[] {
  return m.items.filter((it) => it.id !== m.chosen && isTable(it) && free(it) >= n);
}

export { partySize };

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  titleBlock: { gap: 2 },
  title: { letterSpacing: 20 * -0.015, lineHeight: 24 },
  line: { lineHeight: 14 * 1.4 },
  small: { lineHeight: 13 * 1.4 },
  head: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  close: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  two: { flexDirection: 'row', gap: tokens.spaceMd, alignItems: 'flex-start' },
  half: { flex: 1, minWidth: 0 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: tokens.spaceSm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  switchRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  colours: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceLg },
  colour: {
    width: '46%',
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  pair: { flexDirection: 'row', gap: tokens.spaceMd },
  fact: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  stripSeat: {
    width: 44,
    minHeight: 52,
    borderRadius: tokens.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  lit: { backgroundColor: tokens.colorAccentTint },
  stateRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
  },
  trayGap: { gap: tokens.spaceLg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  chip: {
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: tokens.colorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: tokens.colorAccentTint, borderColor: tokens.colorAccentTint },
});
