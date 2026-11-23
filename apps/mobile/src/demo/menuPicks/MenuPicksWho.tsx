import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { FailureLine } from '../../components/FailureLine.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { CheckMark } from '../../components/SecurityTwoFactor.tsx';
import { SheetActions, SheetScrollView } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import {
  CONFIRMED_AT,
  type MenuWorld,
  MW,
  SAVING_MS,
  type WhoOpened,
  type WhoOutcome,
  allergenWords,
  goesBackWords,
  hasVariant,
  ruledOut,
  tickedOf,
  whoOutcome,
  whoParts,
} from './menuPicksModel.ts';
import { OverrideAlert, styles as parts } from './MenuPicksParts.tsx';

/** Choose who gets it (sc-3909) on a Children only variant: everyone coming by party, ticked if they have it now; Save gives it to the ticked as a pick the host made. */
export function ChooseWho({
  world,
  opened,
  onSaved,
  onClose,
}: {
  world: MenuWorld;
  opened: WhoOpened;
  onSaved: (next: MenuWorld, said: string[]) => void;
  onClose: () => void;
}) {
  const { course, found, variant, contains } = whoParts(world, opened);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => tickedOf(world, opened));
  const [first] = useState<WhoOutcome | null>(() =>
    opened.press === true
      ? whoOutcome(world, opened, tickedOf(world, opened), false, CONFIRMED_AT)
      : null,
  );
  const [asking, setAsking] = useState<WhoOutcome | null>(first?.kind === 'ask' ? first : null);
  const [refused, setRefused] = useState(first?.kind === 'refused');
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const save = (confirmed: boolean) => {
    if (saving || refused) return;
    const out = whoOutcome(world, opened, ticked, confirmed, CONFIRMED_AT);
    if (out.kind === 'ask') return setAsking(out);
    setAsking(null);
    setSaving(true);
    timer.current = setTimeout(() => {
      setSaving(false);
      if (out.kind === 'refused') return setRefused(true);
      if (out.kind !== 'saved') return;
      onSaved(out.next, [out.line, ...(out.overridden == null ? [] : [out.overridden])]);
      onClose();
    }, SAVING_MS);
  };
  const toggle = (id: string) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={styles.sheet}>
      <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
        {MW.whoTitle(variant.name)}
      </Text>
      <Text size={15} style={parts.secondary}>
        {MW.whoSub(found.name, course.name)}
      </Text>
      <Text size={15} style={parts.secondary}>
        {MW.whoHelp}
      </Text>
      <SheetScrollView style={styles.list} contentContainerStyle={styles.scroll}>
        {refused ? (
          <FailureLine words={MW.refused} testID="menu.who.refused" />
        ) : (
          world.parties.map((party) => {
            const members = world.people.filter((one) => one.party === party.id);

            return (
              <View key={party.id} style={styles.group}>
                <Text size={15} weight="semibold" style={parts.secondary}>
                  {MW.replied(party.replier, members.length)}
                </Text>
                {members.map((person) => {
                  const on = ticked.has(person.id);
                  const ruled = ruledOut(person, contains);
                  const allergy =
                    ruled.length === 0 ? null : MW.ruledOutWho(allergenWords(ruled), person.name);
                  const leaving =
                    hasVariant(world, course, person, variant.id) && !on
                      ? goesBackWords(course, person)
                      : null;

                  return (
                    <Pressable
                      key={person.id}
                      onPress={() => toggle(person.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={[
                        person.name,
                        allergy == null ? null : MW.allergyMark,
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
                            <View style={parts.allergy}>
                              <Glyph name="alert" size={14} ink={tokens.colorAttentionText} />
                              <Text size={13} weight="semibold" style={parts.attention}>
                                {MW.allergyMark}
                              </Text>
                            </View>
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
          })
        )}
      </SheetScrollView>
      <SheetActions>
        {refused ? (
          <SecondaryButton label={MW.close} onPress={onClose} testID="menu.who.close" />
        ) : (
          <>
            <SecondaryButton label={MW.cancel} onPress={onClose} testID="menu.who.cancel" />
            <PrimaryButton
              label={MW.save}
              onPress={() => save(false)}
              busy={saving}
              testID="menu.who.save"
            />
          </>
        )}
      </SheetActions>
      {asking?.kind === 'ask' && (
        <OverrideAlert
          title={asking.title}
          body={asking.body}
          keep={MW.leaveOut}
          go={MW.giveAnyway}
          onAnother={() => {
            setTicked((now) => {
              const next = new Set(now);
              for (const one of asking.people) next.delete(one.id);
              return next;
            });
            setAsking(null);
          }}
          onAnyway={() => save(true)}
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
  list: { flexShrink: 1 },
  scroll: { gap: tokens.spaceMd },
  group: { gap: tokens.spaceXxs },
});
