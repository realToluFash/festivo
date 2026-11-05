import { router, useLocalSearchParams } from 'expo-router';
import { type Ref, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { glide } from '../../motion.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph } from '../Glyph.tsx';
import { useShell } from '../settings/Frame.tsx';
import { useLoad } from '../settings/MembersLoading.tsx';
import { FailedBlock, Line, Row, RowList, SectionHead } from '../settings/Summary.tsx';
import { AddScreen } from './PeopleAdd.tsx';
import { PeopleLoading, PeoplePage } from './PeopleFrame.tsx';
import { Face, RoleSheet } from './PeopleRole.tsx';
import {
  ADD_PROMPT,
  addedToast,
  EMPTY_LINE,
  EMPTY_TITLE,
  FAILED_LINE,
  FAILED_TITLE,
  listed,
  manages,
  ON_EVENT,
  type OnEvent,
  opens,
  OUTSIDE_TAG,
  type PeopleStart,
  peopleStart,
  peopleStateOf,
  READ_ONLY,
  removedToast,
  rowLine,
  sampleMembers,
  seesEveryEvent,
  withAdded,
  without,
  withRole,
} from './PeopleSample.ts';

const LIT_MS = 2000;
const ROW_INSET = 40 + tokens.spaceLg;

interface Opened {
  person: OnEvent;
  open: boolean;
  visit: number;
}

/** People on an event in A, one list with the role in a sheet, on sample data. */
export function PeopleSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = peopleStateOf(state);

  return <PeopleScreen key={name} start={peopleStart(name)} />;
}

function PeopleScreen({ start }: { start: PeopleStart }) {
  const { layout } = useShell();
  const { load, retry } = useLoad(start.load);
  const viewer = start.viewer;
  const [members] = useState(sampleMembers);
  const [onEvent, setOnEvent] = useState<OnEvent[]>(start.onEvent);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [adding, setAdding] = useState({ open: false, visit: 0 });
  const [lit, setLit] = useState<{ id: string; held: boolean } | null>(null);
  const [litFade] = useState(() => new Animated.Value(1));
  const [toast, setToast] = useState<string | null>(null);
  const addBox = useRef<ViewInstance>(null);
  const rows = useRef(new Map<string, ViewInstance>());
  const focusBack = useRef<ScreenReaderTarget | null>(null);
  const canChange = manages(viewer, onEvent);
  const person =
    opened == null ? null : (onEvent.find((one) => one.id === opened.person.id) ?? opened.person);

  useEffect(() => {
    if (lit == null || lit.held) return;
    const timer = setTimeout(() => {
      glide(litFade, 0, tokens.motionSlow).start(({ finished }) => {
        if (finished) setLit(null);
      });
    }, LIT_MS);

    return () => clearTimeout(timer);
  }, [lit, litFade]);

  function openRole(one: OnEvent): void {
    focusBack.current = rows.current.get(one.id) ?? null;
    litFade.stopAnimation();
    litFade.setValue(1);
    setLit({ id: one.id, held: true });
    setToast(null);
    setOpened((was) => ({ person: one, open: true, visit: (was?.visit ?? 0) + 1 }));
  }

  function closeRole(): void {
    setOpened((was) => (was == null ? null : { ...was, open: false }));
    setLit((was) => (was == null ? null : { ...was, held: false }));
  }

  function removeOpened(): void {
    if (person == null) return;
    focusBack.current = addBox.current;
    setOnEvent((was) => without(was, person.id));
    setOpened((was) => (was == null ? null : { ...was, open: false }));
    setLit(null);
    setToast(removedToast(person));
  }

  function openAdd(): void {
    focusBack.current = addBox.current;
    setToast(null);
    setAdding((was) => ({ open: true, visit: was.visit + 1 }));
  }

  const back = {
    label: layout === 'phone' ? 'More' : 'Overview',
    onPress: () => (router.canGoBack() ? router.back() : router.replace('/demo')),
  };

  if (load !== 'loaded')
    return (
      <PeoplePage back={back}>
        {load === 'failed' ? (
          <FailedBlock
            title={FAILED_TITLE}
            line={FAILED_LINE}
            onRetry={retry}
            testID="people.retry"
          />
        ) : (
          <PeopleLoading />
        )}
      </PeoplePage>
    );

  const shown = listed(onEvent);

  return (
    <>
      <PeoplePage
        back={back}
        toast={toast == null ? null : { words: toast, onClose: () => setToast(null) }}
      >
        {canChange && <AddBox ref={addBox} onPress={openAdd} />}
        {shown.length === 0 ? (
          <View style={styles.nobody}>
            <Text size={16} weight="semibold">
              {EMPTY_TITLE}
            </Text>
            <Line text={EMPTY_LINE} />
          </View>
        ) : (
          <View>
            <SectionHead
              title={ON_EVENT}
              right={
                <Text size={15} weight="medium" style={[styles.secondary, styles.count]}>
                  {String(shown.length)}
                </Text>
              }
            />
            <RowList
              items={shown.map((one) => {
                const isLit = lit?.id === one.id;
                const opensRow = opens(one, viewer, onEvent);
                const line = rowLine(one, viewer);

                return {
                  key: one.id,
                  inset: ROW_INSET,
                  selected: isLit,
                  row: (
                    <View>
                      {isLit && (
                        <Animated.View
                          pointerEvents="none"
                          style={[styles.lit, { opacity: litFade }]}
                        />
                      )}
                      <Row
                        ref={(node) => {
                          if (node == null) rows.current.delete(one.id);
                          else rows.current.set(one.id, node);
                        }}
                        title={one.name}
                        line={line}
                        lead={<Face person={one} side={40} />}
                        tag={one.outside ? { kind: 'now', word: OUTSIDE_TAG } : null}
                        trail={
                          opensRow ? (
                            <Glyph
                              name="down"
                              size={18}
                              ink={tokens.colorInkTertiary}
                              weight={2.3}
                            />
                          ) : undefined
                        }
                        accent={isLit}
                        onPress={opensRow ? () => openRole(one) : undefined}
                        accessibilityLabel={[one.name, one.outside ? OUTSIDE_TAG : null, line]
                          .filter((part) => part != null)
                          .join('. ')}
                        testID={`people.row.${one.id}`}
                      />
                    </View>
                  ),
                };
              })}
            />
          </View>
        )}
        <View style={styles.foot}>
          {!canChange && <Line text={READ_ONLY} size={14} />}
          <Line text={seesEveryEvent(members)} size={14} />
        </View>
      </PeoplePage>
      {person != null && opened != null && (
        <RoleSheet
          key={opened.visit}
          person={person}
          open={opened.open}
          roleFails={start.roleFails}
          opener={focusBack}
          onSaved={(role) => setOnEvent((was) => withRole(was, person.id, role))}
          onClose={closeRole}
          onRemove={removeOpened}
        />
      )}
      {adding.visit > 0 && (
        <AddScreen
          key={adding.visit}
          open={adding.open}
          members={members}
          onEvent={onEvent}
          viewer={viewer}
          opener={focusBack}
          onClose={() => setAdding((was) => ({ ...was, open: false }))}
          onAdd={(role, added) => {
            const next = withAdded(onEvent, role, added);
            setOnEvent(next.onEvent);
            setAdding((was) => ({ ...was, open: false }));
            setToast(addedToast(next.names, role));
          }}
        />
      )}
    </>
  );
}

/** The way in to Add people, drawn as the field it opens: 52 tall, the Edge ring, a Violet plus. */
function AddBox({ ref, onPress }: { ref: Ref<ViewInstance>; onPress: () => void }) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.addBox, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={ADD_PROMPT}
      testID="people.add.open"
    >
      <Glyph name="plus" size={19} ink={tokens.colorAccent} weight={2.4} />
      <Text size={16} weight="medium" accessible={false} style={styles.secondary}>
        {ADD_PROMPT}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  count: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  nobody: { gap: tokens.spaceXs },
  lit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -tokens.spaceMd,
    right: -tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  foot: { gap: tokens.spaceSm },
  addBox: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusInset,
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
  },
});
