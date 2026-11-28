import { ApiError, ApiUnreachableError, type GuestRoom } from '@soirely/api-client';
import {
  GUEST_NAME_MAXIMUM,
  type PickedPerson,
  type ReviewRow,
  countryChoices,
  contactsBody,
  numberFields,
  peopleIn,
  planRoom,
  reviewCounts,
  reviewRowsOf,
  rowProblems,
  savedAs,
  stepPlaces,
  toFix,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { contactPicker } from '../../modules/contact-picker/index.ts';
import { api } from '../api.ts';
import { currentLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { AlertLine } from './AlertLine.tsx';
import { Amber, AmberLine } from './Amber.tsx';
import { SearchField } from './EventsSearch.tsx';
import { Field, TextField, focusChecked } from './Field.tsx';
import { DoneLine, SheetBody, SheetLayer } from './FormLayers.tsx';
import { Glyph } from './Glyph.tsx';
import { LineIcon } from './AccountCard.tsx';
import { PhoneEntry } from './PhoneEntry.tsx';
import { RadioMark } from './RadioMark.tsx';
import { useReadOut } from './ReadOut.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { Pill } from './SettingsParts.tsx';
import { type AskProps, ASK_WIDTH, FocusedScreen } from './SummaryOverlays.tsx';
import { TextAction, TurningMark } from './SummaryRows.tsx';
import { Text } from './Text.tsx';
import { useLeaveAsk } from './useLeaveAsk.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

/** Whether this build has the contact picker: one made before it was added has no From contacts. */
export const contactsPickable = contactPicker != null;

export type PickOutcome =
  | { kind: 'picked'; people: PickedPerson[]; refused: boolean }
  | { kind: 'choose' }
  | { kind: 'nothing'; refused: boolean };

/** iOS's picker, many at once; on Android the Contacts permission asked once, then Choose people, or the one-person picker once refused. */
export async function pickContacts(): Promise<PickOutcome> {
  if (contactPicker == null) return { kind: 'nothing', refused: false };

  try {
    if (Platform.OS === 'ios') return picked(await contactPicker.pickMany(), false);
    if (contactPicker.allowed()) return { kind: 'choose' };
    if (!contactPicker.asked() && (await contactPicker.ask())) return { kind: 'choose' };
    const one = await contactPicker.pickOne();

    return picked(one == null ? [] : [one], true);
  } catch {
    return { kind: 'nothing', refused: false };
  }
}

function picked(people: PickedPerson[], refused: boolean): PickOutcome {
  return people.length === 0 ? { kind: 'nothing', refused } : { kind: 'picked', people, refused };
}

/** From contacts above Add guest's fields: the line under it, the refusal once Android was refused, then "or type their details". */
export function FromContactsStart({ refused, onPress }: { refused: boolean; onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.tight}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.contacts, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('fromContacts.button')}
          testID="guest.form.fromContacts"
        >
          <Glyph name="users" size={19} ink={tokens.colorAccentText} weight={2.1} />
          <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
            {t('fromContacts.button')}
          </Text>
        </Pressable>
        <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
          {t('fromContacts.line')}
        </Text>
      </View>
      {refused && (
        <Amber title={null} testID="guest.form.refusedContacts">
          <AmberLine text={t('fromContacts.refused')} ink />
        </Amber>
      )}
      <View
        style={styles.rule}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.ruleLine} />
        <Text size={13} weight="semibold" accessible={false} style={styles.secondary}>
          {t('fromContacts.orType')}
        </Text>
        <View style={styles.ruleLine} />
      </View>
    </>
  );
}

/** A focused screen whose verb is pinned at its foot, over the keys while typing. */
function PinnedScreen({
  open,
  title,
  opener,
  onCancel,
  ask,
  over,
  foot,
  scrollRef,
  children,
  testID,
}: {
  open: boolean;
  title: string;
  opener: Opener;
  onCancel: () => void;
  ask?: AskProps | null;
  over?: { layer: ReactNode; onClose: () => void } | null;
  foot: ReactNode;
  scrollRef?: RefObject<ScrollViewInstance | null>;
  children: ReactNode;
  testID: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <FocusedScreen
      open={open}
      title={title}
      verb={null}
      onCancel={onCancel}
      cancelTestID={`${testID}.cancel`}
      opener={opener}
      ask={ask ?? null}
      over={over ?? null}
      fills
      testID={testID}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {foot != null && (
        <View style={[styles.foot, { paddingBottom: Math.max(12, insets.bottom > 0 ? 12 : 34) }]}>
          {foot}
        </View>
      )}
    </FocusedScreen>
  );
}

function CheckRow({
  label,
  line,
  on,
  onPress,
  testID,
}: {
  label: string;
  line: string | null;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.check, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={line == null ? label : `${label}, ${line}`}
      testID={testID}
    >
      <View style={[styles.box, on && styles.boxOn]}>
        {on && <Glyph name="tick" size={15} ink={tokens.colorInkOnDark} weight={3} />}
      </View>
      <View style={styles.grow}>
        <Text size={16} weight="semibold" accessible={false}>
          {label}
        </Text>
        {line != null && (
          <Text
            size={14}
            weight="medium"
            accessible={false}
            style={[styles.secondary, styles.figures]}
          >
            {line}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function shownNumber(person: PickedPerson): string | null {
  const mobile = person.numbers.find((one) => one.mobile) ?? person.numbers[0];

  return mobile?.number ?? null;
}

/** Android, once the Contacts permission is given: Choose people, only the ticked ones sent on to the review list. */
export function ChoosePeople({
  open,
  opener,
  onClose,
  onReview,
}: {
  open: boolean;
  opener: Opener;
  onClose: () => void;
  onReview: (people: PickedPerson[]) => void;
}) {
  const { t } = useTranslation();
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const [tried, setTried] = useState(false);
  const count = ticked.size;
  useReadOut(open ? t('fromContacts.picked', { count }) : null);

  useEffect(() => {
    if (!open || contactPicker == null) return;
    let live = true;
    contactPicker
      .list()
      .then((all) => {
        if (live) setPeople(all);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open]);

  const review = () => {
    if (count === 0) {
      setTried(true);
      return;
    }
    onReview(people.filter((_, at) => ticked.has(at)));
  };
  const search = typed.trim().toLocaleLowerCase(currentLocale());

  return (
    <PinnedScreen
      open={open}
      title={t('fromContacts.choosePeople')}
      opener={opener}
      onCancel={onClose}
      foot={
        <View style={styles.footParts}>
          {tried && count === 0 && <AlertLine text={t('fromContacts.tickOne')} />}
          <Pill
            label={t('fromContacts.review', { count })}
            onPress={review}
            testID="guests.android.review"
          />
        </View>
      }
      testID="guests.android"
    >
      <SearchField
        typed={typed}
        off={false}
        width={null}
        onTyped={setTyped}
        onSearch={() => undefined}
        onClear={() => setTyped('')}
        label={t('fromContacts.search')}
        testID="guests.android.search"
      />
      <Text size={15} weight="semibold" style={styles.figures}>
        {t('fromContacts.picked', { count })}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
        {t('fromContacts.onlyTicked')}
      </Text>
      <View>
        {people.map((person, at) =>
          person.name.toLocaleLowerCase(currentLocale()).includes(search) ? (
            <CheckRow
              key={`${at}`}
              label={person.name}
              line={shownNumber(person)}
              on={ticked.has(at)}
              onPress={() => {
                const next = new Set(ticked);
                if (next.has(at)) next.delete(at);
                else next.add(at);
                setTicked(next);
              }}
              testID={`guests.android.${at}`}
            />
          ) : null,
        )}
      </View>
    </PinnedScreen>
  );
}

function Stepper({
  count,
  onChange,
  name,
}: {
  count: number;
  onChange: (count: number) => void;
  name: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.stepper}>
      <Text size={15} weight="medium" style={styles.grow}>
        {t('fromContacts.places')}
      </Text>
      <Pressable
        onPress={count > 0 ? () => onChange(stepPlaces(count, -1)) : undefined}
        disabled={count === 0}
        style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ disabled: count === 0 }}
        accessibilityLabel={t('fromContacts.fewer', { name })}
      >
        <View
          style={[
            styles.minus,
            { backgroundColor: count > 0 ? tokens.colorAccentText : tokens.colorInkTertiary },
          ]}
        />
      </Pressable>
      <Text
        size={17}
        weight="bold"
        style={[styles.figures, styles.stepCount]}
        accessibilityLabel={t('fromContacts.placesNow', { count })}
      >
        {String(count)}
      </Text>
      <Pressable
        onPress={() => onChange(stepPlaces(count, 1))}
        style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('fromContacts.more', { name })}
      >
        <Glyph name="plus" size={18} ink={tokens.colorAccentText} weight={2.4} />
      </Pressable>
    </View>
  );
}

function Pills({ fix, listed }: { fix: boolean; listed: boolean }) {
  const { t } = useTranslation();

  return (
    <>
      {fix && (
        <View style={[styles.pill, styles.pillFix]}>
          <Glyph name="alert" size={13} ink={tokens.colorBroken} weight={2.4} />
          <Text size={12.5} weight="semibold" style={styles.broken}>
            {t('fromContacts.toFix')}
          </Text>
        </View>
      )}
      {listed && (
        <View style={[styles.pill, styles.pillListed]}>
          <Glyph name="alert" size={13} ink={tokens.colorAttentionText} weight={2.4} />
          <Text size={12.5} weight="semibold" style={styles.attention}>
            {t('fromContacts.onList')}
          </Text>
        </View>
      )}
    </>
  );
}

type Failure = 'failed' | 'offline' | null;

/** The review list (sc-7579): a card each, its problem on the card; nothing is added until Add, then every row or none. */
export function ContactsReview({
  open,
  people,
  eventId,
  eventName,
  organisationCountry,
  listedNames,
  billing,
  opener,
  onClose,
  onAdded,
  onPickAgain,
}: {
  open: boolean;
  people: readonly PickedPerson[];
  eventId: string;
  eventName: string;
  organisationCountry: string;
  /** Everyone on the list, guests and companions, for the duplicate warning. */
  listedNames: readonly string[];
  /** Holds billing.manage, so past the plan it says the plan cannot be changed here. */
  billing: boolean;
  opener: Opener;
  onClose: () => void;
  onAdded: (count: number) => void;
  onPickAgain: () => void;
}) {
  const { t } = useTranslation();
  const [first] = useState(() => reviewRowsOf(people, organisationCountry));
  const [rows, setRows] = useState<ReviewRow[]>(first.rows);
  const [room, setRoom] = useState<GuestRoom | null>(null);
  const [pressed, setPressed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState<Failure>(null);
  const [refused, setRefused] = useState(false);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const names = useRef(new Map<string, TextInputInstance>());
  const numbers = useRef(new Map<string, TextInputInstance>());
  const scroll = useRef<ScrollViewInstance>(null);
  const count = rows.length;
  const problems = reviewCounts(rows, listedNames);
  const companions = rows.reduce((sum, row) => sum + row.places, 0);
  const plan = room == null ? null : planRoom(room, peopleIn(rows));
  const countryName = (code: string) =>
    countryChoices(currentLocale()).find((one) => one.code === code)?.name ?? code;

  useEffect(() => {
    let live = true;
    api
      .guestRoom(eventId)
      .then((read) => {
        if (live) setRoom(read);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [eventId]);

  const firstProblem = () => {
    const row =
      rows.find((one) => toFix(rowProblems(one, rows, listedNames))) ??
      rows.find((one) => rowProblems(one, rows, listedNames).listed);
    if (row == null) return;
    const own = rowProblems(row, rows, listedNames);
    const field =
      own.number && own.name == null ? numbers.current.get(row.key) : names.current.get(row.key);
    if (field != null) focusChecked({ current: field });
  };

  async function add() {
    if (problems.fix > 0) {
      setPressed(true);
      firstProblem();
      return;
    }
    if (plan?.over === true) {
      setRefused(true);
      return;
    }
    setFailed(null);
    setAdding(true);
    try {
      onAdded(await api.addGuestsFromContacts(eventId, contactsBody(rows)));
    } catch (error) {
      setAdding(false);
      if (error instanceof ApiError && error.is('plan_limit_reached')) {
        setRoom(await api.guestRoom(eventId).catch(() => room));
        setRefused(true);
      } else setFailed(error instanceof ApiUnreachableError ? 'offline' : 'failed');
    }
  }

  const change = (key: string, next: Partial<ReviewRow>) => {
    setRows((was) => was.map((row) => (row.key === key ? { ...row, ...next } : row)));
    setFailed(null);
  };
  const remove = (key: string) => setRows((was) => was.filter((row) => row.key !== key));
  const leaves = useLeaveAsk(
    open && rows.length > 0 && !adding,
    () => setDiscarding(true),
    onClose,
  );
  const discard: AskProps | null = discarding
    ? {
        title: t('fromContacts.discardTitle', { count }),
        line: t('fromContacts.discardLine'),
        keep: { label: t('fromContacts.keepReviewing'), testID: 'guests.review.keep' },
        confirm: {
          label: t('fromContacts.discard'),
          removes: true,
          testID: 'guests.review.discard',
        },
        onKeep: () => {
          setDiscarding(false);
          leaves.keep();
        },
        onConfirm: () => {
          setDiscarding(false);
          leaves.discard();
        },
        width: ASK_WIDTH,
      }
    : null;
  const choosingRow = rows.find((row) => row.key === choosing) ?? null;
  const way = billing ? <AmberLine ink text={t('limitReached.inApp')} /> : null;
  const planName = room == null ? '' : room.plan.charAt(0).toUpperCase() + room.plan.slice(1);
  const figure =
    plan == null
      ? ''
      : t('limitReached.figure.people', {
          count: plan.after,
          allowed: plan.allowed,
          plan: planName,
        });

  const foot =
    rows.length === 0 ? null : (
      <View style={styles.footParts}>
        {pressed && problems.fix > 0 && (
          <AlertLine text={t('fromContacts.fixRows', { count: problems.fix })} />
        )}
        {plan != null && !plan.over && <RoomLeft room={plan.room} />}
        {plan?.over === true && (
          <Amber
            title={t('limitReached.title.people', { count: plan.allowed })}
            testID="guests.review.limit"
          >
            <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
              {figure}
            </Text>
            <AmberLine
              ink
              text={t('fromContacts.makeRoom', {
                event: eventName,
                listed: room?.people ?? 0,
                count: plan.after - plan.allowed,
              })}
            />
            <AmberLine ink text={`· ${t('fromContacts.removeRows')}`} />
            <AmberLine ink text={`· ${t('fromContacts.removeOnWeb')}`} />
            {way}
          </Amber>
        )}
        {adding ? (
          <View
            style={styles.busy}
            accessible
            accessibilityRole="button"
            accessibilityState={{ busy: true, disabled: true }}
            accessibilityLabel={t('fromContacts.adding', { count })}
          >
            <TurningMark side={18} />
            <Text size={16} weight="semibold" accessible={false} style={styles.white}>
              {t('fromContacts.adding', { count })}
            </Text>
          </View>
        ) : (
          <Pill
            label={t('fromContacts.add', { count })}
            onPress={() => void add()}
            testID="guests.review.add"
          />
        )}
      </View>
    );

  return (
    <PinnedScreen
      open={open}
      title={t('fromContacts.title')}
      opener={opener}
      onCancel={() => leaves.leave()}
      ask={discard}
      over={
        choosingRow != null
          ? {
              layer: (
                <SheetLayer onClose={() => setChoosing(null)} label={t('guestList.cancel')}>
                  <SheetBody
                    title={t('fromContacts.chooseNumber')}
                    close={t('guestList.cancel')}
                    onClose={() => setChoosing(null)}
                  >
                    <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
                      {t('fromContacts.onlyChosen')}
                    </Text>
                    <View accessibilityRole="radiogroup">
                      {choosingRow.numbers.map((n, at) => (
                        <Pressable
                          key={`${at}`}
                          onPress={() =>
                            change(choosingRow.key, {
                              numberAt: at,
                              ...numberFields(n.number, organisationCountry),
                            })
                          }
                          style={({ pressed: down }) => [styles.numberRow, down && styles.pressed]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: choosingRow.numberAt === at }}
                          accessibilityLabel={`${n.number}, ${n.label}`}
                          testID={`guests.review.number.${at}`}
                        >
                          <LineIcon name="phone" />
                          <View style={styles.grow}>
                            <Text
                              size={16}
                              weight="semibold"
                              accessible={false}
                              style={styles.figures}
                            >
                              {n.number}
                            </Text>
                            <Text
                              size={14}
                              weight="medium"
                              accessible={false}
                              style={styles.secondary}
                            >
                              {n.label}
                            </Text>
                          </View>
                          <RadioMark on={choosingRow.numberAt === at} />
                        </Pressable>
                      ))}
                    </View>
                    <Pill
                      label={t('fromContacts.useThisNumber')}
                      onPress={() => setChoosing(null)}
                      testID="guests.review.number.use"
                    />
                  </SheetBody>
                </SheetLayer>
              ),
              onClose: () => setChoosing(null),
            }
          : refused && plan != null
            ? {
                layer: (
                  <SheetLayer
                    onClose={() => setRefused(false)}
                    label={t('fromContacts.backToList')}
                    alert
                  >
                    <SheetBody
                      title={t('fromContacts.notAddedTitle')}
                      close={t('fromContacts.backToList')}
                      onClose={() => setRefused(false)}
                    >
                      <Refused
                        line={t('fromContacts.notAddedLine', {
                          count,
                          companions: t('fromContacts.notAddedCompanions', {
                            count: companions,
                          }),
                          event: eventName,
                          listed: t('fromContacts.notAddedListed', {
                            count: room?.people ?? 0,
                          }),
                        })}
                        figure={figure}
                        way={way}
                      />
                      <Pill
                        label={t('fromContacts.backToList')}
                        onPress={() => setRefused(false)}
                        testID="guests.review.backToList"
                      />
                    </SheetBody>
                  </SheetLayer>
                ),
                onClose: () => setRefused(false),
              }
            : null
      }
      foot={foot}
      scrollRef={scroll}
      testID="guests.review"
    >
      {rows.length === 0 ? (
        <View style={styles.removed}>
          <Text size={17} weight="semibold" style={styles.lines}>
            {t('fromContacts.allRemoved')}
          </Text>
          <Pill
            label={t('fromContacts.pickAgain')}
            kind="secondary"
            glyph="users"
            height={48}
            full={false}
            onPress={onPickAgain}
            testID="guests.review.pickAgain"
          />
        </View>
      ) : (
        <>
          {failed === 'failed' && (
            <View style={styles.tight}>
              <AlertLine text={t('guestList.notAdded')} />
              <AmberLine text={t('fromContacts.everyoneKept')} />
            </View>
          )}
          {failed === 'offline' && (
            <View style={styles.tight}>
              <AlertLine text={t('guestList.offlineRefused')} />
              <AmberLine text={t('fromContacts.offlineKept')} />
            </View>
          )}
          <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
            {t('fromContacts.intro', { count })}
          </Text>
          {first.picked > first.rows.length && (
            <Amber title={t('fromContacts.only250')}>
              <AmberLine text={t('fromContacts.firstOf', { picked: first.picked })} />
            </Amber>
          )}
          {(problems.fix > 0 || problems.listed > 0) && (
            <Pressable
              onPress={firstProblem}
              style={({ pressed: down }) => [styles.summary, down && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={summaryOf(t, problems)}
              testID="guests.review.problems"
            >
              <Glyph name="alert" size={16} ink={tokens.colorBroken} weight={2.2} />
              <Text size={14.5} weight="semibold" accessible={false} style={styles.grow}>
                {summaryOf(t, problems)}
              </Text>
              <Glyph name="chevron" size={15} ink={tokens.colorInkTertiary} weight={2.3} />
            </Pressable>
          )}
          {rows.map((row, index) => {
            const own = rowProblems(row, rows, listedNames);
            const fix = toFix(own);
            const saved = savedAs(row);
            return (
              <View
                key={row.key}
                style={[styles.card, fix && styles.cardFix]}
                testID={`guests.review.${index}`}
              >
                <View style={styles.cardTop}>
                  <Text size={13} weight="semibold" style={[styles.secondary, styles.figures]}>
                    {t('fromContacts.ofPicked', { index: index + 1, count })}
                  </Text>
                  <Pills fix={fix} listed={own.listed} />
                  <View style={styles.grow} />
                  <TextAction
                    label={t('guestList.remove')}
                    plain
                    onPress={() => remove(row.key)}
                    accessibilityLabel={t('fromContacts.removeRow', { name: row.name })}
                    testID={`guests.review.${index}.remove`}
                  />
                </View>
                <Field
                  label={t('account.fullName')}
                  error={
                    own.name === 'blank'
                      ? t('fromContacts.nameBlank')
                      : own.name === 'tooLong'
                        ? t('guestList.nameTooLong', { most: GUEST_NAME_MAXIMUM })
                        : undefined
                  }
                >
                  <TextField
                    ref={(node) => {
                      if (node == null) names.current.delete(row.key);
                      else names.current.set(row.key, node);
                    }}
                    accessibilityLabel={t('account.fullName')}
                    value={row.name}
                    onChangeText={(name) => change(row.key, { name })}
                    wrong={own.name != null}
                    submitting={adding}
                    multiline
                    testID={`guests.review.${index}.name`}
                  />
                </Field>
                <PhoneEntry
                  label={t('guestList.mobileNumber')}
                  pill={t('eventForm.optional')}
                  help={
                    saved != null && !own.number ? t('fromContacts.savedAs', { number: saved }) : ''
                  }
                  country={row.country}
                  number={row.number}
                  error={
                    own.number
                      ? t('fromContacts.unreadable', { country: countryName(row.country) })
                      : null
                  }
                  submitting={adding}
                  ref={(node: TextInputInstance | null) => {
                    if (node == null) numbers.current.delete(row.key);
                    else numbers.current.set(row.key, node);
                  }}
                  onCountry={(country) => change(row.key, { country })}
                  onNumber={(number) => change(row.key, { number })}
                  onSubmit={() => undefined}
                  testID={`guests.review.${index}.phone`}
                />
                {row.numbers.length > 1 && (
                  <View>
                    <Text size={13.5} weight="medium" style={[styles.secondary, styles.figures]}>
                      {t('fromContacts.numberOf', {
                        label: row.numbers[row.numberAt]?.label ?? '',
                        index: row.numberAt + 1,
                        count: row.numbers.length,
                      })}
                    </Text>
                    <TextAction
                      label={t('fromContacts.chooseAnother')}
                      onPress={() => setChoosing(row.key)}
                      testID={`guests.review.${index}.choose`}
                    />
                  </View>
                )}
                {own.number && (
                  <TextAction
                    label={t('fromContacts.clearNumber')}
                    onPress={() => change(row.key, { number: '' })}
                    testID={`guests.review.${index}.clear`}
                  />
                )}
                {own.listed && (
                  <Text size={13.5} weight="medium" style={[styles.attention, styles.small]}>
                    {t('fromContacts.stillAdded', { name: row.name.trim() })}
                  </Text>
                )}
                <Stepper
                  count={row.places}
                  onChange={(places) => change(row.key, { places })}
                  name={row.name}
                />
              </View>
            );
          })}
        </>
      )}
    </PinnedScreen>
  );
}

function summaryOf(
  t: ReturnType<typeof useTranslation>['t'],
  problems: { fix: number; listed: number },
): string {
  return [
    problems.fix > 0 ? t('fromContacts.toFixCount', { count: problems.fix }) : null,
    problems.listed > 0 ? t('fromContacts.listedCount', { count: problems.listed }) : null,
  ]
    .filter((one) => one != null)
    .join(' · ');
}

function RoomLeft({ room }: { room: number }) {
  const { t } = useTranslation();
  const words = t('fromContacts.roomFor', { count: room });
  useReadOut(words);

  return (
    <Text size={15} weight="semibold" style={styles.figures} testID="guests.review.room">
      {words}
    </Text>
  );
}

function Refused({ line, figure, way }: { line: string; figure: string; way: ReactNode }) {
  const { t } = useTranslation();
  useReadOut(line);

  return (
    <View style={styles.tight} accessibilityRole="alert">
      <Text size={16} weight="semibold" style={styles.lines}>
        {line}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
        {figure}
      </Text>
      <DoneLine text={t('fromContacts.listKept')} size={14.5} />
      <AmberLine ink text={`· ${t('fromContacts.removeRows')}`} />
      <AmberLine ink text={`· ${t('fromContacts.removeOnWeb')}`} />
      {way}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, flexShrink: 1 },
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  white: { color: tokens.colorInkOnDark },
  broken: { color: tokens.colorBroken },
  attention: { color: tokens.colorAttentionText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  small: { lineHeight: 13.5 * 1.4 },
  tight: { gap: 6 },
  body: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space5xl,
  },
  foot: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: tokens.spaceXxl,
    borderTopWidth: 1,
    borderTopColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  footParts: { gap: 8 },
  contacts: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
  },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleLine: { flex: 1, height: 1, backgroundColor: tokens.colorBorder },
  check: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: tokens.colorAccent, borderColor: tokens.colorAccent },
  stepper: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: {
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minus: { width: 14, height: 2.4, borderRadius: 1.2 },
  stepCount: { minWidth: 24, textAlign: 'center' },
  pill: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
  },
  pillFix: { backgroundColor: tokens.colorBrokenTint },
  pillListed: { backgroundColor: tokens.colorAttentionTint },
  card: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  cardFix: { borderWidth: 1.5, borderColor: tokens.colorBroken },
  cardTop: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  summary: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tokens.colorInset,
  },
  busy: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 26,
    backgroundColor: tokens.colorAccent,
    opacity: 0.8,
  },
  removed: { paddingTop: 140, gap: 14, alignItems: 'flex-start' },
  numberRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
