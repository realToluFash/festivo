import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { focusChecked } from '../../components/Field.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { ASK_WIDTH, AlertLine } from '../events/EventEdits.tsx';
import { SearchField } from '../events/EventsList.tsx';
import { LineIcon } from '../settings/AccountCard.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import {
  type AskProps,
  FocusedScreen,
  Row,
  TextAction,
  TurningMark,
} from '../../components/Summary.tsx';
import {
  type AddState,
  type ReviewRow,
  type ReviewState,
  addedGuest,
  countryName,
  emailCheck,
  greetAsProblem,
  nameProblem,
  phoneCheck,
  planRoom,
  reviewProblems,
  sameNameAs,
} from './GuestsModel.ts';
import { Amber, AmberLine, Choices, DoneLine } from './GuestsParts.tsx';
import { GreetAsField } from './GuestGreetAs.tsx';
import { LanguageField } from './GuestLanguage.tsx';
import {
  CONTACTS,
  type GuestLanguage,
  PICKED,
  PICKED_COUNT,
  PLAN_SAMPLES,
  type SampleGuest,
} from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';
import {
  CheckRow,
  GuestField,
  Legend,
  PhoneField,
  SheetBody,
  SheetLayer,
  joinPhone,
  languageOver,
} from './GuestEdit.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;

const ADDING_MS = 1200;

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
      <View style={[styles.foot, { paddingBottom: Math.max(12, insets.bottom > 0 ? 12 : 34) }]}>
        {foot}
      </View>
    </FocusedScreen>
  );
}

function FromContactsButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.contacts, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={W.fromContacts}
      testID="guests.add.fromContacts"
    >
      <Glyph name="users" size={19} ink={tokens.colorAccentText} weight={2.1} />
      <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
        {W.fromContacts}
      </Text>
    </Pressable>
  );
}

function OrType() {
  return (
    <View
      style={styles.rule}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.ruleLine} />
      <Text size={13} weight="semibold" accessible={false} style={styles.secondary}>
        {W.orType}
      </Text>
      <View style={styles.ruleLine} />
    </View>
  );
}

const BIMPE = { name: 'Bimpe Adeyemi', email: 'bimpe.adeyemi@gmail.com', number: '7700 900877' };
const LUCAS = { name: 'Lucas Moreau', email: 'lucas.moreau@orange.fr', language: 'fr' } as const;

/** Add guest (sc-1468): From contacts first, then the four fields, Add guest pinned at the foot. */
export function AddGuest({
  open,
  start,
  guests,
  opener,
  onClose,
  onAdded,
  onFromContacts,
  picking,
  onPicked,
  onPickClose,
}: {
  open: boolean;
  start: AddState | null;
  guests: readonly SampleGuest[];
  opener: Opener;
  onClose: () => void;
  onAdded: (guest: SampleGuest) => void;
  onFromContacts: () => void;
  /** iOS's own picker, over this screen. */
  picking: boolean;
  onPicked: () => void;
  onPickClose: () => void;
}) {
  const kept = start === 'addNotAdded' || start === 'addOffline';
  const lucas = start === 'languageAdd';
  const [name, setName] = useState(
    start === 'addDuplicate' ? 'Marta Silva' : kept ? BIMPE.name : lucas ? LUCAS.name : '',
  );
  const [email, setEmail] = useState(
    start === 'addDuplicate' ? 'm.silva@gmail.com' : kept ? BIMPE.email : lucas ? LUCAS.email : '',
  );
  const [greetAs, setGreetAs] = useState('');
  const [language, setLanguage] = useState<GuestLanguage | null>(lucas ? LUCAS.language : null);
  const [choosing, setChoosing] = useState(false);
  const [country, setCountry] = useState('GB');
  const [number, setNumber] = useState(
    start === 'addRefused' ? '7700 90' : kept ? BIMPE.number : '',
  );
  const [companions, setCompanions] = useState<string[]>([]);
  const [checked, setChecked] = useState(start === 'addRefused');
  const [same, setSame] = useState(start === 'addDuplicate');
  const [failed, setFailed] = useState<'notAdded' | 'offline' | null>(
    start === 'addNotAdded' ? 'notAdded' : start === 'addOffline' ? 'offline' : null,
  );
  const [added, setAdded] = useState<string | null>(start === 'added' ? BIMPE.name : null);
  const refused = start === 'androidRefused';
  const nameRef = useRef<TextInputInstance>(null);
  const greetAsRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const numberRef = useRef<TextInputInstance>(null);
  const errors = {
    name: checked ? nameProblem(name) : null,
    greetAs: checked ? greetAsProblem(greetAs) : null,
    email: checked ? emailCheck(email) : null,
    phone: checked ? phoneCheck(number, country) : null,
  };
  const add = (anyway = false) => {
    setChecked(true);
    if (nameProblem(name) != null) return focusChecked(nameRef);
    if (greetAsProblem(greetAs) != null) return focusChecked(greetAsRef);
    if (emailCheck(email) != null) return focusChecked(emailRef);
    if (phoneCheck(number, country) != null) return focusChecked(numberRef);
    if (!anyway && sameNameAs(guests, name, null) != null) {
      setSame(true);
      return;
    }
    setFailed(null);
    setSame(false);
    onAdded(
      addedGuest(`added-${Date.now()}`, {
        name,
        email,
        phone: joinPhone(country, number),
        language,
        companions,
        greetAs,
      }),
    );
    setAdded(name.trim());
    setName('');
    setGreetAs('');
    setEmail('');
    setNumber('');
    setLanguage(null);
    setCompanions([]);
    setChecked(false);
    focusChecked(nameRef);
  };

  return (
    <PinnedScreen
      open={open}
      title={W.addGuest}
      opener={opener}
      onCancel={onClose}
      over={
        picking
          ? { layer: <IosPicker onClose={onPickClose} onDone={onPicked} />, onClose: onPickClose }
          : choosing
            ? languageOver(
                language,
                (code) => {
                  setLanguage(code);
                  setChoosing(false);
                },
                () => setChoosing(false),
              )
            : null
      }
      foot={<Pill label={W.addGuest} onPress={() => add()} testID="guests.add.do" />}
      testID="guests.add"
    >
      {added != null && <DoneLine text={say.added(added)} />}
      {failed === 'notAdded' && <AlertLine text={W.notAdded} />}
      {failed === 'offline' && (
        <View style={styles.tight}>
          <AlertLine text={W.offline} />
          <AmberLine text={W.offlineLine} />
        </View>
      )}
      <View style={styles.tight}>
        <FromContactsButton onPress={onFromContacts} />
        <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
          {W.fromContactsLine}
        </Text>
      </View>
      {refused && (
        <Amber title={null} testID="guests.add.refusedContacts">
          <AmberLine text={W.refusedContacts} ink />
        </Amber>
      )}
      <OrType />
      <GuestField
        label={W.fullName}
        value={name}
        onChange={setName}
        error={errors.name}
        autoFocus={start === 'add' || start === 'added' || start === 'addRefused'}
        fieldRef={nameRef}
        testID="guests.add.name"
      />
      <GreetAsField
        value={greetAs}
        onChange={setGreetAs}
        error={errors.greetAs}
        fieldRef={greetAsRef}
        testID="guests.add.greetAs"
      />
      <GuestField
        label={W.emailAddress}
        value={email}
        onChange={setEmail}
        error={errors.email}
        optional
        keyboard="email-address"
        fieldRef={emailRef}
        testID="guests.add.email"
      />
      <PhoneField
        country={country}
        number={number}
        onCountry={setCountry}
        onNumber={setNumber}
        error={errors.phone}
        fieldRef={numberRef}
        testID="guests.add.phone"
      />
      <LanguageField
        value={language}
        chose={null}
        onOpen={() => setChoosing(true)}
        testID="guests.add.language"
      />
      <View style={styles.tight}>
        <Legend text={W.companions} />
        {companions.map((c, index) => (
          <View key={`${index}`} style={styles.companion}>
            <View style={styles.grow}>
              <GuestField
                label={W.companionName}
                value={c}
                onChange={(text) =>
                  setCompanions(companions.map((one, i) => (i === index ? text : one)))
                }
                error={null}
                testID={`guests.add.companion.${index}`}
              />
            </View>
          </View>
        ))}
        {companions.length < 10 && (
          <TextAction
            label={W.addCompanion}
            glyph="plus"
            onPress={() => setCompanions([...companions, ''])}
            testID="guests.add.addCompanion"
          />
        )}
      </View>
      {same && (
        <Amber title={say.sameName(name.trim())} testID="guests.add.same">
          <Choices
            primary
            first={{ label: W.addAnyway, onPress: () => add(true), testID: 'guests.add.anyway' }}
            second={{
              label: W.cancel,
              onPress: () => setSame(false),
              testID: 'guests.add.sameCancel',
            }}
          />
        </Amber>
      )}
    </PinnedScreen>
  );
}

/** iOS draws its own picker, many at once and with no permission: the demo stands in for it. */
function IosPicker({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  return (
    <SheetLayer onClose={onClose} label={W.cancel}>
      <SheetBody title="Contacts" close={W.cancel} onClose={onClose}>
        {CONTACTS.map((c) => (
          <Row key={c.name} title={c.name} line={c.number} lead={<LineIcon name="user" />} />
        ))}
        <DemoOnly title="Drawn by iOS (the system contact picker, many at once). No Contacts permission; Soirely sees only the people picked.">
          <Pill
            label={`Done (${PICKED_COUNT})`}
            kind="secondary"
            height={tokens.sizeHit}
            onPress={onDone}
            testID="guests.picker.done"
          />
        </DemoOnly>
      </SheetBody>
    </SheetLayer>
  );
}

/** Android, after the Contacts permission: Choose people, each ticked one sent, Review pinned at the foot. */
export function ChoosePeople({
  open,
  opener,
  onClose,
  onReview,
}: {
  open: boolean;
  opener: Opener;
  onClose: () => void;
  onReview: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [ticked, setTicked] = useState<boolean[]>(() => CONTACTS.map((c) => c.ticked));
  const count =
    PICKED_COUNT - CONTACTS.filter((c) => c.ticked).length + ticked.filter(Boolean).length;
  useReadOut(say.picked(count));

  return (
    <PinnedScreen
      open={open}
      title={W.choosePeople}
      opener={opener}
      onCancel={onClose}
      foot={<Pill label={say.review(count)} onPress={onReview} testID="guests.android.review" />}
      testID="guests.android"
    >
      <SearchField
        typed={typed}
        off={false}
        width={null}
        onTyped={setTyped}
        onSearch={() => undefined}
        onClear={() => setTyped('')}
        label={W.searchContacts}
        testID="guests.android.search"
      />
      <Text size={15} weight="semibold" style={styles.figures}>
        {say.picked(count)}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
        {W.onlyTicked}
      </Text>
      <View>
        {CONTACTS.map((c, index) =>
          c.name.toLowerCase().includes(typed.trim().toLowerCase()) ? (
            <CheckRow
              key={c.name}
              label={c.name}
              line={c.number}
              on={ticked[index] === true}
              onPress={() => setTicked(ticked.map((one, i) => (i === index ? !one : one)))}
              testID={`guests.android.${index}`}
            />
          ) : null,
        )}
      </View>
    </PinnedScreen>
  );
}

function startRows(): ReviewRow[] {
  return PICKED.map((p) => ({
    key: p.key,
    name: p.name,
    country: p.country,
    number: p.number,
    saved: p.e164,
    unreadable: p.unreadable,
    listed: p.listed,
    numberAt: 0,
    places: 0,
  }));
}

function pickedCount(start: ReviewState | null): number {
  if (start === 'roomLeft') return PLAN_SAMPLES.roomLeft.picked;
  if (start === 'overLimit' || start === 'limitRefused') return PLAN_SAMPLES.overLimit.picked;
  if (start === 'over250') return 250;
  return PICKED_COUNT;
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
  return (
    <View style={styles.stepper}>
      <Text size={15} weight="medium" style={styles.grow}>
        {W.places}
      </Text>
      <Pressable
        onPress={count > 0 ? () => onChange(count - 1) : undefined}
        disabled={count === 0}
        style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ disabled: count === 0 }}
        accessibilityLabel={`${W.fewer}, ${name}`}
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
        accessibilityLabel={`${W.places}, ${count}`}
      >
        {String(count)}
      </Text>
      <Pressable
        onPress={() => onChange(count + 1)}
        style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${W.more}, ${name}`}
      >
        <Glyph name="plus" size={18} ink={tokens.colorAccentText} weight={2.4} />
      </Pressable>
    </View>
  );
}

function Pills({ fix, listed }: { fix: boolean; listed: boolean }) {
  return (
    <>
      {fix && (
        <View style={[styles.pill, styles.pillFix]}>
          <Glyph name="alert" size={13} ink={tokens.colorBroken} weight={2.4} />
          <Text size={12.5} weight="semibold" style={styles.broken}>
            {W.toFix}
          </Text>
        </View>
      )}
      {listed && (
        <View style={[styles.pill, styles.pillListed]}>
          <Glyph name="alert" size={13} ink={tokens.colorAttentionText} weight={2.4} />
          <Text size={12.5} weight="semibold" style={styles.attention}>
            {W.onList}
          </Text>
        </View>
      )}
    </>
  );
}

/** The review list (sc-7579): a card each, its problem on the card; nothing is added until Add, then every row or none. */
export function ReviewList({
  open,
  start,
  opener,
  onClose,
  onAdded,
  onPickAgain,
}: {
  open: boolean;
  start: ReviewState | null;
  opener: Opener;
  onClose: () => void;
  onAdded: (count: number) => void;
  onPickAgain: () => void;
}) {
  const [rows, setRows] = useState<ReviewRow[]>(() => (start === 'allRemoved' ? [] : startRows()));
  const [count, setCount] = useState(() => (start === 'allRemoved' ? 0 : pickedCount(start)));
  const [pressed, setPressed] = useState(start === 'reviewPressed');
  const [adding, setAdding] = useState(start === 'adding');
  const [failed, setFailed] = useState<'failed' | 'offline' | null>(
    start === 'contactsFailed' ? 'failed' : start === 'contactsOffline' ? 'offline' : null,
  );
  const [refused, setRefused] = useState(start === 'limitRefused');
  const [choosing, setChoosing] = useState<string | null>(start === 'chooseNumber' ? 'kofi' : null);
  const [discarding, setDiscarding] = useState(start === 'contactsDiscard');
  const fields = useRef<Partial<Record<string, TextInputInstance | null>>>({});
  const cards = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const scroll = useRef<ScrollViewInstance>(null);
  const problems = reviewProblems(rows);
  const sample =
    start === 'roomLeft'
      ? PLAN_SAMPLES.roomLeft
      : start === 'overLimit' || start === 'limitRefused'
        ? PLAN_SAMPLES.overLimit
        : null;
  const places = rows.reduce((sum, row) => sum + row.places, 0) + (sample?.places ?? 0);
  const plan = sample == null ? null : planRoom(sample.listed, count + places);

  useEffect(() => {
    if (!adding) return;
    const wait = setTimeout(() => onAdded(count), ADDING_MS);
    return () => clearTimeout(wait);
  }, [adding, count, onAdded]);

  const firstProblem = () => {
    const row =
      rows.find((one) => one.unreadable && one.number.trim() !== '') ??
      rows.find((one) => one.listed);
    if (row == null) return;
    const card = cards.current[row.key];
    card?.measureLayout(scroll.current as never, (_x, y) =>
      scroll.current?.scrollTo({ y: Math.max(0, y - 12) }),
    );
    const field = fields.current[row.key];
    if (field != null) focusChecked({ current: field });
  };
  const add = () => {
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
  };
  const change = (key: string, next: Partial<ReviewRow>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...next } : row)));
  const remove = (key: string) => {
    setRows(rows.filter((row) => row.key !== key));
    setCount(Math.max(0, count - 1));
  };
  const discard: AskProps | null = discarding
    ? {
        title: say.discardPicked(count),
        line: W.discardPickedLine,
        keep: { label: W.keepReviewing, testID: 'guests.review.keep' },
        confirm: { label: W.discard, removes: true, testID: 'guests.review.discard' },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
        width: ASK_WIDTH,
      }
    : null;
  const choosingRow = PICKED.find((p) => p.key === choosing);
  const chosenAt = rows.find((row) => row.key === choosing)?.numberAt ?? 0;

  const foot =
    rows.length === 0 ? null : (
      <View style={styles.footParts}>
        {pressed && problems.fix > 0 && <AlertLine text={say.fixRows(problems.fix)} />}
        {plan != null && !plan.over && <RoomLeft room={plan.room} />}
        {plan?.over === true && (
          <Amber title={W.planAllows} testID="guests.review.limit">
            <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
              {say.peopleOf(plan.after)}
            </Text>
            <AmberLine ink text={say.makeRoom(sample?.listed ?? 0, plan.after - 100)} />
            <AmberLine ink text={`· ${W.removeRows}`} />
            <AmberLine ink text={`· ${W.removeOnWeb}`} />
            <AmberLine text={W.plansOnWeb} />
          </Amber>
        )}
        {adding ? (
          <View
            style={styles.busy}
            accessible
            accessibilityRole="button"
            accessibilityState={{ busy: true, disabled: true }}
            accessibilityLabel={say.adding(count)}
          >
            <TurningMark side={18} />
            <Text size={16} weight="semibold" accessible={false} style={styles.white}>
              {say.adding(count)}
            </Text>
          </View>
        ) : (
          <Pill label={say.addMany(count)} onPress={add} testID="guests.review.add" />
        )}
      </View>
    );

  return (
    <PinnedScreen
      open={open}
      title={W.fromContacts}
      opener={opener}
      onCancel={() => (rows.length > 0 ? setDiscarding(true) : onClose())}
      ask={discard}
      over={
        choosing != null
          ? {
              layer: (
                <SheetLayer onClose={() => setChoosing(null)} label={W.cancel}>
                  <SheetBody
                    title={W.chooseNumber}
                    close={W.cancel}
                    onClose={() => setChoosing(null)}
                  >
                    <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
                      {W.onlyChosen}
                    </Text>
                    <View accessibilityRole="radiogroup">
                      {(choosingRow?.numbers ?? []).map((n, index) => (
                        <Pressable
                          key={n.number}
                          onPress={() => {
                            const [, ...rest] = n.number.split(' ');
                            change(choosingRow?.key ?? '', {
                              numberAt: index,
                              number: rest.join(' '),
                              saved: n.number,
                            });
                          }}
                          style={({ pressed: down }) => [styles.numberRow, down && styles.pressed]}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: chosenAt === index }}
                          accessibilityLabel={`${n.number}, ${n.label}`}
                          testID={`guests.review.number.${index}`}
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
                          <RadioMark on={chosenAt === index} />
                        </Pressable>
                      ))}
                    </View>
                    <Pill
                      label={W.useThisNumber}
                      onPress={() => setChoosing(null)}
                      testID="guests.review.number.use"
                    />
                  </SheetBody>
                </SheetLayer>
              ),
              onClose: () => setChoosing(null),
            }
          : refused
            ? {
                layer: (
                  <SheetLayer onClose={() => setRefused(false)} label={W.backToList} alert>
                    <SheetBody
                      title={W.notAddedTitle}
                      close={W.backToList}
                      onClose={() => setRefused(false)}
                    >
                      <Refused
                        after={plan?.after ?? 0}
                        people={count}
                        companions={places}
                        listed={sample?.listed ?? 0}
                      />
                      <Pill
                        label={W.backToList}
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
            {W.allRemoved}
          </Text>
          <Pill
            label={W.pickFromContacts}
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
              <AlertLine text={W.notAdded} />
              <AmberLine text={W.everyoneKept} />
            </View>
          )}
          {failed === 'offline' && (
            <View style={styles.tight}>
              <AlertLine text={W.offline} />
              <AmberLine text={W.offlineKept} />
            </View>
          )}
          <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
            {say.fromYourContacts(count)}
          </Text>
          {start === 'over250' && (
            <Amber title={W.only250}>
              <AmberLine text={say.firstOf(312)} />
            </Amber>
          )}
          {(problems.fix > 0 || problems.listed > 0) && (
            <Pressable
              onPress={firstProblem}
              style={({ pressed: down }) => [styles.summary, down && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={say.problems(problems.fix, problems.listed)}
              testID="guests.review.problems"
            >
              <Glyph name="alert" size={16} ink={tokens.colorBroken} weight={2.2} />
              <Text size={14.5} weight="semibold" accessible={false} style={styles.grow}>
                {say.problems(problems.fix, problems.listed)}
              </Text>
              <Glyph name="chevron" size={15} ink={tokens.colorInkTertiary} weight={2.3} />
            </Pressable>
          )}
          {rows.map((row, index) => {
            const p = PICKED.find((one) => one.key === row.key);
            const fix = row.unreadable && row.number.trim() !== '';
            const numbers = p?.numbers ?? [];
            return (
              <View
                key={row.key}
                ref={(node) => {
                  cards.current[row.key] = node;
                }}
                style={[styles.card, fix && styles.cardFix]}
                testID={`guests.review.${row.key}`}
              >
                <View style={styles.cardTop}>
                  <Text size={13} weight="semibold" style={[styles.secondary, styles.figures]}>
                    {say.ofPicked(index + 1, count)}
                  </Text>
                  <Pills fix={fix} listed={row.listed} />
                  <View style={styles.grow} />
                  <TextAction
                    label={W.remove}
                    plain
                    onPress={() => remove(row.key)}
                    accessibilityLabel={`${W.remove} ${row.name}`}
                    testID={`guests.review.${row.key}.remove`}
                  />
                </View>
                <GuestField
                  label={W.fullName}
                  value={row.name}
                  onChange={(name) => change(row.key, { name })}
                  error={null}
                  testID={`guests.review.${row.key}.name`}
                />
                <PhoneField
                  country={row.country}
                  number={row.number}
                  onCountry={(country) => change(row.key, { country })}
                  onNumber={(number) =>
                    change(row.key, {
                      number,
                      unreadable: row.unreadable && phoneCheck(number, row.country) != null,
                    })
                  }
                  error={fix ? say.unreadable(countryName(row.country)) : null}
                  {...(row.saved != null && !fix ? { help: say.savedAs(row.saved) } : {})}
                  fieldRef={{
                    get current() {
                      return fields.current[row.key] ?? null;
                    },
                    set current(node) {
                      fields.current[row.key] = node;
                    },
                  }}
                  testID={`guests.review.${row.key}.phone`}
                />
                {numbers.length > 1 && (
                  <View>
                    <Text size={13.5} weight="medium" style={[styles.secondary, styles.figures]}>
                      {say.numberOf(
                        numbers[row.numberAt]?.label ?? '',
                        row.numberAt + 1,
                        numbers.length,
                      )}
                    </Text>
                    <TextAction
                      label={W.chooseAnother}
                      onPress={() => setChoosing(row.key)}
                      testID={`guests.review.${row.key}.choose`}
                    />
                  </View>
                )}
                {fix && (
                  <TextAction
                    label={W.clearNumber}
                    onPress={() => change(row.key, { number: '', saved: null })}
                    testID={`guests.review.${row.key}.clear`}
                  />
                )}
                {row.listed && (
                  <Text size={13.5} weight="medium" style={[styles.attention, styles.small]}>
                    {say.stillAdded(row.name)}
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

function RoomLeft({ room }: { room: number }) {
  useReadOut(say.roomFor(room));

  return (
    <Text size={15} weight="semibold" style={styles.figures} testID="guests.review.room">
      {say.roomFor(room)}
    </Text>
  );
}

function Refused({
  after,
  people,
  companions,
  listed,
}: {
  after: number;
  people: number;
  companions: number;
  listed: number;
}) {
  useReadOut(say.notAddedLine(people, companions, listed));

  return (
    <View style={styles.tight} accessibilityRole="alert">
      <Text size={16} weight="semibold" style={styles.lines}>
        {say.notAddedLine(people, companions, listed)}
      </Text>
      <Text size={14} weight="medium" style={[styles.secondary, styles.figures]}>
        {say.peopleOf(after)}
      </Text>
      <DoneLine text={W.listKept} size={14.5} />
      <AmberLine ink text={`· ${W.removeRows}`} />
      <AmberLine ink text={`· ${W.removeOnWeb}`} />
      <AmberLine text={W.plansOnWeb} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
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
  companion: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
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
