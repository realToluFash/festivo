import type { FloorTapStep } from '@soirely/api-client';
import {
  type FloorGroup,
  type FloorGuest,
  type FloorRead,
  type FloorReversed,
  type FloorTable,
  type FloorWord,
  type Freshness,
  type HeldChoice,
  type PlateStage,
  type SentBackReason,
  type ServiceGuestRead,
  type ServiceOrderRead,
  type ServicePlateRead,
  type TapRefusal,
  HELD_CHOICES,
  SENT_BACK_REASONS,
  UNDO_MINUTES,
  floorGroups,
  freshnessKey,
  owesSentBack,
  refusalKey,
  roomCourse,
  sectionsMoved,
  stageLeftBy,
} from '@soirely/domain';
import { type TFunction } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dateLocale } from '../i18n/index.ts';
import { tableName } from '../kit/tableName.ts';
import { useFloor } from '../kit/useFloor.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { Glyph } from './Glyph.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Sheet, SheetActions } from './Sheet.tsx';
import { Text } from './Text.tsx';
import { useSystemBack } from './useSystemBack.ts';

type Shape = 'ring' | 'dot' | 'hatched' | 'dashed' | 'grey' | 'filled';

const SHAPE_OF_WORD: Record<FloorWord, Shape> = {
  toServe: 'ring',
  onATray: 'dot',
  waitingOnTheKitchen: 'hatched',
  notHereYet: 'dashed',
  notFiredYet: 'grey',
  served: 'filled',
};

const SHAPE_OF_STAGE: Record<PlateStage, Shape> = {
  toServe: 'ring',
  dishing: 'dot',
  checked: 'dot',
  onItsWay: 'dot',
  served: 'filled',
};

const SAID_UNREAD = {
  loading: 'service.floor.title',
  failed: 'service.floor.loadFailed',
  refused: 'service.floor.refused.title',
} as const;

interface SendingBack {
  plate: ServicePlateRead;
  guest: string;
  table: string;
  reason: SentBackReason | null;
}

type SendBackPress = (plate: ServicePlateRead, guest: string, opener: ViewInstance | null) => void;

interface Undoable {
  subject: string;
  stage: PlateStage;
  line: string;
  until: Date;
  reverses: FloorReversed;
}

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

function clock(at: Date): string {
  return new Intl.DateTimeFormat(dateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}

function seatName(t: TFunction, guest: ServiceGuestRead): string {
  return guest.name ?? t('service.floor.seat', { seat: guest.seat });
}

function itemsOf(plate: ServicePlateRead, t: TFunction): string {
  return plate.items.map((one) => one.name ?? t('service.floor.chefsChoice')).join(', ');
}

function itemsInSentence(plate: ServicePlateRead, t: TFunction): string {
  return plate.items.map((one) => one.name ?? t('service.floor.chefsChoiceInSentence')).join(', ');
}

function listLine(t: TFunction, read: FloorRead): string {
  const course = roomCourse(read)?.course.name;

  return course == null ? read.event : t('service.floor.listLine', { event: read.event, course });
}

function movedLine(t: TFunction, sections: string[]): string {
  const section = new Intl.ListFormat(dateLocale(), { type: 'conjunction' }).format(sections);

  return t('service.floor.moved', { section });
}

function noSectionLine(t: TFunction, lead: string | null): string {
  return lead == null ? t('service.floor.noSectionNoLead') : t('service.floor.noSection', { lead });
}

function wordSaid(t: TFunction, table: FloorTable): string {
  const word = t(`service.floor.word.${table.word}`);

  return table.earlierCourse == null
    ? word
    : t('service.floor.earlier', { course: table.earlierCourse, word });
}

/** Floor (sc-4021): every table, yours first, each in the plan's word; a table opens to its seats, where a held guest's choice and a plate sent back are made. */
export function FloorScreen({
  eventId,
  onBack,
  from = null,
}: {
  eventId: string;
  onBack: () => void;
  /** The way in it opened from (sc-98893): its ‹ names Overview or Your night. */
  from?: 'overview' | 'night' | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const kind = useLayout().kind;
  const phone = kind === 'phone';
  const wide = kind === 'tabletLandscape';
  const floor = useFloor(eventId);
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState<SendingBack | null>(null);
  const [undo, setUndo] = useState<Undoable | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const yoursWas = useRef<string[] | null>(null);
  const openerRef = useRef<ViewInstance | null>(null);
  const headingRef = useRef<ViewInstance | null>(null);

  useReadOut(heard);
  useSystemBack(!wide && open != null, () => setOpen(null));

  const read = floor.seen.kind === 'shown' ? floor.seen.floor : null;

  useEffect(() => {
    if (read == null) return;
    const was = yoursWas.current;
    yoursWas.current = read.yours.map((one) => one.id);
    const now = was == null ? null : sectionsMoved(was, read.yours);
    if (now == null) return;
    const line = now.length === 0 ? null : movedLine(t, now);
    setMoved(line);
    // Left on none, the no-tables line stands in Yours' place; it is only said here.
    if (line != null) setHeard(line);
    else if (!read.manage) setHeard(noSectionLine(t, read.floorLead));
  }, [read, t]);

  useEffect(() => {
    if (undo == null) return;
    const left = undo.until.getTime() - Date.now();
    const timer = setTimeout(() => setUndo(null), Math.max(0, left));

    return () => clearTimeout(timer);
  }, [undo]);

  if (floor.seen.kind !== 'shown' || read == null) {
    const unread = floor.seen.kind === 'shown' ? 'loading' : floor.seen.kind;

    return (
      <View style={[styles.page, styles.centred, { paddingTop: insets.top }]}>
        <Text size={16} weight="medium">
          {t(SAID_UNREAD[unread])}
        </Text>
        {unread === 'refused' && (
          <>
            <Text size={15} weight="medium" style={styles.secondary}>
              {t('service.floor.refused.line')}
            </Text>
            <SecondaryButton
              label={t('service.floor.listBack')}
              onPress={onBack}
              testID="floor.refused.back"
            />
          </>
        )}
        {unread === 'failed' && (
          <SecondaryButton
            label={t('service.floor.tryAgain')}
            onPress={floor.retry}
            testID="floor.retry"
          />
        )}
      </View>
    );
  }

  const groups = floorGroups(read, dateLocale());
  const tables = groups.flatMap((g) => (g.kind === 'noSection' ? [] : g.tables));
  const shown = tables.find((one) => one.key === open) ?? (wide ? tables[0] : undefined) ?? null;
  const inFront = !wide && open != null && shown != null;
  const backLabel =
    from == null
      ? t('service.floor.listBack')
      : from === 'overview'
        ? t('eventNav.overview')
        : t('myNight.title');
  const pad = phone ? tokens.spaceXl : 28;
  // A kept Undo names its plate in the body.
  const keptOn = new Set(
    floor.kept.flatMap((tap) => [tap.path.split('/')[2], tap.body.subject as string | undefined]),
  );

  const made = (
    step: FloorTapStep,
    plate: ServicePlateRead,
    line: string,
    reverses: FloorReversed,
  ) => {
    const expected = { plates: { [plate.id]: plate.stage } };
    void floor.tap(step, expected).then((ok) => {
      if (!ok) return;
      setUndo({
        subject: plate.id,
        reverses,
        stage: stageLeftBy(plate, reverses),
        line,
        until: new Date(Date.now() + UNDO_MINUTES * 60_000),
      });
      setHeard(line);
    });
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {!inFront && (
          <ScrollView
            style={wide ? styles.listPane : styles.grow}
            contentContainerStyle={[styles.body, { paddingHorizontal: wide ? 20 : pad }]}
            testID="floor.list"
          >
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              style={styles.back}
              testID="floor.back"
            >
              {from == null ? (
                <Text size={15} weight="semibold" style={styles.accent}>
                  {backLabel}
                </Text>
              ) : (
                <View style={styles.backTo}>
                  <Text
                    size={15}
                    weight="semibold"
                    style={styles.accent}
                    importantForAccessibility="no"
                  >
                    ‹
                  </Text>
                  <Text size={15} weight="semibold" style={styles.accent}>
                    {backLabel}
                  </Text>
                </View>
              )}
            </Pressable>
            <View style={styles.header}>
              <Text size={wide ? 28 : 30} weight="bold" accessibilityRole="header">
                {t('service.floor.title')}
              </Text>
              <Text size={15} weight="medium" style={styles.secondary}>
                {listLine(t, read)}
              </Text>
              <Strip freshness={floor.freshness} />
            </View>
            {moved != null && (
              <View style={styles.moved} testID="floor.moved">
                <Text size={15} weight="semibold" style={styles.grow}>
                  {moved}
                </Text>
              </View>
            )}
            <NotSent refusals={floor.notSent} read={read} onDismiss={floor.dismissNotSent} />
            {groups.map((group) => (
              <Group
                key={group.kind === 'yours' ? group.section.id : group.kind}
                group={group}
                current={wide ? (shown?.key ?? null) : null}
                phone={phone}
                onOpen={setOpen}
              />
            ))}
          </ScrollView>
        )}
        {(wide || inFront) && shown != null && (
          <View style={styles.grow}>
            <ScrollView
              contentContainerStyle={[styles.body, styles.tableBody, { paddingHorizontal: pad }]}
              testID="floor.table"
            >
              <TableView
                read={read}
                table={shown}
                wide={wide}
                phone={phone}
                freshness={floor.freshness}
                keptOn={keptOn}
                notSent={
                  <NotSent refusals={floor.notSent} read={read} onDismiss={floor.dismissNotSent} />
                }
                onClose={() => setOpen(null)}
                onChoose={(order, guest, choice) =>
                  made(
                    { kind: 'choice', plateId: order.id, choice },
                    order,
                    t('service.floor.step.choice', {
                      guest,
                      choice: t(`service.choice.${choice}`),
                    }),
                    { kind: 'choice', was: order.choice },
                  )
                }
                headingRef={headingRef}
                onSendBack={(plate, guest, opener) => {
                  openerRef.current = opener;
                  setSending({ plate, guest, table: tableName(t, shown), reason: null });
                }}
              />
            </ScrollView>
            {undo != null && (
              <View style={[styles.undo, { left: pad, right: pad }]} testID="floor.undo">
                <View style={styles.grow}>
                  <Text size={15} weight="semibold" style={styles.onDark}>
                    {undo.line}
                  </Text>
                  <Text size={13} weight="medium" style={styles.onDarkSoft}>
                    {t('service.floor.undoUntil', { time: clock(undo.until) })}
                  </Text>
                  {keptOn.has(undo.subject) && (
                    <Text size={13} weight="semibold" style={styles.onDarkSoft}>
                      {t('service.waitingToSend')}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => {
                    void floor.tap(
                      { kind: 'undo', subject: undo.subject, reverses: undo.reverses },
                      { plates: { [undo.subject]: undo.stage } },
                    );
                    setUndo(null);
                    setHeard(t('service.floor.undone'));
                  }}
                  accessibilityRole="button"
                  style={[styles.undoButton, phone && styles.phoneHit]}
                  testID="floor.undo.press"
                >
                  <Text size={15} weight="bold">
                    {t('service.floor.undo')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
      <Sheet
        open={sending != null}
        onClose={() => setSending(null)}
        scrimLabel={t('service.floor.cancel')}
        opener={openerRef}
        testID="floor.sheet"
      >
        {sending != null && (
          <SendBackSheet
            sending={sending}
            lead={read.floorLead}
            phone={phone}
            onPick={(reason) => setSending({ ...sending, reason })}
            onCancel={() => setSending(null)}
            onSend={(reason) => {
              made(
                { kind: 'sendBack', plateId: sending.plate.id, reason },
                sending.plate,
                t('service.floor.step.sentBack', {
                  guest: sending.guest,
                  items: itemsInSentence(sending.plate, t),
                  reason: t(`service.sentBack.${reason}`),
                }),
                { kind: 'sendBack', was: sending.plate.owedReason },
              );
              openerRef.current = headingRef.current;
              setSending(null);
            }}
          />
        )}
      </Sheet>
    </View>
  );
}

function Strip({ freshness }: { freshness: Freshness }) {
  const { t } = useTranslation();
  const asOf = freshness.state === 'notStarted' ? null : freshness.asOf;
  const count = freshness.state === 'noConnection' ? freshness.waiting : 0;

  return (
    <View style={styles.strip} testID="floor.strip">
      {freshness.state === 'connected' && <View style={styles.live} {...hidden} />}
      <Text
        size={14}
        weight={freshness.state === 'connected' ? 'medium' : 'semibold'}
        style={styles.grow}
      >
        {t(freshnessKey(freshness), { time: asOf == null ? '–' : clock(asOf), count })}
      </Text>
    </View>
  );
}

function NotSent({
  refusals,
  read,
  onDismiss,
}: {
  refusals: TapRefusal[];
  read: FloorRead;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  if (refusals.length === 0) return null;
  const guests = read.courses.flatMap((c) => c.tables.flatMap((table) => table.guests));
  const who = (id: string) => {
    const guest = guests.find((one) => one.id === id);

    return guest == null ? '' : seatName(t, guest);
  };

  return (
    <View style={styles.notSent} accessibilityRole="alert" testID="floor.notSent">
      <Text size={15} weight="bold">
        {t('service.notSent.heading')}
      </Text>
      {refusals.map((refusal, i) => {
        const key = refusalKey(refusal);
        const line =
          key == null
            ? refusal.kind === 'other'
              ? refusal.title
              : ''
            : t(key, {
                who: 'guestId' in refusal ? who(refusal.guestId) : '',
                by: 'by' in refusal ? refusal.by : '',
                item: 'item' in refusal ? refusal.item : '',
                name: 'name' in refusal ? refusal.name : '',
                count: UNDO_MINUTES,
              });

        return (
          <Text key={String(i)} size={15} weight="medium">
            {line}
          </Text>
        );
      })}
      <View style={styles.start}>
        <SecondaryButton
          label={t('service.floor.dismiss')}
          onPress={onDismiss}
          testID="floor.notSent.dismiss"
        />
      </View>
    </View>
  );
}

function ShapeMark({ shape }: { shape: Shape }) {
  return <View style={[styles.shape, styles[shape]]} {...hidden} />;
}

function WordLine({ shape, said, size }: { shape: Shape; said: string; size: number }) {
  return (
    <View style={styles.wrap}>
      <ShapeMark shape={shape} />
      <Text size={size} weight="semibold" style={styles.grow}>
        {said}
      </Text>
    </View>
  );
}

function FlagWords({ guest }: { guest: ServiceGuestRead }) {
  const { t } = useTranslation();
  const { allergens, allergenOther, diet, dietOther } = guest.flags;
  const words = [
    ...allergens.map((code) => t(`guestNeeds.allergen.${code}`)),
    ...(allergenOther == null ? [] : [allergenOther]),
    ...diet.map((code) => t(`guestNeeds.dietName.${code}`)),
    ...(dietOther == null ? [] : [dietOther]),
  ];

  return (
    <>
      {words.map((word) => (
        <View key={word} style={styles.flag}>
          <Glyph name="alert" size={13} ink={tokens.colorBrokenText} />
          <Text size={14} weight="semibold" style={styles.flagText}>
            {word}
          </Text>
        </View>
      ))}
    </>
  );
}

function Group({
  group,
  current,
  phone,
  onOpen,
}: {
  group: FloorGroup;
  current: string | null;
  phone: boolean;
  onOpen: (key: string) => void;
}) {
  const { t } = useTranslation();

  if (group.kind === 'noSection') {
    return (
      <View style={styles.none} testID="floor.none">
        <Text size={15} weight="medium" style={styles.grow}>
          {noSectionLine(t, group.lead)}
        </Text>
      </View>
    );
  }

  const other = group.kind === 'other';

  return (
    <View style={styles.group} testID={`floor.group.${group.kind}`}>
      <Text size={17} weight="bold" accessibilityRole="header">
        {other
          ? t('service.floor.other')
          : t('service.floor.yours', { section: group.section.name })}
      </Text>
      {group.tables.map((table) => (
        <Row
          key={table.key}
          table={table}
          other={other}
          current={current === table.key}
          phone={phone}
          onPress={() => onOpen(table.key)}
        />
      ))}
    </View>
  );
}

function Row({
  table,
  other,
  current,
  phone,
  onPress,
}: {
  table: FloorTable;
  other: boolean;
  current: boolean;
  phone: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const served = t('service.floor.servedCount', { n: table.served, count: table.ordered });
  const covers = t('service.floor.covers', { count: table.covers });
  const name = tableName(t, table);
  const said = [
    name,
    wordSaid(t, table),
    served,
    covers,
    ...(table.flagged.length > 0
      ? [t('service.floor.flaggedSaid', { count: table.flagged.length })]
      : []),
    ...(other && table.section != null ? [table.section.name] : []),
  ].join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={said}
      accessibilityState={{ selected: current }}
      style={({ pressed }) => [
        styles.rowCard,
        phone && styles.rowPhone,
        current && styles.rowCurrent,
        pressed && styles.pressed,
      ]}
      testID={`floor.row.${name}`}
    >
      <View style={[styles.grow, styles.rowText]}>
        <View style={styles.wrap}>
          <Text size={17} weight="bold">
            {name}
          </Text>
          {other && table.section != null && (
            <Text size={14} weight="medium" style={styles.secondary}>
              {table.section.name}
            </Text>
          )}
        </View>
        <WordLine shape={SHAPE_OF_WORD[table.word]} said={wordSaid(t, table)} size={15} />
        <View style={styles.meta}>
          <Text size={14} weight="medium" style={styles.secondary}>
            {served}
          </Text>
          <Text size={14} weight="medium" style={styles.secondary}>
            {covers}
          </Text>
          {table.flagged.length > 0 && (
            <View style={styles.flag}>
              <Glyph name="alert" size={13} ink={tokens.colorBrokenText} />
              <Text size={14} weight="semibold" style={styles.flagText}>
                {t('service.floor.flagged', { count: table.flagged.length })}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Glyph name="chevron" size={20} ink={tokens.colorInkTertiary} />
    </Pressable>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.part}>
      <Text size={15} weight="bold" style={styles.secondary} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function stageSaid(t: TFunction, guest: ServiceGuestRead): { shape: Shape; said: string } {
  if (guest.order?.held === true) return { shape: 'hatched', said: t('service.held') };
  if (guest.order != null)
    return {
      shape: SHAPE_OF_STAGE[guest.order.stage],
      said: t(`service.stage.${guest.order.stage}`),
    };

  // No order and no reason: they have arrived and nothing is fired for the table.
  if (guest.noOrder == null) return { shape: 'grey', said: t('service.floor.word.notFiredYet') };

  return { shape: 'dashed', said: t(`service.noOrder.${guest.noOrder}`) };
}

function TableView({
  read,
  table,
  wide,
  phone,
  freshness,
  keptOn,
  headingRef,
  onClose,
  onChoose,
  onSendBack,
  notSent,
}: {
  notSent: React.ReactNode;
  read: FloorRead;
  table: FloorTable;
  wide: boolean;
  phone: boolean;
  freshness: Freshness;
  keptOn: Set<string | undefined>;
  headingRef: React.RefObject<ViewInstance | null>;
  onClose: () => void;
  onChoose: (order: ServiceOrderRead, guest: string, choice: HeldChoice) => void;
  onSendBack: SendBackPress;
}) {
  const { t } = useTranslation();
  const course = read.courses.find((one) => one.course.id === table.courseId);
  const courseOf = (id: string) =>
    read.courses.find((one) => one.course.id === id)?.course.name ?? '';
  const { flagged, trays } = table;
  const section = table.section?.name ?? '';

  return (
    <>
      <View style={styles.header}>
        {!wide && (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.floorBack, phone && styles.phoneHit]}
            testID="floor.table.back"
          >
            <Glyph name="back" size={22} ink={tokens.colorAccentText} />
            <Text size={16} weight="semibold" style={styles.accent}>
              {t('service.floor.back')}
            </Text>
          </Pressable>
        )}
        <View ref={headingRef}>
          <Text size={wide ? 28 : 30} weight="bold" accessibilityRole="header">
            {tableName(t, table)}
          </Text>
        </View>
        <WordLine shape={SHAPE_OF_WORD[table.word]} said={wordSaid(t, table)} size={16} />
        <Text size={15} weight="medium" style={styles.secondary}>
          {t('service.floor.header', {
            covers: t('service.floor.covers', { count: table.covers }),
            section,
          })}
        </Text>
        <Strip freshness={freshness} />
      </View>
      {notSent}
      {flagged.length > 0 && (
        <Part title={t('service.floor.flaggedGuests')}>
          {flagged.map((guest) => (
            <View
              key={guest.id}
              style={styles.flagged}
              testID={`floor.flagged.${String(guest.seat)}`}
            >
              <Text size={16} weight="bold">
                {seatName(t, guest)}
              </Text>
              <FlagWords guest={guest} />
              {guest.order != null && (
                <Text size={14} weight="medium">
                  {itemsOf(guest.order, t)}
                </Text>
              )}
              <WordLine {...stageSaid(t, guest)} size={14} />
            </View>
          ))}
        </Part>
      )}
      {trays.length > 0 && (
        <Part title={t('service.floor.trays')}>
          {trays.map((tray) => (
            <View key={tray.id} style={styles.tray}>
              <Text size={15} weight="semibold">
                {t('service.floor.tray', {
                  waiter: tray.waiter,
                  plates: t('service.floor.plates', { count: tray.plates }),
                  stage: tray.stage == null ? '' : t(`service.stage.${tray.stage}`),
                })}
              </Text>
            </View>
          ))}
        </Part>
      )}
      <Part title={t('service.floor.seats')}>
        <View style={styles.seats}>
          {table.guests.map((guest) => (
            <Seat
              key={guest.id}
              guest={guest}
              table={table}
              phone={phone}
              keptOn={keptOn}
              courseOf={courseOf}
              ready={(key) => course?.items.find((item) => item.key === key)}
              onChoose={onChoose}
              onSendBack={onSendBack}
            />
          ))}
        </View>
      </Part>
      <View style={styles.onIt}>
        <Text size={15} weight="semibold">
          {table.people.length === 0
            ? t('service.floor.onItNobody', { section })
            : t('service.floor.onIt', {
                section,
                people: table.people.map((one) => one.name).join(', '),
              })}
        </Text>
      </View>
    </>
  );
}

function Seat({
  guest,
  table,
  phone,
  keptOn,
  courseOf,
  ready,
  onChoose,
  onSendBack,
}: {
  guest: FloorGuest;
  table: FloorTable;
  phone: boolean;
  keptOn: Set<string | undefined>;
  courseOf: (id: string) => string;
  ready: (key: string) => { readyIn: number | null; name: string | null } | undefined;
  onChoose: (order: ServiceOrderRead, guest: string, choice: HeldChoice) => void;
  onSendBack: SendBackPress;
}) {
  const { t } = useTranslation();
  const buttons = useRef(new Map<string, ViewInstance | null>());
  const order = guest.order;
  const name = seatName(t, guest);
  const held = order?.held === true ? order : null;
  const anyReady = order != null && order.items.some((item) => item.state === 'ready');
  const readyIn = held?.holding.map((key) => ready(key)?.readyIn).find((n) => n != null) ?? null;
  const sendable = (plate: ServicePlateRead) => table.mayWrite && plate.stage === 'served';
  const owedBack = owesSentBack(guest);

  return (
    <View style={styles.seat} testID={`floor.seat.${String(guest.seat)}`}>
      <View style={styles.badge} {...hidden}>
        <Text size={15} weight="bold" accessible={false}>
          {String(guest.seat)}
        </Text>
      </View>
      <View style={[styles.grow, styles.seatText]}>
        <View style={styles.wrap}>
          <Text size={16} weight="bold">
            {name}
          </Text>
          {guest.name != null && (
            <Text size={14} weight="medium" style={styles.secondary}>
              {t('service.floor.seat', { seat: guest.seat })}
            </Text>
          )}
        </View>
        <FlagWords guest={guest} />
        {order != null && (
          <Text size={15} weight="medium">
            {itemsOf(order, t)}
          </Text>
        )}
        <WordLine {...stageSaid(t, guest)} size={14} />
        {held != null && (
          <View style={styles.held}>
            <Text size={14} weight="medium" style={styles.secondary}>
              {[
                held.holding.map((key) => ready(key)?.name ?? key).join(', '),
                ...(readyIn == null ? [] : [t('service.readyIn', { minutes: readyIn })]),
              ].join(' · ')}
            </Text>
            {!table.mayWrite && held.choice != null && (
              <Text size={14} weight="semibold">
                {t(`service.choice.${held.choice}`)}
              </Text>
            )}
            {table.mayWrite && (
              <View style={styles.choices}>
                {HELD_CHOICES.filter((choice) => choice !== 'whatsReadyNow' || anyReady).map(
                  (choice) => {
                    const on = held.choice === choice;

                    return (
                      <Pressable
                        key={choice}
                        onPress={() => onChoose(held, name, choice)}
                        accessibilityRole="togglebutton"
                        accessibilityState={{ checked: on }}
                        style={[styles.choice, phone && styles.phoneHit, on && styles.choiceOn]}
                        testID={`floor.choice.${String(guest.seat)}.${choice}`}
                      >
                        {on && <Glyph name="tick" size={16} ink={tokens.colorAccentText} />}
                        <Text size={15} weight={on ? 'bold' : 'semibold'}>
                          {t(`service.choice.${choice}`)}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            )}
            {keptOn.has(held.id) && (
              <Text size={13} weight="semibold" style={styles.chip}>
                {t('service.waitingToSend')}
              </Text>
            )}
          </View>
        )}
        {order != null && !owedBack && sendable(order) && (
          <View style={styles.start}>
            <SecondaryButton
              label={t('service.floor.sendBack')}
              ref={(button) => {
                buttons.current.set(order.id, button);
              }}
              onPress={() => onSendBack(order, name, buttons.current.get(order.id) ?? null)}
              testID={`floor.sendBack.${String(guest.seat)}`}
            />
          </View>
        )}
        {guest.owed.map((plate) => (
          <View key={plate.id} style={styles.owed}>
            <Text size={14} weight="medium">
              {[
                ...(plate.courseId === table.courseId ? [] : [courseOf(plate.courseId)]),
                t(`service.owed.${plate.owedReason ?? 'toFollow'}`),
                ...(plate.owedReason === 'sentBack' && plate.sentBack.length > 0
                  ? [t(`service.sentBack.${plate.sentBack[plate.sentBack.length - 1]!.reason}`)]
                  : []),
                itemsOf(plate, t),
              ].join(' · ')}
            </Text>
            <View style={styles.wrap}>
              <ShapeMark shape={SHAPE_OF_STAGE[plate.stage]} />
              <Text size={14} weight="semibold">
                {t(`service.stage.${plate.stage}`)}
              </Text>
              {keptOn.has(plate.id) && (
                <Text size={13} weight="semibold" style={styles.chip}>
                  {t('service.waitingToSend')}
                </Text>
              )}
            </View>
            {sendable(plate) && (
              <View style={styles.start}>
                <SecondaryButton
                  label={t('service.floor.sendBack')}
                  ref={(button) => {
                    buttons.current.set(plate.id, button);
                  }}
                  onPress={() => onSendBack(plate, name, buttons.current.get(plate.id) ?? null)}
                  testID={`floor.sendBack.${String(guest.seat)}.${plate.id}`}
                />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function SendBackSheet({
  sending,
  lead,
  phone,
  onPick,
  onCancel,
  onSend,
}: {
  sending: SendingBack;
  lead: string | null;
  phone: boolean;
  onPick: (reason: SentBackReason) => void;
  onCancel: () => void;
  onSend: (reason: SentBackReason) => void;
}) {
  const { t } = useTranslation();
  const reason = sending.reason;
  const send = (
    <PrimaryButton
      label={t('service.floor.sendBack')}
      off={reason == null}
      paired={!phone}
      onPress={() => reason != null && onSend(reason)}
      testID="floor.sendBack.send"
    />
  );
  const cancel = (
    <SecondaryButton
      label={t('service.floor.cancel')}
      stacked={phone}
      paired={!phone}
      onPress={onCancel}
      testID="floor.sendBack.cancel"
    />
  );

  return (
    <View style={styles.sheet} testID="floor.sendBack.sheet">
      <View style={styles.header}>
        <Text size={22} weight="bold" accessibilityRole="header">
          {t('service.floor.sendBackTitle', { items: itemsInSentence(sending.plate, t) })}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {t('service.floor.sendBackWho', { guest: sending.guest, table: sending.table })}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" style={styles.reasons}>
        {SENT_BACK_REASONS.map((one) => {
          const on = reason === one;

          return (
            <Pressable
              key={one}
              onPress={() => onPick(one)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={styles.reason}
              testID={`floor.reason.${one}`}
            >
              <View style={[styles.radio, on && styles.radioOn]} {...hidden} />
              <View style={styles.grow}>
                <Text size={16} weight="semibold">
                  {t(`service.sentBack.${one}`)}
                </Text>
                {one === 'allergyConcern' && (
                  <Text size={14} weight="medium" style={styles.secondary}>
                    {lead == null
                      ? t('service.floor.alertsTheLead')
                      : t('service.floor.alertsLead', { lead })}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <SheetActions>
        {phone ? (
          <>
            {send}
            {cancel}
          </>
        ) : (
          <>
            {cancel}
            {send}
          </>
        )}
      </SheetActions>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorInset },
  centred: { alignItems: 'center', justifyContent: 'center', gap: tokens.spaceLg },
  row: { flex: 1, flexDirection: 'row' },
  grow: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  listPane: { width: 400, flexGrow: 0, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  body: { paddingTop: tokens.spaceSm, gap: tokens.spaceXl, paddingBottom: 40 },
  tableBody: { paddingBottom: 140 },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  backTo: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXxs },
  header: { gap: tokens.spaceXs },
  strip: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colorAccent },
  start: { alignItems: 'flex-start' },
  notSent: {
    gap: tokens.spaceMd,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
  },
  moved: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
    borderWidth: 1,
    borderColor: tokens.colorAccentTintBorder,
  },
  none: {
    flexDirection: 'row',
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.colorControlBorder,
  },
  group: { gap: tokens.spaceSm },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    minHeight: 76,
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 16,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  rowPhone: { minHeight: 84, paddingHorizontal: tokens.spaceLg },
  rowCurrent: {
    backgroundColor: tokens.colorAccentTint,
    borderColor: tokens.colorAccent,
    borderLeftWidth: 4,
  },
  pressed: { opacity: tokens.opacityPressed },
  rowText: { gap: 5 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 2 },
  shape: { width: 14, height: 14 },
  ring: { borderRadius: 7, borderWidth: 2, borderColor: tokens.colorInk },
  dot: { borderRadius: 7, backgroundColor: tokens.colorInk },
  hatched: { borderRadius: 3, borderWidth: 2, borderStyle: 'dotted', borderColor: tokens.colorInk },
  dashed: {
    borderRadius: 7,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tokens.colorInkTertiary,
  },
  grey: { borderRadius: 3, backgroundColor: tokens.colorTrack },
  filled: { borderRadius: 3, backgroundColor: tokens.colorAccent },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flagText: { color: tokens.colorBrokenText },
  part: { gap: tokens.spaceSm },
  flagged: {
    gap: 4,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: tokens.colorBrokenTint,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    overflow: 'hidden',
  },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceMd },
  seat: {
    flexGrow: 1,
    flexBasis: 300,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    padding: 14,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colorInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatText: { gap: tokens.spaceXs },
  held: { gap: tokens.spaceSm, alignItems: 'flex-start' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 24,
    backgroundColor: tokens.colorCard,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
  },
  choiceOn: { backgroundColor: tokens.colorAccentTint, borderColor: tokens.colorAccent },
  phoneHit: { minHeight: tokens.sizeHitPhonePrimary },
  owed: {
    gap: tokens.spaceXs,
    paddingLeft: tokens.spaceMd,
    borderLeftWidth: 2,
    borderLeftColor: tokens.colorControlBorder,
  },
  onIt: {
    paddingVertical: tokens.spaceLg,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  floorBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: tokens.sizeHit,
    alignSelf: 'flex-start',
  },
  undo: {
    position: 'absolute',
    bottom: tokens.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    padding: tokens.spaceLg,
    borderRadius: 16,
    backgroundColor: tokens.colorInk,
  },
  onDark: { color: tokens.colorCard },
  onDarkSoft: { color: tokens.colorInkTertiary },
  undoButton: {
    minHeight: tokens.sizeHit,
    paddingHorizontal: tokens.spaceXl,
    borderRadius: 22,
    justifyContent: 'center',
    backgroundColor: tokens.colorCard,
  },
  sheet: { gap: tokens.spaceXl },
  reasons: { gap: tokens.spaceXs },
  reason: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceMd, minHeight: 48 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
  },
  radioOn: { borderWidth: 7, borderColor: tokens.colorAccent },
});
