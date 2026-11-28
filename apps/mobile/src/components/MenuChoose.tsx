import {
  ApiError,
  type EventPicks,
  type HostPick,
  type MenuCourse,
  type MenuDish,
  type PicksCourse,
  type PicksRoomPerson,
  type PicksRow,
} from '@soirely/api-client';
import {
  against,
  dishRuledOut,
  goesBackTo,
  listFormat,
  mealPickName,
  plateOf,
} from '@soirely/domain';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '../api.ts';
import { useShownLanguage } from '../i18n/index.ts';
import { overrideBody, ruledOutWords, savedOverride, whoChanges } from '../kit/menuPicksWords.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { FailureLine } from './FailureLine.tsx';
import {
  AllergyPill,
  Choice,
  OverrideAlert,
  useAllergens,
  styles as parts,
} from './MenuPicksParts.tsx';
import { CheckMark } from './SecurityTwoFactor.tsx';
import { SheetActions, SheetScrollView } from './Sheet.tsx';
import { Text } from './Text.tsx';

/** What a save said: the green line, and the override line when the host confirmed one. */
export type Said = readonly string[];

interface Draft {
  dishId: string | 'kitchen' | null;
  variantId: string | null;
  optionIds: string[];
}

const blankDraft: Draft = { dishId: null, variantId: null, optionIds: [] };

const refusedFor = (error: unknown): boolean => error instanceof ApiError && error.status === 403;

/** Choose for them (sc-3909): one course after another, each saved as the host's pick; opened from Given the default, each course starts at its default (sc-1362). */
export function ChooseFor({
  eventId,
  person,
  courses,
  given,
  onSaved,
  onClose,
}: {
  eventId: string;
  person: PicksRoomPerson;
  courses: readonly MenuCourse[];
  given: boolean;
  onSaved: (picks: EventPicks, said: Said) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const allergens = useAllergens();
  const startOf = (one: MenuCourse | undefined): Draft =>
    given && one?.default != null
      ? { dishId: one.default.dish, variantId: one.default.variant, optionIds: one.default.options }
      : blankDraft;
  const [at, setAt] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => startOf(courses[0]));
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string[] | null>(null);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const phone = useLayout().kind === 'phone';

  const course = courses[at];
  if (course == null) return null;
  const who = person.name;
  const last = at + 1 >= courses.length;
  const dish = course.dishes.find((one) => one.id === draft.dishId) ?? null;
  const questions = dish?.choices.filter((one) => !one.draft) ?? [];
  const saveLabel = last ? t('menuPicks.save') : t('menuPicks.saveNext');
  const ruledWords = (ruled: readonly string[], plate: readonly string[] | null) =>
    ruledOutWords(t, allergens, ruled, plate, who);

  const save = async (confirmed: boolean) => {
    if (busy || refused) return;
    if (draft.dishId == null)
      return setError(
        t('menuPicks.blank', { course: course.name.toLocaleLowerCase(i18n.language), name: who }),
      );
    if (dish != null && dish.variants.length > 0 && draft.variantId == null)
      return setError(t('menuPicks.blankWay', { dish: dish.name, name: who }));
    const unanswered = questions.find(
      (one) => one.required && !one.options.some((option) => draft.optionIds.includes(option.id)),
    );
    if (unanswered != null)
      return setError(t('menuPicks.blankOption', { question: unanswered.question, name: who }));
    const plate = dish == null ? [] : plateOf(dish, draft.variantId, draft.optionIds);
    const ruled = against(plate, person.allergens);
    if (ruled.length > 0 && !confirmed) return setAsking(ruled);
    setAsking(null);
    setError(null);
    const pick: HostPick =
      dish == null
        ? { answer: 'chefsChoice' }
        : {
            answer: 'chosen',
            dish: dish.id,
            variant: draft.variantId,
            options: draft.optionIds,
            anyway: confirmed,
          };
    setBusy(true);
    try {
      const next = await api.chooseForGuest(eventId, person.id, course.id, pick);
      const what =
        dish == null
          ? t('menuPicks.kitchen')
          : mealPickName(dish, draft.variantId, draft.optionIds);
      onSaved(next, [
        t('menuPicks.savedFor', { course: course.name, name: who, what }),
        ...(ruled.length === 0 ? [] : [savedOverride(t, allergens, what, ruled, plate, who)]),
      ]);
      if (last) onClose();
      else {
        setAt(at + 1);
        setDraft(startOf(courses[at + 1]));
      }
    } catch (failure) {
      if (refusedFor(failure)) setRefused(true);
      else if (failure instanceof ApiError && failure.is('meal_pick_ruled_out'))
        setAsking(failure.problem.people?.[0]?.allergens ?? ruled);
      else setError(t('menuPicks.failedSave', { button: saveLabel }));
    } finally {
      setBusy(false);
    }
  };

  const pickDish = (dishId: string | 'kitchen') => {
    const found = course.dishes.find((one) => one.id === dishId);
    setError(null);
    setDraft({
      dishId,
      variantId: found?.variants.length === 1 ? (found.variants[0]?.id ?? null) : null,
      optionIds: [],
    });
  };

  const saveButton = (
    <PrimaryButton
      label={saveLabel}
      onPress={() => void save(false)}
      busy={busy}
      off={refused}
      testID="menu.choose.save"
    />
  );

  return (
    <View style={styles.sheet}>
      <View style={styles.head}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
          {t('menuPicks.choosing', { name: who })}
        </Text>
        <Text size={15} style={parts.secondary}>
          {t('menuPicks.courseOf', { course: course.name, at: at + 1, all: courses.length })}
        </Text>
      </View>
      <SheetScrollView style={styles.list} contentContainerStyle={styles.scroll}>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {course.dishes.map((one) => (
            <Choice
              key={one.id}
              on={draft.dishId === one.id}
              title={one.name}
              lines={
                one.allergens == null
                  ? [t('menuPicks.allergensNotStated')]
                  : one.allergens.length === 0
                    ? []
                    : [t('menuPicks.contains', { allergens: allergens(one.allergens) })]
              }
              allergy={ruledWords(dishRuledOut(one, person), plateOf(one, null, []))}
              onPress={() => pickDish(one.id)}
              testID={`menu.choose.${one.id}`}
            />
          ))}
          <Choice
            on={draft.dishId === 'kitchen'}
            title={t('menuPicks.kitchenChoose')}
            lines={[]}
            allergy={null}
            onPress={() => pickDish('kitchen')}
            testID="menu.choose.kitchen"
          />
        </View>
        {dish != null && dish.variants.length > 1 && (
          <View accessibilityRole="radiogroup" style={styles.choices}>
            <Text size={17} weight="semibold" accessibilityRole="header">
              {t('menuPicks.whichWay', { dish: dish.name })}
            </Text>
            {dish.variants.map((way) => (
              <Choice
                key={way.id}
                on={draft.variantId === way.id}
                title={way.name}
                lines={[
                  ...(way.for === 'children' ? [t('menuPicks.childrenOnly')] : []),
                  ...(way.allergens == null || way.allergens.length === 0
                    ? []
                    : [t('menuPicks.contains', { allergens: allergens(way.allergens) })]),
                ]}
                allergy={ruledWords(against(way.allergens, person.allergens), way.allergens)}
                onPress={() => {
                  setError(null);
                  setDraft({ ...draft, variantId: way.id });
                }}
                testID={`menu.choose.${way.id}`}
              />
            ))}
          </View>
        )}
        {questions.map((one) => (
          <View key={one.id} accessibilityRole="radiogroup" style={styles.choices}>
            <Text size={17} weight="semibold" accessibilityRole="header">
              {one.question}
            </Text>
            {one.options.map((option) => (
              <Choice
                key={option.id}
                on={draft.optionIds.includes(option.id)}
                title={option.name}
                lines={[]}
                allergy={ruledWords(against(option.allergens, person.allergens), option.allergens)}
                onPress={() => {
                  setError(null);
                  setDraft({
                    ...draft,
                    optionIds: [
                      ...draft.optionIds.filter(
                        (id) => !one.options.some((other) => other.id === id),
                      ),
                      option.id,
                    ],
                  });
                }}
                testID={`menu.choose.${option.id}`}
              />
            ))}
          </View>
        ))}
        {error != null && <FailureLine words={error} testID="menu.choose.blank" />}
        {refused && <FailureLine words={t('menuPicks.refused')} testID="menu.choose.refused" />}
      </SheetScrollView>
      <SheetActions>
        {phone && saveButton}
        <SecondaryButton
          label={t('menuPicks.cancel')}
          onPress={onClose}
          stacked={phone}
          testID="menu.choose.cancel"
        />
        {!phone && saveButton}
      </SheetActions>
      {asking != null && dish != null && (
        <OverrideAlert
          title={t('menuPicks.overrideTitle', { name: who, allergens: allergens(asking) })}
          body={overrideBody(
            t,
            allergens,
            mealPickName(dish, draft.variantId, draft.optionIds),
            asking,
            plateOf(dish, draft.variantId, draft.optionIds),
            who,
          )}
          keep={t('menuPicks.chooseAnother')}
          go={t('menuPicks.pickAnyway')}
          onKeep={() => setAsking(null)}
          onGo={() => void save(true)}
        />
      )}
    </View>
  );
}

/** Choose who gets it (sc-3909) on a Children only variant: everyone coming by party, ticked if they have it now; Save gives it to exactly the ticked as a pick the host made. */
export function ChooseWho({
  eventId,
  picks,
  course,
  dish,
  row,
  onSaved,
  onClose,
}: {
  eventId: string;
  picks: EventPicks;
  course: PicksCourse;
  dish: MenuDish | undefined;
  row: PicksRow;
  onSaved: (picks: EventPicks, said: Said) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const language = useShownLanguage();
  const allergens = useAllergens();
  const list = (items: readonly string[]) =>
    listFormat(language, { type: 'conjunction' }).format(items);
  const people = picks.people ?? [];
  const holders = row.holders ?? [];
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(holders));
  const [asking, setAsking] = useState<PicksRoomPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const phone = useLayout().kind === 'phone';
  const dishName = dish?.name ?? '';
  const ruledFor = (person: PicksRoomPerson) => against(row.allergens, person.allergens);
  const goesBack = (person: PicksRoomPerson): string => {
    const to = goesBackTo(course, dish, person);
    if (to.kind === 'notChosen') return t('menuPicks.goesBackNone');

    return t('menuPicks.goesBack', {
      to: to.kind === 'needsHost' ? t('menuPicks.needsHost') : to.name,
    });
  };

  const save = async (confirmed: boolean) => {
    if (busy || refused) return;
    const { ruled } = whoChanges(row, ticked, people);
    if (ruled.length > 0 && !confirmed) return setAsking(ruled);
    setAsking(null);
    setError(null);
    setBusy(true);
    try {
      const next = await api.giveVariant(eventId, row.id, [...ticked], confirmed);
      onSaved(next, [
        t('menuPicks.whoSaved', { variant: row.name, dish: dishName, count: ticked.size }),
        ...(ruled.length > 0
          ? [t('menuPicks.whoOverride', { names: list(ruled.map((one) => one.name)) })]
          : []),
      ]);
      onClose();
    } catch (failure) {
      if (refusedFor(failure)) setRefused(true);
      else if (failure instanceof ApiError && failure.is('meal_pick_ruled_out')) {
        const ids = (failure.problem.people ?? []).map((one) => one.id);
        setAsking(people.filter((one) => ids.includes(one.id)));
      } else setError(t('menuPicks.failedSave', { button: t('menuPicks.save') }));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const saveButton = (
    <PrimaryButton
      label={t('menuPicks.save')}
      onPress={() => void save(false)}
      busy={busy}
      testID="menu.who.save"
    />
  );

  return (
    <View style={styles.sheet}>
      <View style={styles.head}>
        <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
          {t('menuPicks.whoTitle', { variant: row.name })}
        </Text>
        <Text size={15} style={parts.secondary}>
          {t('menuPicks.whoSub', { dish: dishName, course: course.name })}
        </Text>
        <Text size={15} style={parts.secondary}>
          {t('menuPicks.whoHelp')}
        </Text>
      </View>
      <SheetScrollView style={styles.list} contentContainerStyle={styles.scroll}>
        {refused ? (
          <FailureLine words={t('menuPicks.refused')} testID="menu.who.refused" />
        ) : (
          <>
            {(picks.parties ?? []).map((party) => {
              const members = people.filter((one) => one.party === party.id);

              return (
                <View key={party.id} style={styles.group}>
                  <Text size={15} weight="semibold" style={parts.secondary}>
                    {t('menuPicks.replied', { name: party.replier, count: members.length })}
                  </Text>
                  {members.map((person) => {
                    const on = ticked.has(person.id);
                    const ruled = ruledFor(person);
                    const allergy =
                      ruled.length === 0
                        ? null
                        : t('menuPicks.ruledOutWho', {
                            allergens: allergens(ruled),
                            name: person.name,
                          });
                    const leaving = holders.includes(person.id) && !on ? goesBack(person) : null;

                    return (
                      <Pressable
                        key={person.id}
                        onPress={() => toggle(person.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={[
                          person.name,
                          allergy == null ? null : t('menuPicks.allergyMark'),
                          allergy,
                          leaving,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                        style={({ pressed }) => [parts.tick, pressed && parts.pressed]}
                        testID={`menu.who.tick.${person.id}`}
                      >
                        <CheckMark on={on} />
                        <View style={parts.flex}>
                          <Text size={17} weight="medium">
                            {person.name}
                          </Text>
                          {allergy != null && (
                            <View style={parts.allergyLine}>
                              <AllergyPill />
                              <Text size={15} style={parts.attention}>
                                {allergy}
                              </Text>
                            </View>
                          )}
                          {leaving != null && (
                            <Text size={15} style={parts.secondary}>
                              {leaving}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
            {error != null && <FailureLine words={error} testID="menu.who.failed" />}
          </>
        )}
      </SheetScrollView>
      <SheetActions>
        {refused ? (
          <SecondaryButton
            label={t('menuPicks.close')}
            onPress={onClose}
            stacked={phone}
            testID="menu.who.close"
          />
        ) : (
          <>
            {phone && saveButton}
            <SecondaryButton
              label={t('menuPicks.cancel')}
              onPress={onClose}
              stacked={phone}
              testID="menu.who.cancel"
            />
            {!phone && saveButton}
          </>
        )}
      </SheetActions>
      {asking != null && (
        <OverrideAlert
          title={t('menuPicks.overrideWhoTitle', {
            names: list(asking.map((one) => one.name)),
            variant: row.name,
          })}
          body={[
            ...asking.map((one) =>
              t('menuPicks.overrideWhoLine', {
                variant: row.name,
                allergens: allergens(ruledFor(one)),
                name: one.name,
              }),
            ),
            t('menuPicks.overrideWhoBody'),
          ].join(' ')}
          keep={t('menuPicks.leaveOut')}
          go={t('menuPicks.giveAnyway')}
          onKeep={() => {
            setTicked((now) => {
              const next = new Set(now);
              for (const one of asking) next.delete(one.id);
              return next;
            });
            setAsking(null);
          }}
          onGo={() => void save(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flexShrink: 1,
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
    paddingTop: tokens.spaceXxl,
    paddingBottom: tokens.spaceLg,
  },
  head: { flexShrink: 0, gap: tokens.spaceMd },
  list: { flexShrink: 1 },
  scroll: { gap: tokens.spaceMd },
  choices: { gap: tokens.spaceSm },
  group: { gap: tokens.spaceXxs },
});
