import type { RecoveryRequest } from '@soirely/api-client';
import { type RefObject, useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type ScrollViewInstance, StyleSheet, View, type ViewInstance } from 'react-native';

import type { MemberFace } from '../kit/membersSummary.ts';
import {
  askerName,
  ownLine,
  type RecoveryAnswer,
  recoveryFacts,
  recoveryFace,
  recoveryHeard,
} from '../kit/membersRecovery.ts';
import { tokens } from '../theme/tokens.ts';
import { ScreenScroll } from './Screen.tsx';
import { Avatar } from './SettingsParts.tsx';
import {
  type ListItem,
  RowList,
  Section,
  SELECTED_ROW,
  Tag,
  TextAction,
  TITLE_BESIDE_TAG,
  TitleBesideTag,
  useRowClear,
} from './Summary.tsx';
import { Text } from './Text.tsx';

export type RecoveryPart = 'box' | 'group' | 'approve' | 'turnDown';

type OnTarget = (id: string, part: RecoveryPart, view: ViewInstance | null) => void;

/** Requests to get back in, under the card (sc-30894): the paragraph once, heard in each request's group instead, then each request as a Members row with its two answers. `lit` comes into view each time `brought` changes, its list's head `top` under the screen's scroll, or `scrollRef`'s. */
export function RecoveryRequests({
  waiting,
  lit,
  brought,
  dense,
  locale,
  top = tokens.spaceSm,
  scrollRef,
  faceOf = recoveryFace,
  onTarget,
  onAnswer,
}: {
  waiting: readonly RecoveryRequest[];
  lit: string | null;
  brought: number;
  dense: boolean;
  locale: string;
  top?: number;
  scrollRef?: RefObject<ScrollViewInstance | null>;
  faceOf?: (request: RecoveryRequest) => MemberFace;
  onTarget: OnTarget;
  onAnswer: (id: string, answer: RecoveryAnswer) => void;
}) {
  const { t } = useTranslation();
  const side = dense ? 36 : 40;
  const scroll = useContext(ScreenScroll);
  const clear = useRowClear();
  const list = useRef<ViewInstance>(null);
  const boxes = useRef<Record<string, ViewInstance | null>>({});
  const target: OnTarget = (id, part, view) => {
    if (part === 'box') boxes.current[id] = view;
    onTarget(id, part, view);
  };

  useEffect(() => {
    if (brought === 0 || lit == null) return;
    const frame = requestAnimationFrame(() =>
      bringListUp(
        list.current,
        boxes.current[lit],
        scrollRef?.current ?? scroll?.ref.current ?? null,
        top,
        clear,
      ),
    );

    return () => cancelAnimationFrame(frame);
    // Once per press of the card's step, for the request it lit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brought]);
  const items: ListItem[] = waiting.map((request) => ({
    key: request.id,
    inset: side + tokens.spaceLg,
    selected: request.id === lit,
    row: (
      <RecoveryRow
        request={request}
        lit={request.id === lit}
        dense={dense}
        locale={locale}
        face={faceOf(request)}
        onTarget={target}
        onAnswer={onAnswer}
      />
    ),
  }));

  return (
    <View ref={list} collapsable={false}>
      <Section title={t('recoveryRequests.cardTitle')} foot={t('recoveryRequests.cardNote')}>
        <Text
          size={15}
          weight="medium"
          style={[styles.secondary, styles.intro]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessible={false}
        >
          {t('recoveryRequests.intro')}
        </Text>
        <View style={dense && styles.bleed}>
          <RowList items={items} gutter={dense ? tokens.spaceMd : 0} />
        </View>
      </Section>
    </View>
  );
}

function RecoveryRow({
  request,
  lit,
  dense,
  locale,
  face,
  onTarget,
  onAnswer,
}: {
  request: RecoveryRequest;
  lit: boolean;
  dense: boolean;
  locale: string;
  face: MemberFace;
  onTarget: OnTarget;
  onAnswer: (id: string, answer: RecoveryAnswer) => void;
}) {
  const { t } = useTranslation();
  const side = dense ? 36 : 40;
  const testID = `members.recovery.${request.id}`;

  return (
    <View
      ref={(view) => onTarget(request.id, 'box', view)}
      collapsable={false}
      style={[
        dense ? styles.rowDense : styles.row,
        lit && styles.lit,
        lit && !dense && styles.litPast,
      ]}
      testID={testID}
    >
      <View
        ref={(view) => onTarget(request.id, 'group', view)}
        style={styles.group}
        accessible
        accessibilityLabel={recoveryHeard(t, request)}
      >
        <Avatar {...face} side={side} />
        <View style={styles.words}>
          <TitleBesideTag
            style={styles.titleRow}
            title={
              <Text
                size={16}
                weight="semibold"
                accessible={false}
                style={[styles.name, lit && styles.accent]}
              >
                {askerName(t, request)}
              </Text>
            }
            tag={<Tag kind="waiting" word={t('recoveryRequests.mark')} wraps />}
          />
          {recoveryFacts(t, request).map((fact) => (
            <Text
              key={fact}
              size={14}
              weight="medium"
              accessible={false}
              style={[styles.secondary, styles.fact]}
            >
              {fact}
            </Text>
          ))}
        </View>
      </View>
      <View style={{ marginLeft: side + tokens.spaceLg }}>
        {request.own ? (
          <Text size={14} weight="medium" style={styles.own}>
            {ownLine(t, request, locale)}
          </Text>
        ) : (
          <View style={styles.answers}>
            <TextAction
              ref={(view) => onTarget(request.id, 'approve', view)}
              label={t('recoveryRequests.approve')}
              onPress={() => onAnswer(request.id, 'approve')}
              testID={`${testID}.approve`}
            />
            <TextAction
              ref={(view) => onTarget(request.id, 'turnDown', view)}
              label={t('recoveryRequests.turnDown')}
              onPress={() => onAnswer(request.id, 'turnDown')}
              testID={`${testID}.turnDown`}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/** The card's step: when the request is not wholly in view, the list's head comes up to `top` under the scroll's top, as the phone's board draws it. */
export function bringListUp(
  list: ViewInstance | null,
  request: ViewInstance | null | undefined,
  scroll: ScrollViewInstance | null,
  top: number,
  clear: number,
): void {
  const content = scroll?.getInnerViewRef();
  if (list == null || request == null || scroll == null || content == null) return;
  scroll.measureInWindow((_sx, scrollY, _sw, shown) => {
    request.measureInWindow((_x, y, _w, height) => {
      if (y >= scrollY + top && y + height <= scrollY + shown - clear) return;
      list.measureLayout(content, (_lx, listY) => {
        content.measure((_cx, _cy, _cw, contentHeight) => {
          const most = Math.max(0, contentHeight - shown);
          scroll.scrollTo({ y: Math.min(most, Math.max(0, listY - top)), animated: true });
        });
      });
    });
  });
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  intro: { lineHeight: 15 * 1.45, paddingBottom: tokens.spaceXs },
  bleed: { marginHorizontal: -tokens.spaceMd },
  row: { paddingVertical: 11 },
  rowDense: { paddingVertical: 9, paddingHorizontal: tokens.spaceMd },
  lit: SELECTED_ROW,
  litPast: { marginHorizontal: -tokens.spaceMd, paddingHorizontal: tokens.spaceMd },
  group: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceLg },
  words: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceSm,
    rowGap: tokens.spaceXxs,
  },
  name: { ...TITLE_BESIDE_TAG, lineHeight: 16 * 1.3 },
  fact: { lineHeight: 14 * 1.4 },
  answers: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl, marginTop: 3 },
  own: { lineHeight: 14 * 1.4, marginTop: tokens.spaceXs },
});
