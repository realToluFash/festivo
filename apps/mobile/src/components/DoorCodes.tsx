import type { DoorCodeCard, OrganisationEvent } from '@soirely/api-client';
import { type Ref, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { api } from '../api.ts';
import {
  BLANK_FORM,
  type CodeClock,
  cardStep,
  COUNT_EVERY_MS,
  countLine,
  formFrom,
  type MakeForm,
  makeNewAsks,
  roleLine,
  saidCode,
  shownCode,
  underCard,
} from '../kit/doorCodes.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { tokens } from '../theme/tokens.ts';
import { MakeDoorCode } from './MakeDoorCode.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { ShowDoorCode } from './ShowDoorCode.tsx';
import {
  Ask,
  CardSays,
  GlassTag,
  type MarkKind,
  OnCard,
  SummaryCard,
  TextAction,
} from './Summary.tsx';
import { Text } from './Text.tsx';
import { codeClock, useCodeAsk } from './useCodeAsk.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

interface Making {
  open: boolean;
  visit: number;
  form: MakeForm;
  /** The stopped or expired code a new one takes the place of. */
  replaces: string | null;
}

interface Showing {
  open: boolean;
  visit: number;
  id: string;
}

const TAGS: Record<'full' | 'stopped' | 'expired', { word: string; mark: MarkKind }> = {
  full: { word: 'doorCodes.status.full', mark: 'ended' },
  stopped: { word: 'doorCodes.status.stopped', mark: 'paused' },
  expired: { word: 'doorCodes.status.expired', mark: 'ended' },
};

/** The door codes on People, under Add, as the app demo draws them (sc-72): a card each, what is under it, and the screens and Asks they open. */
export function DoorCodes({
  event,
  codes,
  onCodes,
  tell,
}: {
  event: OrganisationEvent;
  codes: readonly DoorCodeCard[];
  onCodes: (change: (was: readonly DoorCodeCard[]) => DoorCodeCard[]) => void;
  tell: (words: string | null) => void;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const clock = codeClock(event, now);
  const [making, setMaking] = useState<Making | null>(null);
  const [showing, setShowing] = useState<Showing | null>(null);
  const steps = useRef(new Map<string, ViewInstance>());
  const firstStep = useRef<ViewInstance>(null);
  const opener: Opener = useRef<ScreenReaderTarget | null>(null);
  const replace = useCallback(
    (id: string, card: DoorCodeCard) =>
      onCodes((was) => was.map((one) => (one.id === id ? card : one))),
    [onCodes],
  );
  const ask = useCodeAsk(event.id, clock, (was, card, kind) => {
    replace(was, card);
    if (kind === 'new') tell(t('doorCodes.made'));
  });

  const shownId = showing?.open === true ? showing.id : null;
  useEffect(() => {
    if (shownId == null) return;
    const timer = setInterval(() => {
      api.doorCodes(event.id).then(
        (fresh) => {
          const read = fresh.find((one) => one.id === shownId);
          if (read != null) replace(shownId, read);
        },
        () => undefined,
      );
    }, COUNT_EVERY_MS);

    return () => clearInterval(timer);
  }, [event.id, shownId, replace]);

  function openerFor(id: string | null): void {
    opener.current = id == null ? firstStep.current : (steps.current.get(id) ?? null);
  }

  function openMake(replacing: DoorCodeCard | null): void {
    openerFor(replacing?.id ?? null);
    tell(null);
    setMaking((was) => ({
      open: true,
      visit: (was?.visit ?? 0) + 1,
      form: replacing == null ? BLANK_FORM : formFrom(replacing),
      replaces: replacing?.id ?? null,
    }));
  }

  function made(card: DoorCodeCard): void {
    const replaces = making?.replaces ?? null;
    onCodes((was) =>
      replaces == null ? [...was, card] : was.map((one) => (one.id === replaces ? card : one)),
    );
    setMaking((was) => (was == null ? null : { ...was, open: false }));
    tell(t('doorCodes.made'));
  }

  function makeNew(code: DoorCodeCard): void {
    if (!makeNewAsks(code.status)) {
      openMake(code);
      return;
    }
    openerFor(code.id);
    tell(null);
    ask.askAbout('new', code);
  }

  function stop(code: DoorCodeCard): void {
    openerFor(code.id);
    tell(null);
    ask.askAbout('stop', code);
  }

  function show(code: DoorCodeCard): void {
    openerFor(code.id);
    tell(null);
    setShowing((was) => ({ open: true, visit: (was?.visit ?? 0) + 1, id: code.id }));
  }

  const asked = ask.asking == null ? null : codes.find((one) => one.id === ask.asking?.id);
  const shown = showing == null ? null : codes.find((one) => one.id === showing.id);

  return (
    <>
      {codes.length === 0 ? (
        <SummaryCard
          height={176}
          gap={10}
          step={{
            label: t('doorCodes.makeFirst'),
            onPress: () => openMake(null),
            ref: firstStep,
            testID: 'door.make.first',
          }}
          testID="door.card.none"
        >
          <CardSays text={t('doorCodes.noneSays')} />
          <OnCard text={t('doorCodes.noneLine')} />
        </SummaryCard>
      ) : (
        codes.map((code) => (
          <CodeCard
            key={code.id}
            code={code}
            clock={clock}
            stepRef={(node) => {
              if (node == null) steps.current.delete(code.id);
              else steps.current.set(code.id, node);
            }}
            onShow={() => show(code)}
            onMakeNew={() => makeNew(code)}
            onStop={() => stop(code)}
          />
        ))
      )}
      {codes.length > 0 && (
        <TextAction
          label={t('doorCodes.another')}
          glyph="plus"
          onPress={() => openMake(null)}
          testID="door.another"
        />
      )}
      {asked != null && ask.asking != null && showing?.open !== true && (
        <Ask open={ask.asking.open} opener={opener} {...ask.props(asked, t, 'door.ask')} />
      )}
      {making != null && (
        <MakeDoorCode
          key={`make-${making.visit}`}
          open={making.open}
          eventId={event.id}
          form={making.form}
          replaces={making.replaces}
          clock={clock}
          opener={opener}
          onClose={() => setMaking((was) => (was == null ? null : { ...was, open: false }))}
          onMade={made}
        />
      )}
      {showing != null && shown != null && (
        <ShowDoorCode
          key={`show-${showing.visit}`}
          open={showing.open}
          code={shown}
          event={event}
          clock={clock}
          opener={opener}
          onClose={() => setShowing((was) => (was == null ? null : { ...was, open: false }))}
          onAnswer={(was, card, kind) => {
            replace(was, card);
            if (kind === 'stop')
              setShowing((then) => (then == null ? null : { ...then, open: false }));
            else setShowing((then) => (then == null ? null : { ...then, id: card.id }));
          }}
        />
      )}
    </>
  );
}

/** A code on People: what it gives, the code read in its groups, how far it has gone, one step; a tag only when it is not working. */
function CodeCard({
  code,
  clock,
  onShow,
  onMakeNew,
  onStop,
  stepRef,
}: {
  code: DoorCodeCard;
  clock: CodeClock;
  onShow: () => void;
  onMakeNew: () => void;
  onStop: () => void;
  stepRef: Ref<ViewInstance>;
}) {
  const { t } = useTranslation();
  const tag = code.status === 'working' ? null : TAGS[code.status];
  const shows = cardStep(code.status) === 'show';
  const under = underCard(code.status);

  return (
    <>
      <SummaryCard
        height={200}
        gap={10}
        step={{
          label: shows ? t('doorCodes.show') : t('doorCodes.makeNew'),
          onPress: shows ? onShow : onMakeNew,
          ref: stepRef,
          testID: `door.step.${code.id}`,
        }}
        testID={`door.card.${code.id}`}
      >
        <OnCard text={roleLine(code, t)} />
        <View style={styles.codeRow}>
          <Text
            size={30}
            weight="bold"
            accessibilityLabel={t('doorCodes.said', { code: saidCode(code.code) })}
            style={styles.code}
          >
            {shownCode(code.code)}
          </Text>
          {tag != null && <GlassTag word={t(tag.word)} mark={tag.mark} />}
        </View>
        <OnCard text={countLine(code, clock, t)} />
      </SummaryCard>
      {under.length > 0 && (
        <View style={styles.under}>
          {under.includes('makeNew') && (
            <TextAction
              label={t('doorCodes.makeNew')}
              onPress={onMakeNew}
              testID={`door.new.${code.id}`}
            />
          )}
          {under.includes('stop') && (
            <TextAction
              label={t('doorCodes.stop')}
              removes
              onPress={onStop}
              testID={`door.stop.${code.id}`}
            />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  codeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceLg,
    rowGap: tokens.spaceXs,
  },
  code: {
    color: tokens.colorInkOnDark,
    letterSpacing: 30 * 0.04,
    lineHeight: 30 * 1.15,
    fontVariant: ['tabular-nums'],
  },
  under: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
});
