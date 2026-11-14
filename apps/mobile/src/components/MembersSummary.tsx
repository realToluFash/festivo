import type { OrganisationMember } from '@soirely/api-client';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import {
  faceOf,
  MEMBERS_FILTERS,
  type MembersCard,
  type MembersFilter,
  type MembersStep,
  memberLine,
  memberTag,
  waitingLine,
} from '../kit/membersSummary.ts';
import { tokens } from '../theme/tokens.ts';
import { useReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { Avatar } from './SettingsParts.tsx';
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
} from './Summary.tsx';
import { Text } from './Text.tsx';

const STEP_IDS: Record<MembersStep['does'], string> = {
  answer: 'members.answer',
  answerRecovery: 'members.recovery.answer',
  seePerson: 'members.awaiting.see',
  seeFormer: 'members.awaiting.former',
  becomeOwner: 'ownerClaim.become',
  checkRecord: 'ownerClaim.open',
};

/** Members' card: how things stand, the faces that show it, and the one next step. */
export function MembersCardView({
  card,
  compact,
  wide,
  saysRef,
  stepRef,
  busy = false,
  onStep,
}: {
  card: MembersCard;
  compact: boolean;
  wide: boolean;
  /** The card's words where the focus lands: the sentence, or the sentence and its line as one. */
  saysRef?: (view: ScreenReaderTarget | null) => void;
  stepRef: Ref<ViewInstance>;
  busy?: boolean;
  onStep: (step: MembersStep) => void;
}) {
  const step = card.step;

  useReadOut(card.readsOut ? [card.says, card.line].filter(Boolean).join('. ') : null, {
    quietAtMount: true,
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
              testID: STEP_IDS[step.does.does],
              ref: stepRef,
              busy,
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
      {card.faces.length > 0 && <Faces faces={card.faces} more={card.more} />}
    </SummaryCard>
  );
}

/** Who asked to join, shown only to those who manage members; a row opens the request. */
export function Waiting({
  waiting,
  dense,
  day,
  onOpen,
  rowRef,
}: {
  waiting: readonly OrganisationMember[];
  dense: boolean;
  day: (at: string) => string;
  onOpen: (id: string) => void;
  rowRef: (id: string) => Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const side = dense ? 36 : 40;
  const gutter = dense ? 10 : 0;
  const first = waiting[0];
  const removes = first?.removesAt?.written;
  const items: ListItem[] = waiting.map((member) => {
    const face = faceOf(member);

    return {
      key: member.id,
      inset: side + tokens.spaceLg,
      row: (
        <Row
          ref={rowRef(member.id)}
          title={member.user.name}
          line={waitingLine(t, member, day)}
          lead={<Avatar initials={face.initials} side={side} tone={face.tone} />}
          tag={memberTag(t, member)}
          opens
          gutter={gutter}
          onPress={() => onOpen(member.id)}
          testID={`members.approve.${member.id}`}
        />
      ),
    };
  });

  return (
    <Section
      title={t('membersScreen.waitingTitle')}
      foot={
        first == null || removes == null
          ? undefined
          : waiting.length === 1
            ? t('membersScreen.waitingFoot', { deadline: removes })
            : t('membersScreen.waitingFootMany', { name: first.user.name, deadline: removes })
      }
    >
      <View style={dense && styles.bleed}>
        <RowList items={items} gutter={gutter} />
      </View>
    </Section>
  );
}

export function People({
  listed,
  counts,
  filter,
  organisation,
  open,
  dense,
  manages,
  rowRef,
  onFilter,
  onOpen,
}: {
  listed: readonly OrganisationMember[];
  counts: Record<MembersFilter, number>;
  filter: MembersFilter;
  organisation: string;
  open: string | null;
  dense: boolean;
  manages: boolean;
  rowRef: (id: string) => Ref<ViewInstance>;
  onFilter: (filter: MembersFilter) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const side = dense ? 36 : 40;
  const gutter = dense ? 10 : 0;
  const items: ListItem[] = listed.map((member) => {
    const selected = member.id === open;
    const former = member.status === 'left_or_removed';
    const face = faceOf(member);

    return {
      key: member.id,
      inset: side + tokens.spaceLg,
      selected,
      row: (
        <Row
          ref={former ? undefined : rowRef(member.id)}
          title={member.user.name}
          line={memberLine(t, member)}
          lead={<Avatar initials={face.initials} side={side} tone={face.tone} />}
          tag={memberTag(t, member)}
          opens={!former}
          selected={selected}
          gutter={gutter}
          onPress={former ? undefined : () => onOpen(member.id)}
          testID={`members.row.${member.id}`}
        />
      ),
    };
  });

  return (
    <Section
      title={t('membersScreen.peopleTitle')}
      right={
        <FilterMenu
          choices={MEMBERS_FILTERS.map((value) => ({
            value,
            word: t(`membersScreen.filter.${value}`),
            count: counts[value],
          }))}
          value={filter}
          onChoose={onFilter}
          name={t('membersScreen.filterName')}
          testID="members.filter"
        />
      }
      foot={manages ? t('membersScreen.fromTheWeb') : undefined}
    >
      {listed.length === 0 ? (
        <Empty filter={filter} organisation={organisation} onShowEveryone={() => onFilter('all')} />
      ) : (
        <View style={dense && styles.bleed}>
          <RowList items={items} gutter={gutter} />
        </View>
      )}
    </Section>
  );
}

function Empty({
  filter,
  organisation,
  onShowEveryone,
}: {
  filter: MembersFilter;
  organisation: string;
  onShowEveryone: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.empty}>
      <Text size={16} weight="semibold">
        {t(`membersScreen.empty.${filter}.title`)}
      </Text>
      {(filter === 'suspended' || filter === 'former') && (
        <Text size={15} weight="medium" style={styles.secondary}>
          {t(`membersScreen.empty.${filter}.body`, { organisation })}
        </Text>
      )}
      {filter !== 'all' && (
        <TextAction
          label={t('membersScreen.showEveryone')}
          onPress={onShowEveryone}
          testID="members.showEveryone"
        />
      )}
    </View>
  );
}

/** Nobody opens by themselves on its side: the pane says what to do. */
export function NobodyPicked() {
  const { t } = useTranslation();

  return (
    <View style={styles.nobody}>
      <Text size={15} weight="medium" style={[styles.secondary, styles.centred]}>
        {t('membersScreen.pickSomebody')}
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
