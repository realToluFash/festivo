import { type ReactNode, type Ref, type RefObject, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';

import { CountryPicker } from '../../components/CountryPicker.tsx';
import { Field, focusChecked } from '../../components/Field.tsx';
import { Legend, SheetBody, SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { RadioMark } from '../../components/RadioMark.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useAccessibilitySizes } from '../../layout/useLayout.ts';
import { PhoneCountryRow } from '../../components/PhoneCountryRow.tsx';
import { ASK_WIDTH, AlertLine } from '../events/EventEdits.tsx';
import { BoxField } from '../../components/MomentPick.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { type AskProps, FocusedScreen, TextAction } from '../../components/Summary.tsx';
import {
  type Answer,
  type EditState,
  type RecordState,
  companionsAfterEdit,
  emailCheck,
  nameProblem,
  phoneCheck,
  dayWords,
  greetAsProblem,
  greetAsSaved,
  recorded,
  startTicks,
  sameNameAs,
} from './GuestsModel.ts';
import { GreetAsField } from './GuestGreetAs.tsx';
import { Quote } from './PasteReply.tsx';
import { PW } from './PasteReplyModel.ts';
import { LanguageChoices, LanguageField } from './GuestLanguage.tsx';
import { Amber, AmberChoices, AmberLine } from '../../components/Amber.tsx';
import { DoneLine } from './GuestsParts.tsx';
import {
  type Companion,
  type GuestLanguage,
  type SampleGuest,
  THEIRS,
  TODAY,
} from './GuestsSample.ts';
import { HOW_INVITED, HOW_TOLD, REPLY_WORD, W, say } from './GuestsWords.ts';
import { ReplyMark } from '../../components/ReplyMark.tsx';
import { readOut } from '../../components/ReadOut.tsx';
import { NO_NEEDS, NW, type Needs, firstFailing, needsLines, savedNeeds } from './GuestNeeds.ts';
import {
  NeedsSection,
  useCompanionNeedsRefs,
  useGroupChoice,
  useNeedsRefs,
} from './GuestNeedsParts.tsx';
import { groupNeedsStart } from './GuestNeedsStart.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

/** "+44 7700 900412" as the account's field takes it: the country and the number after its code. */
export function splitPhone(phone: string | null): { country: string; number: string } {
  if (phone == null) return { country: 'GB', number: '' };
  const codes: Record<string, string> = {
    '+44': 'GB',
    '+234': 'NG',
    '+34': 'ES',
    '+233': 'GH',
    '+33': 'FR',
  };
  const code = Object.keys(codes).find((one) => phone.startsWith(`${one} `));
  return code == null
    ? { country: 'GB', number: phone }
    : { country: codes[code] ?? 'GB', number: phone.slice(code.length + 1) };
}

const CALLING: Record<string, string> = { GB: '+44', NG: '+234', ES: '+34', GH: '+233', FR: '+33' };

export function joinPhone(country: string, number: string): string | null {
  return number.trim() === '' ? null : `${CALLING[country] ?? ''} ${number.trim()}`.trim();
}

/** A typed field as Events A's: the label and Optional, the 52 box, then its error or its help. */
export function GuestField({
  label,
  value,
  onChange,
  error,
  help,
  optional = false,
  autoFocus = false,
  keyboard = 'default',
  fieldRef,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  help?: string;
  optional?: boolean;
  autoFocus?: boolean;
  keyboard?: 'default' | 'email-address';
  fieldRef?: RefObject<TextInputInstance | null>;
  testID: string;
}) {
  return (
    <Field label={label} pill={optional ? W.optional : undefined} error={error} help={help}>
      <BoxField
        ref={fieldRef}
        value={value}
        wrong={error != null}
        autoFocus={autoFocus}
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
        onChangeText={onChange}
        accessibilityLabel={label}
        testID={testID}
      />
    </Field>
  );
}

/** The mobile number as the account's field: the country button, then the number, beside it while the country's name fits there on one line and over it otherwise (sc-7579, #104845). */
export function PhoneField({
  country,
  number,
  onCountry,
  onNumber,
  error,
  help,
  autoFocus = false,
  fieldRef,
  testID,
}: {
  country: string;
  number: string;
  onCountry: (code: string) => void;
  onNumber: (typed: string) => void;
  error: string | null;
  help?: string;
  autoFocus?: boolean;
  fieldRef?: RefObject<TextInputInstance | null>;
  testID: string;
}) {
  const atAccessibilitySizes = useAccessibilitySizes();

  return (
    <Field label={W.mobileNumber} pill={W.optional} error={error} help={help}>
      <PhoneCountryRow
        country={country}
        atAccessibilitySizes={atAccessibilitySizes}
        picker={
          <CountryPicker
            label={`${W.mobileNumber}, country`}
            value={country}
            onChange={onCountry}
            withCallingCode
            testID={`${testID}.country`}
          />
        }
        field={
          <BoxField
            ref={fieldRef}
            value={number}
            wrong={error != null}
            autoFocus={autoFocus}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            onChangeText={onNumber}
            accessibilityLabel={W.mobileNumber}
            testID={`${testID}.number`}
          />
        }
      />
    </Field>
  );
}

const MAX = 10;
const LONG_GREET_AS = 'Auntie Bisi, who taught every one of us to dance at weddings!';
const GREET_AS_STARTS: readonly (EditState | null)[] = [
  'greetAsEmpty',
  'greetAsEdit',
  'greetAsLong',
];

/** Language's sheet over the focused screen (sc-3790): a tap picks and closes it, as a select does. */
export function languageOver(
  value: GuestLanguage | null,
  onPick: (code: GuestLanguage | null) => void,
  onClose: () => void,
): { layer: ReactNode; onClose: () => void } {
  return {
    layer: (
      <SheetLayer onClose={onClose} label={W.cancel}>
        <SheetBody title={W.language} close={W.cancel} onClose={onClose}>
          <LanguageChoices value={value} onPick={onPick} />
        </SheetBody>
      </SheetLayer>
    ),
    onClose,
  };
}

function startCompanions(state: EditState | null, g: SampleGuest): string[] {
  if (state === 'editCompanions') return ['Hauwa Bello'];
  if (state === 'editMax')
    return [
      'Hauwa Bello',
      ...Array.from({ length: MAX - 1 }, (_, i) => `Guest of ${g.name} · ${i + 2}`),
    ];
  return g.companions.map((c) => c.name);
}

/** Each field's companion as the guest has them, so a seat or a meal is known; a field added or prefilled here has none. */
function startSeats(state: EditState | null, g: SampleGuest): (Companion | null)[] {
  if (state === 'editCompanions' || state === 'editMax')
    return startCompanions(state, g).map(() => null);
  if (state === 'editCompanionArrived')
    return g.companions.map((c, at) => (at === 0 ? { ...c, arrived: '18:05' } : c));
  return [...g.companions];
}

/** Edit guest (sc-3773): sc-1468's fields filled in; every refusal under its field before anything is sent. */
export function EditGuest({
  open,
  guest: g,
  guests,
  start,
  opener,
  onClose,
  onSaved,
}: {
  open: boolean;
  guest: SampleGuest;
  guests: readonly SampleGuest[];
  start: EditState | null;
  opener: Opener;
  onClose: () => void;
  onSaved: (next: SampleGuest) => void;
}) {
  const phone = splitPhone(g.phone);
  const [name, setName] = useState(
    start === 'editErrors' ? '' : start === 'editDuplicate' ? 'Marta Silva' : g.name,
  );
  const [email, setEmail] = useState(
    start === 'editErrors'
      ? 'kwame.mensah@outlook'
      : start === 'editDiscard' || start === 'editNotSaved' || start === 'editOffline'
        ? 'kwame@mensah.co.uk'
        : (g.email ?? ''),
  );
  const [country, setCountry] = useState(phone.country);
  const [number, setNumber] = useState(start === 'edit' ? '7700 9004' : phone.number);
  const [companions, setCompanions] = useState(() => startCompanions(start, g));
  const [seats, setSeats] = useState(() => startSeats(start, g));
  const [removing, setRemoving] = useState<number | null>(start === 'editSeated' ? 0 : null);
  const [shownAll, setShownAll] = useState(false);
  const [removed, setRemoved] = useState<string | null>(
    start === 'editCompanions' ? `${g.companions[0]?.name ?? ''} · 2` : null,
  );
  const [greetAs, setGreetAs] = useState(
    start === 'greetAsLong' ? LONG_GREET_AS : (g.greetAs ?? ''),
  );
  const [checked, setChecked] = useState(start === 'editErrors' || start === 'greetAsLong');
  const [same, setSame] = useState(start === 'editDuplicate');
  const [conflict, setConflict] = useState(start === 'edit412');
  const [failed, setFailed] = useState<'notSaved' | 'offline' | null>(
    start === 'editNotSaved' ? 'notSaved' : start === 'editOffline' ? 'offline' : null,
  );
  const [discarding, setDiscarding] = useState(start === 'editDiscard');
  const [language, setLanguage] = useState<GuestLanguage | null>(g.language ?? null);
  const [choosing, setChoosing] = useState(false);
  const [gn] = useState(() => groupNeedsStart(start, g, guests));
  const [needs, setNeeds] = useState<Needs>(gn.needs);
  const [needsOpen, setNeedsOpen] = useState(gn.open);
  const [needsChecked, setNeedsChecked] = useState(gn.checked);
  const [companionNeeds, setCompanionNeeds] = useState<Needs[]>(() =>
    startCompanions(start, g).map((_, at) => gn.companionNeeds[at] ?? NO_NEEDS),
  );
  const [companionOpen, setCompanionOpen] = useState<number[]>(gn.companionOpen);
  const group = useGroupChoice(gn, name.trim() === '' ? g.name : name.trim(), 'guest.edit.group');
  const needsRefs = useNeedsRefs();
  const companionRefs = useCompanionNeedsRefs();
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
  const changed =
    name !== g.name ||
    greetAsSaved(greetAs) !== (g.greetAs ?? null) ||
    email !== (g.email ?? '') ||
    joinPhone(country, number) !== g.phone ||
    language !== (g.language ?? null) ||
    group.name !== (g.group ?? null) ||
    JSON.stringify(savedNeeds(needs)) !== JSON.stringify(savedNeeds(g.needs ?? NO_NEEDS)) ||
    companions.join() !== g.companions.map((c) => c.name).join();
  const lines = needsChecked ? needsLines(needs) : {};
  const companionLines = companionNeeds.map((one) => (needsChecked ? needsLines(one) : {}));

  const next = (): SampleGuest => ({
    ...g,
    name: name.trim(),
    greetAs: greetAsSaved(greetAs),
    email: email.trim() === '' ? null : email.trim(),
    phone: joinPhone(country, number),
    language,
    group: group.name,
    needs: savedNeeds(needs),
    companions: companionsAfterEdit(companions, seats, g.kind).map((c, at) => ({
      ...c,
      needs: savedNeeds(companionNeeds[at] ?? NO_NEEDS),
    })),
  });
  const save = (anyway = false) => {
    const problems = {
      name: nameProblem(name),
      greetAs: greetAsProblem(greetAs),
      email: emailCheck(email),
      phone: phoneCheck(number, country),
    };
    const guestLines = needsLines(needs);
    const theirLines = companionNeeds.map(needsLines);
    const failing =
      Object.values(problems).filter((one) => one != null).length +
      Object.keys(guestLines).length +
      theirLines.reduce((sum, one) => sum + Object.keys(one).length, 0);
    setChecked(true);
    setNeedsChecked(true);
    if (failing > 0) readOut(NW.toFix(failing), { interrupts: true });
    if (Object.keys(guestLines).length > 0) setNeedsOpen(true);
    const theirs = theirLines.flatMap((one, at) => (Object.keys(one).length > 0 ? [at] : []));
    if (theirs.length > 0) setCompanionOpen([...new Set([...companionOpen, ...theirs])]);
    if (problems.name != null) return focusChecked(nameRef);
    if (problems.greetAs != null) return focusChecked(greetAsRef);
    if (problems.email != null) return focusChecked(emailRef);
    if (problems.phone != null) return focusChecked(numberRef);
    const first = firstFailing([guestLines, ...theirLines]);
    if (first != null) {
      if (first.at > 3) setShownAll(true);
      setTimeout(
        () =>
          focusChecked(
            first.at === 0 ? needsRefs[first.field] : companionRefs(first.at - 1)[first.field],
          ),
        300,
      );
      return;
    }
    if (group.refusedOnSave()) return;
    if (!anyway && name.trim() !== g.name && sameNameAs(guests, name, g.key) != null) {
      setSame(true);
      return;
    }
    setFailed(null);
    onSaved(next());
  };
  const discard: AskProps | null = discarding
    ? {
        title: W.discardTitle,
        line: say.discardLine(g.name),
        keep: { label: W.keepEditing, testID: 'guest.edit.keep' },
        confirm: { label: W.discardChanges, removes: true, testID: 'guest.edit.discard' },
        onKeep: () => setDiscarding(false),
        onConfirm: onClose,
        width: ASK_WIDTH,
      }
    : null;
  const drop = (index: number) => {
    setRemoved(companions[index] ?? '');
    setCompanions(companions.filter((_, i) => i !== index));
    setSeats(seats.filter((_, i) => i !== index));
    setCompanionNeeds(companionNeeds.filter((_, i) => i !== index));
    setCompanionOpen(
      companionOpen.filter((at) => at !== index).map((at) => (at > index ? at - 1 : at)),
    );
  };
  const seat = removing == null ? null : (seats[removing] ?? null);
  const seatedName = removing == null ? '' : (companions[removing] ?? '');
  const removeSeated: AskProps | null =
    removing != null && seat != null
      ? {
          title: say.removeTitle(seatedName),
          line: say.seatedLine(seatedName, seat.table ?? null, seat.meal === true),
          keep: { label: W.cancel, testID: 'guest.edit.seatedKeep' },
          confirm: { label: W.remove, removes: true, testID: 'guest.edit.seatedRemove' },
          onKeep: () => setRemoving(null),
          onConfirm: () => {
            drop(removing);
            setRemoving(null);
          },
          width: ASK_WIDTH,
        }
      : null;
  const shown = shownAll || companions.length <= 3 ? companions : companions.slice(0, 3);

  return (
    <FocusedScreen
      open={open}
      title={W.editGuest}
      verb={{ label: W.save, on: !conflict, onPress: () => save(), testID: 'guest.edit.save' }}
      onCancel={() => (changed ? setDiscarding(true) : onClose())}
      cancelTestID="guest.edit.cancel"
      opener={opener}
      ask={discard ?? removeSeated}
      over={
        choosing
          ? languageOver(
              language,
              (code) => {
                setLanguage(code);
                setChoosing(false);
              },
              () => setChoosing(false),
            )
          : group.over
      }
      testID="guest.edit"
    >
      {conflict && (
        <Amber title={W.conflict} testID="guest.edit.412">
          <Differs label={W.emailAddress} theirs={THEIRS.email} yours={email} />
          <Differs
            label={W.mobileNumber}
            theirs={`+44 ${THEIRS.phone}`}
            yours={joinPhone(country, number) ?? W.none}
          />
          <AmberLine text={W.conflictLine} />
          <AmberChoices
            first={{
              label: W.useTheirs,
              onPress: () => {
                setEmail(THEIRS.email);
                setNumber(THEIRS.phone);
                setConflict(false);
              },
              testID: 'guest.edit.theirs',
            }}
            second={{
              label: W.keepMine,
              onPress: () => setConflict(false),
              testID: 'guest.edit.mine',
            }}
          />
        </Amber>
      )}
      {same && (
        <Amber title={say.sameName(name.trim())} testID="guest.edit.same">
          <AmberLine text={W.sameName} />
          <AmberChoices
            first={{
              label: W.saveAnyway,
              onPress: () => {
                setSame(false);
                save(true);
              },
              testID: 'guest.edit.anyway',
            }}
            second={{
              label: W.changeName,
              onPress: () => {
                setSame(false);
                focusChecked(nameRef);
              },
              testID: 'guest.edit.changeName',
            }}
          />
        </Amber>
      )}
      {failed === 'notSaved' && <AlertLine text={W.notSaved} />}
      {failed === 'offline' && (
        <View style={styles.tight}>
          <AlertLine text={W.offline} />
          <AmberLine text={W.offlineLine} />
        </View>
      )}
      <GuestField
        label={W.fullName}
        value={name}
        onChange={setName}
        error={errors.name}
        autoFocus={start === 'editErrors'}
        fieldRef={nameRef}
        testID="guest.edit.name"
      />
      <GreetAsField
        value={greetAs}
        onChange={setGreetAs}
        error={errors.greetAs}
        autoFocus={GREET_AS_STARTS.includes(start)}
        fieldRef={greetAsRef}
        testID="guest.edit.greetAs"
      />
      {group.field}
      <GuestField
        label={W.emailAddress}
        value={email}
        onChange={setEmail}
        error={errors.email}
        optional
        keyboard="email-address"
        fieldRef={emailRef}
        testID="guest.edit.email"
      />
      <PhoneField
        country={country}
        number={number}
        onCountry={setCountry}
        onNumber={setNumber}
        error={errors.phone}
        help={W.contactKept}
        autoFocus={start === 'edit'}
        fieldRef={numberRef}
        testID="guest.edit.phone"
      />
      <LanguageField
        value={language}
        chose={g.chose ?? null}
        onOpen={() => setChoosing(true)}
        testID="guest.edit.language"
      />
      <NeedsSection
        title={NW.needs}
        needs={needs}
        onChange={setNeeds}
        open={needsOpen}
        onToggle={() => setNeedsOpen(!needsOpen)}
        lines={lines}
        refs={needsRefs}
        testID="guest.edit.needs"
      />
      <View style={styles.companions}>
        <Legend
          text={W.companions}
          line={companions.length === 0 ? say.noneYet(0) : say.ofTen(companions.length)}
        />
        {shown.map((c, index) => {
          const arrived = seats[index]?.arrived != null;
          const stays = say.companionStays(
            c.trim() !== '' ? c.trim() : say.guestOf(name.trim() !== '' ? name.trim() : g.name),
          );

          return (
            <View key={`${index}`} style={styles.companionBlock}>
              <View style={styles.companion}>
                <View style={styles.grow}>
                  <BoxField
                    value={c}
                    onChangeText={(text) =>
                      setCompanions(companions.map((one, i) => (i === index ? text : one)))
                    }
                    accessibilityLabel={W.companionName}
                    {...(arrived ? { accessibilityHint: stays } : {})}
                    testID={`guest.edit.companion.${index}`}
                  />
                </View>
                {!arrived && (
                  <TextAction
                    label={W.remove}
                    plain
                    onPress={() => {
                      const held = seats[index];
                      if (held != null && (held.table != null || held.meal === true)) {
                        setRemoving(index);
                        return;
                      }
                      drop(index);
                    }}
                    accessibilityLabel={`${W.remove} ${c}`}
                    testID={`guest.edit.remove.${index}`}
                  />
                )}
              </View>
              {arrived && <DoneLine text={stays} size={14} reads={false} />}
              <NeedsSection
                title={NW.theirNeeds}
                needs={companionNeeds[index] ?? NO_NEEDS}
                onChange={(next) =>
                  setCompanionNeeds(companionNeeds.map((one, at) => (at === index ? next : one)))
                }
                open={companionOpen.includes(index)}
                onToggle={() =>
                  setCompanionOpen(
                    companionOpen.includes(index)
                      ? companionOpen.filter((at) => at !== index)
                      : [...companionOpen, index],
                  )
                }
                lines={companionLines[index] ?? {}}
                refs={companionRefs(index)}
                testID={`guest.edit.companion.${index}.needs`}
              />
            </View>
          );
        })}
        {shown.length < companions.length && (
          <TextAction
            label={say.moreCompanions(companions.length - shown.length)}
            plain
            figures
            onPress={() => setShownAll(true)}
            testID="guest.edit.moreCompanions"
          />
        )}
        {removed != null && <DoneLine text={say.removed(removed)} size={14} />}
        {companions.length >= MAX ? (
          <Text size={14.5} weight="semibold" style={styles.lines}>
            {W.companionsMax}
          </Text>
        ) : (
          <TextAction
            label={W.addCompanion}
            glyph="plus"
            onPress={() => {
              setCompanions([...companions, '']);
              setSeats([...seats, null]);
              setCompanionNeeds([...companionNeeds, NO_NEEDS]);
            }}
            testID="guest.edit.addCompanion"
          />
        )}
      </View>
    </FocusedScreen>
  );
}

function Differs({ label, theirs, yours }: { label: string; theirs: string; yours: string }) {
  return (
    <View
      style={styles.differs}
      accessible
      accessibilityLabel={`${label}. ${W.theirs}: ${theirs}. ${W.yours}: ${yours}`}
    >
      <Text size={13.5} weight="semibold" accessible={false} style={styles.secondary}>
        {label}
      </Text>
      {[
        [W.theirs, theirs],
        [W.yours, yours],
      ].map(([who, value]) => (
        <View key={who} style={styles.differsRow}>
          <Text
            size={14.5}
            weight="semibold"
            accessible={false}
            style={[styles.secondary, styles.who]}
          >
            {who}
          </Text>
          <Text
            size={14.5}
            weight="medium"
            accessible={false}
            style={[styles.grow, styles.figures]}
          >
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** One of the guest's own three answers, as their page draws it: the mark at 28, the word, a radio. */
function AnswerRow({
  answer,
  on,
  wrong,
  onPick,
}: {
  answer: Answer;
  on: boolean;
  wrong: boolean;
  onPick: () => void;
}) {
  return (
    <Pressable
      onPress={onPick}
      style={({ pressed }) => [
        styles.answer,
        on && styles.lit,
        wrong && styles.wrong,
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={REPLY_WORD[answer]}
      aria-invalid={wrong}
      testID={`guest.record.${answer}`}
    >
      <View style={styles.answerMark}>
        <ReplyMark kind={answer} side={28} />
      </View>
      <Text
        size={17}
        weight="semibold"
        accessible={false}
        style={[styles.grow, on && styles.accent]}
      >
        {REPLY_WORD[answer]}
      </Text>
      <RadioMark on={on} />
    </Pressable>
  );
}

export function Chip({
  word,
  on,
  wrong,
  onPress,
  testID,
  hint,
  ref,
}: {
  word: string;
  on: boolean;
  wrong: boolean;
  onPress: () => void;
  testID: string;
  /** What a refusal says, read with the chip it puts the focus on. */
  hint?: string | undefined;
  ref?: Ref<ViewInstance> | undefined;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        on && styles.chipOn,
        wrong && styles.wrong,
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      accessibilityHint={hint}
      aria-invalid={wrong}
      testID={testID}
    >
      {on && <Glyph name="tick" size={15} ink={tokens.colorAccentText} weight={2.8} />}
      <Text size={15} weight="semibold" accessible={false} style={on ? styles.accent : undefined}>
        {word}
      </Text>
    </Pressable>
  );
}

export function CheckRow({
  label,
  on,
  onPress,
  testID,
  line,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  testID: string;
  line?: string;
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

/** sc-54450: Record a reply opened from a copied message, the quote above it and Back to Whose reply is this?. */
export interface FromMessage {
  quote: string;
  offline: boolean;
  start: 'open' | 'blank' | 'offline' | null;
}

/** Record a reply (sc-3787): nothing chosen when it opens; both answers needed before Save. From a message, By message is chosen. */
export function RecordReply({
  open,
  guest: g,
  start,
  locale,
  opener,
  onClose,
  onSaved,
  message = null,
}: {
  open: boolean;
  guest: SampleGuest;
  locale: string;
  start: RecordState | null;
  opener: Opener;
  onClose: () => void;
  onSaved: (next: SampleGuest) => void;
  message?: FromMessage | null;
}) {
  const [answer, setAnswer] = useState<Answer | null>(
    start === 'recordComing' || message?.start === 'offline' ? 'coming' : null,
  );
  const [how, setHow] = useState<string | null>(
    message != null ? PW.byMessage : start === 'recordComing' ? HOW_TOLD[0] : null,
  );
  const [ticked, setTicked] = useState<boolean[]>(() => startTicks(g));
  const [checked, setChecked] = useState(start === 'recordRefused' || message?.start === 'blank');
  const [asking, setAsking] = useState(start === 'recordReplace');
  const [failed, setFailed] = useState(start === 'recordNotSaved');
  const [refused, setRefused] = useState(message?.start === 'offline');
  const [all, setAll] = useState(false);
  const first = useRef<ViewInstance>(null);
  const save = () => {
    setChecked(true);
    if (answer == null || how == null) return;
    setFailed(false);
    if (message?.offline === true) {
      setRefused(true);
      readOut(`${W.offline} ${W.offlineLine}`, { interrupts: true });
      return;
    }
    onSaved(recorded(g, answer, how, ticked, TODAY));
  };
  const comps = answer === 'coming' && g.companions.length > 0;

  return (
    <FocusedScreen
      open={open}
      title={W.recordReply}
      verb={{ label: W.save, on: !asking, onPress: save, testID: 'guest.record.save' }}
      back={message == null ? undefined : PW.whose}
      onCancel={onClose}
      cancelTestID="guest.record.cancel"
      opener={opener}
      gap={18}
      testID="guest.record"
    >
      {asking && (
        <Amber
          title={say.replacedThemselves(
            g.name,
            REPLY_WORD[g.kind === 'walkin' ? 'coming' : g.kind],
            dayWords(g.when ?? TODAY, locale),
          )}
          testID="guest.record.replace"
        >
          <AmberLine text={W.replaceTheirsLine} />
          <AmberChoices
            primary
            first={{
              label: W.replaceTheirs,
              onPress: () => setAsking(false),
              testID: 'guest.record.replaceYes',
            }}
            second={{ label: W.keepTheirs, onPress: onClose, testID: 'guest.record.keep' }}
          />
        </Amber>
      )}
      {failed && <AlertLine text={W.notSaved} />}
      {refused && (
        <View style={styles.tight} testID="guest.record.offline">
          <AlertLine text={W.offline} />
          <AmberLine text={W.offlineLine} />
        </View>
      )}
      {message != null && <Quote text={message.quote} all={all} onShowAll={() => setAll(true)} />}
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {say.forName(g.name)}
      </Text>
      <View ref={first} style={styles.tight} accessibilityRole="radiogroup">
        <Legend text={W.theirReply} />
        {(['coming', 'notcoming', 'maybe'] as const).map((one) => (
          <AnswerRow
            key={one}
            answer={one}
            on={answer === one}
            wrong={checked && answer == null}
            onPick={() => setAnswer(one)}
          />
        ))}
        {checked && answer == null && <AlertLine text={W.replyBlank} />}
      </View>
      <View style={styles.tight} accessibilityRole="radiogroup">
        <Legend text={W.howTold} />
        <View style={styles.chips}>
          {HOW_TOLD.map((one) => (
            <Chip
              key={one}
              word={one}
              on={how === one}
              wrong={checked && how == null}
              onPress={() => setHow(one)}
              testID={`guest.record.how.${one}`}
            />
          ))}
        </View>
        {checked && how == null && <AlertLine text={W.howBlank} />}
      </View>
      {comps && (
        <View style={styles.tight}>
          <Legend text={W.whoComing} />
          <Text size={14} weight="medium" style={[styles.secondary, styles.lines]}>
            {W.whoComingLine}
          </Text>
          {g.companions.map((c, index) => (
            <CheckRow
              key={c.name}
              label={c.name}
              on={ticked[index] !== false}
              onPress={() => setTicked(ticked.map((one, i) => (i === index ? !one : one)))}
              testID={`guest.record.companion.${index}`}
            />
          ))}
        </View>
      )}
      {!asking && (
        <Text size={13.5} weight="medium" style={[styles.secondary, styles.small]}>
          {say.recordFoot(g.name)}
        </Text>
      )}
    </FocusedScreen>
  );
}

/** Mark as invited (sc-3788): how they were invited, nothing chosen; a sheet of five 52 rows. */
export function MarkInvited({
  open,
  start,
  opener,
  onClose,
  onMarked,
}: {
  open: boolean;
  start: 'markAsInvited' | 'markRefused' | 'markNotSaved' | null;
  opener: Opener;
  onClose: () => void;
  onMarked: (how: string) => void;
}) {
  const [how, setHow] = useState<string | null>(start === 'markNotSaved' ? HOW_INVITED[0] : null);
  const [checked, setChecked] = useState(start === 'markRefused');
  const [failed, setFailed] = useState(start === 'markNotSaved');
  const mark = () => {
    setChecked(true);
    if (how == null) return;
    setFailed(false);
    onMarked(how);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      opener={opener}
      scrimLabel={W.cancel}
      docked
      testID="guest.mark"
    >
      <SheetBody title={W.markAsInvited} close={W.cancel} onClose={onClose}>
        {failed && <AlertLine text={W.markNotSaved} />}
        <View accessibilityRole="radiogroup" style={styles.tight}>
          <Legend text={W.howInvited} />
          {HOW_INVITED.map((one) => (
            <Pressable
              key={one}
              onPress={() => setHow(one)}
              style={({ pressed }) => [
                styles.way,
                how === one && styles.lit,
                checked && how == null && styles.wrong,
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: how === one }}
              accessibilityLabel={one}
              testID={`guest.mark.${one}`}
            >
              <Text
                size={16}
                weight="semibold"
                accessible={false}
                style={[styles.grow, how === one && styles.accent]}
              >
                {one}
              </Text>
              <RadioMark on={how === one} />
            </Pressable>
          ))}
          {checked && how == null && <AlertLine text={W.howInvitedBlank} />}
        </View>
        <Pill label={W.markAsInvited} onPress={mark} testID="guest.mark.do" />
      </SheetBody>
    </Sheet>
  );
}

export { Legend, SheetBody, SheetLayer };

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
  lines: { lineHeight: 15 * 1.45 },
  small: { lineHeight: 13.5 * 1.45 },
  tight: { gap: 6 },
  companions: { gap: 8 },
  companion: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  companionBlock: { gap: 4 },
  differs: {
    gap: 2,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.colorAttentionBorder,
  },
  differsRow: { flexDirection: 'row', gap: 10 },
  who: { width: 52 },
  answer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
  answerMark: { width: 40, alignItems: 'center' },
  lit: { backgroundColor: tokens.colorAccentTint },
  wrong: { borderWidth: 1.5, borderColor: tokens.colorBroken },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: tokens.colorControlBorder,
  },
  chipOn: { borderColor: tokens.colorAccentTint, backgroundColor: tokens.colorAccentTint },
  check: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: tokens.colorControlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { borderColor: tokens.colorAccent, backgroundColor: tokens.colorAccent },
  way: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -10,
    paddingHorizontal: 10,
    borderRadius: tokens.radiusRow,
  },
});
