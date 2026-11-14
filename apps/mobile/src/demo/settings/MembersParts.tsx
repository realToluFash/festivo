import { type Ref, useRef } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  type CardStep,
  type Filter,
  FILTERS,
  type MembersCard,
  type MembersSay,
  ORGANISATION,
  type Person,
  personLine,
  tagOf,
  waitingFoot,
  waitingLine,
} from './MembersSample.ts';
import { Avatar } from '../../components/SettingsParts.tsx';
import {
  CardSays,
  Faces,
  FilterMenu,
  type ListItem,
  OnCard,
  Row,
  RowList,
  Section,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';

export const FROM_THE_WEB = 'To invite somebody, use Soirely on the web.';

const STEP_IDS: Record<CardStep, string> = {
  answer: 'members.answer',
  answerRecovery: 'members.recovery.answer',
  seePerson: 'members.awaiting.see',
  seeFormer: 'members.awaiting.former',
  becomeOwner: 'ownerClaim.become',
  checkRecord: 'ownerClaim.open',
};

/** The Members card: how things stand, the faces that show it, and the one next step. */
export function MembersCardView({
  card,
  compact,
  wide,
  saysRef,
  toldAtMount = false,
  stepRef,
  onStep,
}: {
  card: MembersCard;
  compact: boolean;
  wide: boolean;
  /** Said as it mounts too: on a phone the card comes back with a removal's words already on it. */
  toldAtMount?: boolean;
  stepRef: Ref<ViewInstance>;
  /** The card's words where the focus lands: the sentence, or the sentence and its line as one. */
  saysRef?: (view: ScreenReaderTarget | null) => void;
  onStep: (step: CardStep) => void;
}) {
  const step = card.step;

  useReadOut(card.readsOut ? [card.says, card.line].filter(Boolean).join('. ') : null, {
    quietAtMount: !toldAtMount,
  });

  return (
    <SummaryCard
      size={compact ? 'compact' : wide ? 'wide' : 'page'}
      height={compact ? 156 : 200}
      step={
        step == null
          ? null
          : {
              label: step.label,
              onPress: () => onStep(step.does),
              testID: STEP_IDS[step.does],
              ref: stepRef,
            }
      }
      testID="members.card"
    >
      {card.takesFocus ? (
        <View
          ref={saysRef}
          style={{ gap: compact ? 9 : tokens.spaceLg }}
          accessible
          accessibilityRole="header"
          accessibilityLabel={[card.says, card.line].filter(Boolean).join(' ')}
        >
          <CardSays text={card.says} size={compact ? 20 : 24} accessible={false} />
          {card.line != null && <OnCard text={card.line} accessible={false} />}
        </View>
      ) : (
        <>
          <CardSays ref={saysRef} text={card.says} size={compact ? 20 : 24} heading />
          {card.line != null && <OnCard text={card.line} />}
        </>
      )}
      {card.faces.length > 0 && (
        <Faces
          faces={card.faces.map(({ initials, tone }) => ({ initials, tone }))}
          more={card.more}
        />
      )}
    </SummaryCard>
  );
}

/** Who asked to join, oldest first, shown only to those who manage members; a row opens its request. */
export function Waiting({
  waiting,
  dense,
  say,
  onOpen,
}: {
  waiting: readonly Person[];
  dense: boolean;
  say: MembersSay;
  /** The row pressed, so the request gives the focus back to it. */
  onOpen: (id: string, row: ViewInstance | null) => void;
}) {
  const rows = useRef<Record<string, ViewInstance | null>>({});
  const side = dense ? 36 : 40;
  const gutter = dense ? 10 : 0;
  const items: ListItem[] = waiting.map((person, index) => ({
    key: person.id,
    inset: side + tokens.spaceLg,
    row: (
      <Row
        ref={(view) => {
          rows.current[person.id] = view;
        }}
        title={person.name}
        line={waitingLine(person, say)}
        lead={<Avatar initials={person.initials} side={side} tone={person.tone} />}
        tag={tagOf(person)}
        opens
        gutter={gutter}
        onPress={() => onOpen(person.id, rows.current[person.id] ?? null)}
        testID={index === 0 ? 'members.approve' : `members.approve.${person.initials}`}
      />
    ),
  }));

  return (
    <Section title="Waiting" foot={waitingFoot(waiting, say)}>
      <View style={dense && styles.bleed}>
        <RowList items={items} gutter={gutter} />
      </View>
    </Section>
  );
}

const EMPTY: Record<Filter, { title: string; body?: string }> = {
  all: { title: 'Nobody here' },
  active: { title: 'Nobody is active' },
  suspended: {
    title: 'Nobody is suspended',
    body: `Everyone in ${ORGANISATION} can use it right now.`,
  },
  former: {
    title: 'Nobody has left',
    body: 'People who leave or are removed are listed here, with what they did kept.',
  },
};

export function People({
  listed,
  counts,
  filter,
  you,
  open,
  dense,
  manages,
  onFilter,
  onOpen,
}: {
  listed: readonly Person[];
  counts: Record<Filter, number>;
  filter: Filter;
  you: string;
  open: string | null;
  dense: boolean;
  manages: boolean;
  onFilter: (filter: Filter) => void;
  onOpen: (id: string) => void;
}) {
  const side = dense ? 36 : 40;
  const gutter = dense ? 10 : 0;
  const items: ListItem[] = listed.map((person) => {
    const selected = person.id === open;

    return {
      key: person.id,
      inset: side + tokens.spaceLg,
      selected,
      row: (
        <Row
          title={person.name}
          line={personLine(person, you)}
          lead={<Avatar initials={person.initials} side={side} tone={person.tone} />}
          tag={tagOf(person)}
          opens={person.status !== 'former'}
          selected={selected}
          gutter={gutter}
          onPress={person.status === 'former' ? undefined : () => onOpen(person.id)}
          testID={`members.row.${person.initials}`}
        />
      ),
    };
  });

  return (
    <Section
      title="People"
      right={
        <FilterMenu
          choices={FILTERS.map(({ filter: value, word }) => ({
            value,
            word,
            count: counts[value],
          }))}
          value={filter}
          onChoose={onFilter}
          name="Show"
          testID="members.filter"
        />
      }
      foot={manages ? FROM_THE_WEB : undefined}
    >
      {listed.length === 0 ? (
        <Empty filter={filter} onShowEveryone={() => onFilter('all')} />
      ) : (
        <View style={dense && styles.bleed}>
          <RowList items={items} gutter={gutter} />
        </View>
      )}
    </Section>
  );
}

function Empty({ filter, onShowEveryone }: { filter: Filter; onShowEveryone: () => void }) {
  const { title, body } = EMPTY[filter];

  return (
    <View style={styles.empty}>
      <Text size={16} weight="semibold">
        {title}
      </Text>
      {body != null && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {body}
        </Text>
      )}
      {filter !== 'all' && (
        <TextAction label="Show everyone" onPress={onShowEveryone} testID="members.showEveryone" />
      )}
    </View>
  );
}

/** Nobody opens by themselves on its side: the pane says what to do. */
export function NobodyPicked() {
  return (
    <View style={styles.nobody}>
      <Text size={15} weight="medium" style={[styles.secondary, styles.centred]}>
        Choose somebody in the list to see them here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  centred: { textAlign: 'center' },
  bleed: { marginHorizontal: -10 },
  empty: { gap: tokens.spaceXs, paddingTop: tokens.spaceXs },
  nobody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: tokens.space5xl },
});
