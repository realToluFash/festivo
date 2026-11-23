import {
  ApiError,
  type EventCover,
  GUEST_ANSWERS,
  type GuestAnswer,
  type GuestCalendarLink,
  type GuestPage,
  type GuestPagePhase,
  realtimeTopic,
} from '@soirely/api-client';
import { formatEventClock, hostsLine, listFormat, wallDay } from '@soirely/domain';
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { api } from '../../api.ts';
import { Glyph } from '../../components/Glyph.tsx';
import { Thanks } from '../../components/Thanks.tsx';
import { currentLocale, dateLocale } from '../../i18n/index.ts';
import { meshFor } from '../../mesh.ts';
import { offButton } from '../../offButton.ts';
import { usePhoneWidth, useWideWidth } from '../../phoneWidth.ts';
import { useServerNow } from '../../serverNow.ts';
import { Filled, Notice, TextAction, dayOf, format, readerZone, wallDayOf } from './GuestParts.tsx';
import { WhereBlock, YourCode, hasWhere, leadsOnTheDay, placeOf } from './GuestDay.tsx';
import { InvalidInvitation } from './InvalidInvitation.tsx';
import { Programme } from './Programme.tsx';
import { YourTable } from './YourTable.tsx';
import { useHubTopics } from '../app/events/useHubTopics.ts';
import {
  KITCHEN_SAVED_ID,
  KitchenCheck,
  KitchenRow,
  KitchenSaved,
  KitchenStep,
} from './Kitchen.tsx';
import { openIn, saveAgain, useGuestLanguage } from './guestLanguage.ts';
import {
  type Party,
  type PartyPerson,
  choices,
  comingWith,
  hasStep,
  labelOf,
  partyOf,
  renamed,
  renaming,
  toggled,
} from './party.ts';
import {
  type Kitchen,
  type Person,
  YOU,
  firstProblem,
  kitchenOf,
  needsOf,
  placeNeeds,
  skipped,
} from './kitchen.ts';
import { forgetStarted, markStarted, wasStarted } from './started.ts';
import { MarkedLine, MealCards, MealScreen, MealsSaved } from './Meals.tsx';
import {
  type Cleared,
  type Plate,
  type Plates,
  allergiesOf,
  askedCourses,
  changeFocus,
  clearRuledOut,
  eatersOf,
  defaultLine,
  keyOf,
  markOf,
  markedOpen,
  nothingSafe,
  oneCloseDay,
  otherOf,
  picksOf,
  refusalOf,
  samePlate,
  savedPlates,
  stepsOf,
} from './meals.ts';
import './withYou.css';

type Load =
  | { kind: 'loading' }
  | { kind: 'gone' }
  | { kind: 'unreachable' }
  | { kind: 'loaded'; page: GuestPage };

type View =
  | { kind: 'answer'; busy: GuestAnswer | null; note: 'unsent' | 'notSentTap' | null }
  | { kind: 'withYou'; from: 'answer' | 'changing' }
  | {
      kind: 'kitchen';
      from: 'answer' | 'changing';
      /** Where Next and Back return when the note was opened from a row: Check and send, or the picks saved. */
      returns?: 'check' | 'saved';
    }
  | {
      kind: 'meal';
      from: 'answer' | 'changing';
      /** Where Next at the end of the course, or Back on its first screen, returns: on through the step, Check and send, or the picks saved. */
      to: 'flow' | 'check' | 'saved';
      eater: number;
      course: number;
      step: number;
    }
  | { kind: 'kitchenAfter'; busy: boolean; failed: boolean }
  | {
      kind: 'check';
      busy: boolean;
      failed: boolean;
      refused?: boolean;
      unsaved?: boolean;
      from: 'answer' | 'changing';
    }
  | { kind: 'recorded'; same: boolean }
  | { kind: 'changing'; busy: GuestAnswer | null; failed: boolean }
  | { kind: 'closed' };

/** The meal step's picks (sc-3907), kept across the steps and on coming back until sent. */
interface Meal {
  plates: Plates;
  cleared: Readonly<Record<string, Cleared>>;
  draft: Plate | null;
  pressed: boolean;
  told: 'marked' | 'nothing' | 'saved' | 'failed' | null;
  refused: ReadonlySet<string>;
  /** The rows of a refused course whose answer the send changed, which carry its alert. */
  unsaved: ReadonlySet<string>;
  busy: boolean;
}

const NO_MEAL: Meal = {
  plates: {},
  cleared: {},
  draft: null,
  pressed: false,
  told: null,
  refused: new Set(),
  unsaved: new Set(),
  busy: false,
};

type Tell =
  | { kind: 'card' }
  | { kind: 'asking'; busy: boolean; result: 'failed' | 'limited' | null }
  | { kind: 'told' };

const CHOICE = { coming: 'guest.yes', notComing: 'guest.no', maybe: 'guest.maybe' } as const;
const WORD = {
  coming: 'guest.coming',
  notComing: 'guest.notComing',
  maybe: 'guest.notSure',
} as const;
const ANSWERED = {
  coming: 'guest.answeredComing',
  notComing: 'guest.answeredNotComing',
  maybe: 'guest.answeredNotSure',
} as const;
const ANSWER_IS = {
  coming: 'guest.answerIsComing',
  notComing: 'guest.answerIsNotComing',
  maybe: 'guest.answerIsNotSure',
} as const;
const GREETING = {
  coming: 'guest.greetComing',
  notComing: 'guest.greetNotComing',
  maybe: 'guest.greetNotSure',
} as const;
const KEBAB = { coming: 'coming', notComing: 'not-coming', maybe: 'not-sure' } as const;

const PIECES = [1, 2, 3, 4, 5, 6, 7];
const ROWS = [1, 2, 3];

/** A page left open hears a pause, a resume or the end within a minute (sc-3591). */
const REFRESH_MS = 30_000;

const REFUSED = ['event_paused', 'event_concluded'] as const;

function ended(phase: GuestPagePhase): boolean {
  return phase === 'calledOff' || phase === 'finished';
}

function standing(page: GuestPage): string {
  return `${page.phase}:${String(page.started)}:${String(page.answersOpen)}`;
}

/** What the kitchen note would send, so an unsent change on coming back can be told from the record. */
function sentNeeds(kitchen: Kitchen, page: GuestPage): string {
  const me = kitchen.people.find((one) => one.key === YOU);

  return JSON.stringify([me == null ? null : needsOf(me), placeNeeds(kitchen, page)]);
}

function sameParty(was: GuestPage, now: GuestPage): boolean {
  return (
    JSON.stringify(was.guest.companions) === JSON.stringify(now.guest.companions) &&
    JSON.stringify(was.guest.unnamed) === JSON.stringify(now.guest.unnamed) &&
    JSON.stringify(was.guest.needs) === JSON.stringify(now.guest.needs)
  );
}

/** What Send my answer sends with Coming: every place, each one coming with its card from the kitchen step. */
function sentParty(party: Party, kitchen: Kitchen | null): ReturnType<typeof choices> {
  return choices(party, (id) => {
    const one =
      kitchen?.left === false ? kitchen.people.find((each) => each.key === id) : undefined;

    return one == null ? undefined : needsOf(one);
  });
}

/** The control that had focus before an update, so focus can follow it or fall to the h1 (sc-3591). */
function focused(): { on: string | null; was: Element } | null {
  const was = document.activeElement;
  if (was == null || was.closest('.gp-columns') == null) return null;

  return { on: was.getAttribute('data-focus'), was };
}

/** The guest's own page in A · The cover card (sc-1526). Opening it records nothing; only an answer sent does (sc-1439). */
export function Invitation() {
  const token = useOutletContext<string>();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let current = true;

    api.guestPage(token).then(
      async (page) => {
        if (!current) return;
        await openIn(page.language);
        if (current) setLoad({ kind: 'loaded', page });
      },
      (error: unknown) => {
        if (!current) return;
        setRetrying(false);
        setLoad(
          error instanceof ApiError && error.status === 404
            ? { kind: 'gone' }
            : { kind: 'unreachable' },
        );
      },
    );

    return () => {
      current = false;
    };
  }, [token, attempt]);

  if (load.kind === 'gone') return <InvalidInvitation />;

  if (load.kind === 'unreachable')
    return (
      <PageUnreachable
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          setAttempt((n) => n + 1);
        }}
      />
    );

  if (load.kind === 'loading') return <PageLoading />;

  return <Card token={token} first={load.page} />;
}

export function PageUnreachable({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="gp-alone-wrap">
      <div className="gp-alone">
        <span className="gp-alone-mark" aria-hidden="true">
          <Glyph name="alert" size={26} />
        </span>
        <h1 className="gp-alone-title">{t('session.unreachableTitle')}</h1>
        <p>{t('session.unreachableBodySignedOut')}</p>
        <button
          className="gp-filled is-narrow"
          type="button"
          aria-busy={retrying}
          {...offButton(retrying, { dim: false })}
          onClick={onRetry}
        >
          {retrying && <span className="gp-spinner" aria-hidden="true" />}
          {retrying ? t('session.retrying') : t('error.retry')}
        </button>
      </div>
    </div>
  );
}

export function PageLoading() {
  const { t } = useTranslation();
  const wide = useWideWidth();

  return (
    <div className="gp-columns" aria-busy="true">
      <p className="visually-hidden" role="status">
        {t('pending.loading')}
      </p>
      <span className="gp-skel gp-skel-cover gp-left" aria-hidden="true" />
      <div className="gp-skel-under" aria-hidden="true">
        <span className="gp-skel is-head" />
        <span className="gp-skel is-line" />
        <span className="gp-skel is-short" />
        {ROWS.map((row) => (
          <span key={row} className="gp-skel-row">
            <span className="gp-skel is-dot" />
            <span className="gp-skel is-bar" />
          </span>
        ))}
      </div>
      {wide && <span className="gp-skel gp-skel-details gp-left-after" aria-hidden="true" />}
    </div>
  );
}

/** From 64rem the cover and its details sit left, placed by their measured heights, so the page reads cover, answer, details, foot at every width. */
function useColumns(): (box: HTMLDivElement | null) => void {
  const [box, setBox] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (box == null) return;
    const height = (part: string) =>
      box.querySelector<HTMLElement>(`:scope > ${part}`)?.offsetHeight ?? 0;
    const place = () => {
      box.style.setProperty('--gpCoverH', `${height('.gp-left')}px`);
      box.style.setProperty('--gpDetailsH', `${height('.gp-left-after')}px`);
    };
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    const watch = () => {
      sizes?.disconnect();
      for (const child of box.children) sizes?.observe(child);
      place();
    };
    const children = new MutationObserver(watch);
    children.observe(box, { childList: true });
    watch();

    return () => {
      sizes?.disconnect();
      children.disconnect();
    };
  }, [box]);

  return setBox;
}

function opening(page: GuestPage, token: string): View {
  if (!page.answersOpen) return { kind: 'closed' };
  if (page.guest.reply != null) {
    forgetStarted(token);
    return { kind: 'recorded', same: false };
  }

  return { kind: 'answer', busy: null, note: wasStarted(token) ? 'unsent' : null };
}

function savedMeal(page: GuestPage): Meal {
  return {
    ...NO_MEAL,
    refused: new Set(),
    unsaved: new Set(),
    plates: savedPlates(page.meals, eatersOf(page.meals, partyOf(page))),
  };
}

const PREVIEW_START: View = {
  kind: 'meal',
  from: 'answer',
  to: 'flow',
  eater: 0,
  course: 0,
  step: 0,
};

/** In Preview as guest (sc-3907) the card opens on the first meal screen, sends nothing, and either Close preview leaves it. */
export function Card({
  token,
  first,
  preview = null,
}: {
  token: string;
  first: GuestPage;
  preview?: { onClose: () => void } | null;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(first);
  const [view, setView] = useState<View>(() =>
    preview == null ? opening(first, token) : PREVIEW_START,
  );
  const [party, setParty] = useState<Party>(() => partyOf(first));
  const [kitchen, setKitchen] = useState<Kitchen | null>(() =>
    preview == null ? null : kitchenOf(first, partyOf(first), null),
  );
  const [kitchenSaved, setKitchenSaved] = useState(false);
  const [meal, setMeal] = useState<Meal>(() => savedMeal(first));
  const [tell, setTell] = useState<Tell>({ kind: 'card' });
  const [want, setWant] = useState<{ on: string } | null>(() =>
    preview == null ? null : { on: 'mealHead' },
  );
  const [gone, setGone] = useState(false);
  const columns = useColumns();
  const [held, setHeld] = useState<ReturnType<typeof focused>>(null);
  const seen = useRef(standing(first));
  const sends = useRef(0);
  const [leads] = useState(() => preview == null && leadsOnTheDay(first));
  const phone = usePhoneWidth();
  const { guest, event } = page;
  const when = useWhen(event);
  const hosts = hostsLine(event.hosts, currentLocale());
  const count = Math.max(event.hosts.length, 1);
  const courses = askedCourses(page.meals);
  const eaters = eatersOf(page.meals, party);
  const allergies = allergiesOf(page, kitchen);
  const others = otherOf(page, kitchen);
  const kitchenPending =
    kitchen != null &&
    sentNeeds(kitchen, page) !== sentNeeds(kitchenOf(page, partyOf(page), null), page);

  useLayoutEffect(() => {
    if (want == null) return;
    const target =
      want.on === 'mealFirst'
        ? '.guest-page .ms-options input:not(:disabled)'
        : `.guest-page [data-focus="${want.on}"]`;
    document.querySelector<HTMLElement>(target)?.focus();
  }, [want]);

  useEffect(() => {
    if (held == null || held.was.isConnected) return;
    const same =
      held.on == null
        ? null
        : document.querySelector<HTMLElement>(`.guest-page [data-focus="${held.on}"]`);
    (same ?? document.querySelector<HTMLElement>('.guest-page [data-focus="h1"]'))?.focus();
  }, [held]);

  const focus = (on: string) => setWant({ on });

  function refreshed(next: GuestPage): void {
    const had = focused();
    setPage(next);
    if (standing(next) === seen.current) return;

    seen.current = standing(next);
    setView(opening(next, token));
    setParty(partyOf(next));
    setKitchen(null);
    setMeal(savedMeal(next));
    setHeld(had);
  }

  function askAgain(): void {
    const asked = sends.current;
    api.guestPage(token).then(
      (next) => {
        if (asked === sends.current) refreshed(next);
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) setGone(true);
      },
    );
  }

  useEffect(() => {
    if (preview != null) return undefined;
    const timer = setInterval(askAgain, REFRESH_MS);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- askAgain reads only the token, setters and refs
  }, [token]);

  const topics = useMemo(
    () => (preview == null ? [realtimeTopic('EventGuestPages', page.event.id)] : []),
    [page.event.id, preview],
  );

  useHubTopics(topics, () => api.guestPageSubscription(token), askAgain, askAgain);

  function send(answer: GuestAnswer, onFail: (refused: boolean) => void): void {
    sends.current += 1;
    const coming = answer === 'coming';
    const { companions, unnamed } =
      coming && hasStep(party) ? sentParty(party, kitchen) : { companions: [], unnamed: [] };
    const me =
      coming && kitchen?.left === false ? kitchen.people.find((one) => one.key === YOU) : undefined;
    api.sendGuestAnswer(token, answer, companions, me == null ? null : needsOf(me), unnamed).then(
      (next) => {
        forgetStarted(token);
        const same =
          page.guest.reply?.answer === answer &&
          next.guest.reply?.at === page.guest.reply.at &&
          sameParty(page, next);
        setPage(next);
        setParty(partyOf(next));
        setKitchen(null);
        setView({ kind: 'recorded', same });
        focus('greeting');
        if (coming && courses.length > 0) sendPicks(next, meal.plates, null);
        else setMeal(savedMeal(next));
      },
      (error: unknown) => {
        if (error instanceof ApiError && REFUSED.some((code) => error.is(code))) {
          refuse();
        } else if (
          error instanceof ApiError &&
          error.is('replies_closed') &&
          view.kind === 'check'
        ) {
          refuse();
        } else if (error instanceof ApiError && error.is('replies_closed')) {
          setPage((was) => ({ ...was, answersOpen: false }));
          setView({ kind: 'closed' });
          focus('closedHead');
        } else if (error instanceof ApiError && error.status === 404) setGone(true);
        else onFail(error instanceof ApiError && error.status === 422);
      },
    );
  }

  /** Paused or over while sending: Check and send stays with what was chosen; a one-tap answer gives way to the page as it now stands. */
  function refuse(): void {
    const had = focused();
    const checking = view.kind === 'check';
    api.guestPage(token).then(
      (next) => {
        seen.current = standing(next);
        setPage(next);
        if (checking) {
          setView({ kind: 'check', busy: false, failed: false, refused: true, from: 'answer' });
          focus('checkHead');
        } else {
          setView(opening(next, token));
          setHeld(had);
        }
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) setGone(true);
        else setView({ kind: 'closed' });
      },
    );
  }

  function choose(answer: GuestAnswer): void {
    if (view.kind !== 'answer' && view.kind !== 'changing') return;
    if (view.busy != null) return;
    const from = view.kind;

    if (answer === 'coming') {
      if (from === 'answer') markStarted(token);
      if (hasStep(party)) {
        setView({ kind: 'withYou', from });
        focus('withYouHead');
        return;
      }
      toKitchen(from);
      return;
    }

    setView(
      from === 'answer'
        ? { kind: 'answer', busy: answer, note: null }
        : { kind: 'changing', busy: answer, failed: false },
    );
    send(answer, () => {
      setView(
        from === 'answer'
          ? { kind: 'answer', busy: null, note: 'notSentTap' }
          : { kind: 'changing', busy: null, failed: true },
      );
      focus(`row-${answer}`);
    });
  }

  function sendComing(): void {
    if (view.kind !== 'check' || view.busy) return;
    if (preview != null) {
      preview.onClose();
      return;
    }
    const marked = markedOpen(meal.plates, eaters, courses, allergies);
    if (marked[0] != null) {
      setMeal((was) => ({ ...was, told: 'marked' }));
      focus(changeFocus(marked[0]));
      return;
    }
    setView({ ...view, busy: true, failed: false });
    send('coming', (refused) => {
      setView({ ...view, busy: false, failed: !refused, unsaved: refused });
      focus(refused ? 'kitchenRow' : 'send');
    });
  }

  function withYou(): void {
    if (view.kind !== 'check' && view.kind !== 'kitchen') return;
    setView({ kind: 'withYou', from: view.from });
    focus('withYouHead');
  }

  function toKitchen(from: 'answer' | 'changing', returns?: 'check' | 'saved'): void {
    setKitchen((was) => kitchenOf(page, party, was));
    setView(returns == null ? { kind: 'kitchen', from } : { kind: 'kitchen', from, returns });
    focus('kitchenHead');
  }

  /** Change on the kitchen row of the picks saved: the note, then back to the picks, where its change waits for Send my changes. */
  function savedKitchen(): void {
    if (meal.busy) return;
    setMeal((was) => ({ ...was, told: null }));
    toKitchen('changing', 'saved');
  }

  /** Back to wherever a row opened the kitchen note from, with focus on that row's Change. */
  function kitchenReturn(returns: 'check' | 'saved', from: 'answer' | 'changing'): void {
    setView(
      returns === 'check'
        ? { kind: 'check', busy: false, failed: false, from }
        : { kind: 'recorded', same: false },
    );
    focus('kitchenRow');
  }

  /** Each person's picks, sent once the answer and the kitchen note are, so the API checks them against the allergens as now recorded. */
  function sendPicks(at: GuestPage, plates: Plates, told: Meal['told']): void {
    const named = new Set(at.guest.companions.map((one) => one.id));
    const people = eatersOf(at.meals, partyOf(at));
    const picks = picksOf(plates, people, askedCourses(at.meals), (key) =>
      key === YOU ? at.meals.you : named.has(key) ? key : null,
    );
    if (picks.length === 0) {
      setMeal({ ...savedMeal(at), told });
      return;
    }
    setMeal((was) => ({ ...was, busy: true, told: null }));
    sends.current += 1;
    api.sendMealPicks(token, picks).then(
      (after) => {
        setPage(after);
        setMeal({ ...savedMeal(after), told });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('meal_picks_closed')) {
          const refused = new Set(error.problem.courses ?? []);
          const before = savedPlates(at.meals, people);
          const unsaved = new Set(
            people.flatMap((eater) =>
              askedCourses(at.meals)
                .filter((course) => refused.has(course.id))
                .map((course) => keyOf(eater.key, course.id))
                .filter((key) => !samePlate(plates[key], before[key])),
            ),
          );
          const first = [...unsaved][0];
          const shown = () => {
            if (first != null) focus(`refused-${first}`);
          };
          api.guestPage(token).then(
            (after) => {
              seen.current = standing(after);
              setPage(after);
              if (!after.answersOpen) setView(opening(after, token));
              setMeal({ ...savedMeal(after), refused, unsaved });
              shown();
            },
            () => {
              setMeal((was) => ({ ...was, busy: false, refused, unsaved }));
              shown();
            },
          );
          return;
        }
        if (error instanceof ApiError && error.status === 404) setGone(true);
        else setMeal((was) => ({ ...was, busy: false, told: 'failed' }));
      },
    );
  }

  /** The draft a course opens with: its pick, unless an allergy given since rules it out. */
  function draftOf(plates: Plates, eater: number, course: number, mine = allergies): Plate | null {
    const who = eaters[eater];
    const what = courses[course];
    if (who == null || what == null) return null;
    const was = plates[keyOf(who.key, what.id)];
    if (was == null || was.kind === 'defaulted' || was.kind === 'needsHost') return null;

    return markOf(what, was, mine(who.key)) == null ? was : null;
  }

  function openMeal(
    eater: number,
    course: number,
    from: 'answer' | 'changing',
    to: 'flow' | 'check' | 'saved',
    plates: Plates = meal.plates,
    mine = allergies,
  ): void {
    setMeal((was) => ({
      ...was,
      plates,
      draft: draftOf(plates, eater, course, mine),
      pressed: false,
      told: null,
    }));
    setView({ kind: 'meal', from, to, eater, course, step: 0 });
    focus('mealHead');
  }

  /** Next or Nothing to add on the kitchen note: on to the first meal screen, clearing a pick an allergy given there rules out, or back to Check and send. */
  function afterKitchen(
    from: 'answer' | 'changing',
    returns: 'check' | 'saved' | undefined,
    now: Kitchen,
  ): void {
    if (returns != null) {
      kitchenReturn(returns, from);
      return;
    }
    if (courses.length === 0) {
      toCheck(from);
      return;
    }
    const mine = allergiesOf(page, now);
    const result = clearRuledOut(meal.plates, eaters, courses, mine);
    setMeal((was) => ({ ...was, cleared: { ...was.cleared, ...result.cleared } }));
    openMeal(0, 0, from, 'flow', result.plates, mine);
  }

  function leaveMeal(to: 'check' | 'saved', key: string, from: 'answer' | 'changing'): void {
    setView(
      to === 'check'
        ? { kind: 'check', busy: false, failed: false, from }
        : { kind: 'recorded', same: false },
    );
    focus(changeFocus(key));
  }

  function mealNext(): void {
    if (view.kind !== 'meal') return;
    const eater = eaters[view.eater];
    const course = courses[view.course];
    if (eater == null || course == null) return;
    const { draft } = meal;
    const safe = !nothingSafe(course, allergies(eater.key));
    let answer: Plate;
    if (draft != null && draft.kind !== 'chosen') answer = draft;
    else if (!safe && draft == null)
      answer = { kind: 'needsHost', dish: null, variant: null, options: {} };
    else {
      const steps = stepsOf(course, draft);
      const step = steps[view.step] ?? steps[0];
      if (step != null && refusalOf(step, draft, view.step === 0) != null) {
        setMeal((was) => ({ ...was, pressed: true }));
        focus('mealFirst');
        return;
      }
      if (view.step < steps.length - 1) {
        setMeal((was) => ({ ...was, pressed: false }));
        setView({ ...view, step: view.step + 1 });
        focus('mealHead');
        return;
      }
      if (draft == null) return;
      answer = draft;
    }
    const key = keyOf(eater.key, course.id);
    const plates = { ...meal.plates, [key]: answer };
    const cleared = Object.fromEntries(Object.entries(meal.cleared).filter(([one]) => one !== key));
    setMeal((was) => ({ ...was, plates, cleared, draft: null, pressed: false }));
    if (view.to !== 'flow') {
      leaveMeal(view.to, key, view.from);
      return;
    }
    if (view.course < courses.length - 1)
      openMeal(view.eater, view.course + 1, view.from, 'flow', plates);
    else if (view.eater < eaters.length - 1) openMeal(view.eater + 1, 0, view.from, 'flow', plates);
    else toCheck(view.from);
  }

  function mealBack(): void {
    if (view.kind !== 'meal') return;
    const eater = eaters[view.eater];
    const course = courses[view.course];
    if (eater == null || course == null) return;
    const key = keyOf(eater.key, course.id);
    if (view.step > 0) {
      setMeal((was) => ({ ...was, pressed: false }));
      setView({ ...view, step: view.step - 1 });
      focus('mealHead');
      return;
    }
    if (view.to !== 'flow') {
      setMeal((was) => ({ ...was, draft: null, pressed: false }));
      leaveMeal(view.to, key, view.from);
      return;
    }
    const { draft } = meal;
    const done =
      draft != null &&
      (draft.kind !== 'chosen' ||
        stepsOf(course, draft).every((step, at) => refusalOf(step, draft, at === 0) == null));
    const plates = done ? { ...meal.plates, [key]: draft } : meal.plates;
    if (view.course > 0) openMeal(view.eater, view.course - 1, view.from, 'flow', plates);
    else if (view.eater > 0)
      openMeal(view.eater - 1, courses.length - 1, view.from, 'flow', plates);
    else {
      setMeal((was) => ({ ...was, plates, draft: null, pressed: false }));
      setView({ kind: 'kitchen', from: view.from });
      focus('kitchenHead');
    }
  }

  /** Send my changes, on coming back: refused while an open pick holds an allergen, and says so when nothing has changed. */
  function sendChanges(): void {
    if (meal.busy) return;
    const marked = markedOpen(meal.plates, eaters, courses, allergies);
    if (marked[0] != null) {
      setMeal((was) => ({ ...was, told: 'marked' }));
      focus(changeFocus(marked[0]));
      return;
    }
    const saved = savedPlates(page.meals, eaters);
    const changed = eaters.some((eater) =>
      courses.some(
        (course) =>
          !course.picksClose.closed &&
          !samePlate(meal.plates[keyOf(eater.key, course.id)], saved[keyOf(eater.key, course.id)]),
      ),
    );
    if (kitchen != null && kitchenPending) {
      sendKitchen(kitchen, changed);
      return;
    }
    if (!changed) {
      setMeal((was) => ({ ...was, told: 'nothing' }));
      return;
    }
    sendPicks(page, meal.plates, 'saved');
  }

  /** The kitchen row's change, sent with Send my changes before the picks, so the API checks them against its allergens. */
  function sendKitchen(now: Kitchen, picks: boolean): void {
    const me = now.people.find((one) => one.key === YOU);
    const { companions, unnamed } = placeNeeds(now, page);
    const { plates } = meal;
    setMeal((was) => ({ ...was, busy: true, told: null }));
    sends.current += 1;
    api.sendGuestNeeds(token, me == null ? null : needsOf(me), companions, unnamed).then(
      (next) => {
        setPage(next);
        setKitchen(null);
        if (picks) sendPicks(next, plates, 'saved');
        else setMeal({ ...savedMeal(next), told: 'saved' });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) setGone(true);
        else if (error instanceof ApiError && error.status === 409) refetchAfterRefusal();
        else setMeal((was) => ({ ...was, busy: false, told: 'failed' }));
      },
    );
  }

  /** A send the API refused because the event paused or started meanwhile: the page as it now stands. */
  function refetchAfterRefusal(): void {
    api.guestPage(token).then(
      (after) => {
        seen.current = standing(after);
        setPage(after);
        setKitchen(null);
        setMeal(savedMeal(after));
        setView(opening(after, token));
      },
      () => setMeal((was) => ({ ...was, busy: false, told: 'failed' })),
    );
  }

  function partyNext(): void {
    if (view.kind !== 'withYou') return;
    toKitchen(view.from);
  }

  function toCheck(from: 'answer' | 'changing'): void {
    setView({ kind: 'check', busy: false, failed: false, from });
    focus('checkHead');
  }

  /** Next checks every card first: the first field still wrong takes focus and the step stays. */
  function kitchenNext(): void {
    if (view.kind !== 'kitchen' || kitchen == null) return;
    const failing = firstProblem(kitchen);
    if (failing != null) {
      setKitchen({ ...kitchen, tried: true });
      focus(failing);
      return;
    }
    setKitchen({ ...kitchen, tried: false });
    afterKitchen(view.from, view.returns, kitchen);
  }

  function kitchenSkip(): void {
    if (view.kind !== 'kitchen' || kitchen == null) return;
    const left = skipped(kitchen, page);
    setKitchen(left);
    afterKitchen(view.from, view.returns, left);
  }

  function kitchenBack(): void {
    if (view.kind === 'kitchen' && view.returns != null) kitchenReturn(view.returns, view.from);
    else if (hasStep(party)) withYou();
    else back();
  }

  function kitchenAfter(): void {
    setKitchen(kitchenOf(page, party, null));
    setView({ kind: 'kitchenAfter', busy: false, failed: false });
    focus('kitchenHead');
  }

  /** Back and Leave it as it is put the record back; focus returns to the button that opened the step. */
  function kitchenAfterLeave(): void {
    if (view.kind !== 'kitchenAfter' || view.busy) return;
    setKitchen(null);
    setView({ kind: 'closed' });
    focus('kitchen');
  }

  function kitchenAfterSave(): void {
    if (view.kind !== 'kitchenAfter' || view.busy || kitchen == null) return;
    const failing = firstProblem(kitchen);
    if (failing != null) {
      setKitchen({ ...kitchen, tried: true });
      focus(failing);
      return;
    }
    const me = kitchen.people.find((one) => one.key === YOU);
    const { companions, unnamed } = placeNeeds(kitchen, page);
    setView({ kind: 'kitchenAfter', busy: true, failed: false });
    sends.current += 1;
    api.sendGuestNeeds(token, me == null ? null : needsOf(me), companions, unnamed).then(
      (next) => {
        seen.current = standing(next);
        setPage(next);
        setParty(partyOf(next));
        setKitchen(null);
        setKitchenSaved(true);
        setView({ kind: 'closed' });
        focus('kitchen');
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) setGone(true);
        else if (
          error instanceof ApiError &&
          (error.is('replies_closed') || REFUSED.some((code) => error.is(code)))
        )
          refuse();
        else {
          setKitchenSaved(false);
          setView({ kind: 'kitchenAfter', busy: false, failed: true });
          focus('kitchenRetry');
        }
      },
    );
  }

  function card(key: string, change: (one: Person) => Partial<Person>, on?: string): void {
    setKitchen((was) =>
      was == null
        ? was
        : {
            ...was,
            left: false,
            people: was.people.map((one) => (one.key === key ? { ...one, ...change(one) } : one)),
          },
    );
    if (on != null) focus(on);
  }

  /** Check and send's Back and its kitchen row's Change return to the kitchen step; its answer row's Change, to the answers. */
  function checkBack(): void {
    if (view.kind !== 'check') return;
    if (courses.length > 0 && eaters.length > 0)
      openMeal(eaters.length - 1, courses.length - 1, view.from, 'flow');
    else toKitchen(view.from);
  }

  function checkKitchen(): void {
    if (view.kind !== 'check') return;
    toKitchen(view.from, 'check');
  }

  function changeMeal(key: string): void {
    const at = eaters.findIndex((one) => key.startsWith(`${one.key}|`));
    const course = courses.findIndex((one) => key.endsWith(`|${one.id}`));
    if (at < 0 || course < 0) return;
    openMeal(
      at,
      course,
      view.kind === 'check' ? view.from : 'answer',
      view.kind === 'check' ? 'check' : 'saved',
    );
  }

  function back(): void {
    if (view.kind !== 'check' && view.kind !== 'withYou' && view.kind !== 'kitchen') return;
    setView(
      view.from === 'changing'
        ? { kind: 'changing', busy: null, failed: false }
        : { kind: 'answer', busy: null, note: null },
    );
    focus('row-coming');
  }

  function tellThem(): void {
    setTell({ kind: 'asking', busy: true, result: null });
    api.tellWrongPerson(token).then(
      () => {
        setTell({ kind: 'told' });
        focus('thanks');
      },
      (error: unknown) =>
        setTell({
          kind: 'asking',
          busy: false,
          result: error instanceof ApiError && error.is('too_many_attempts') ? 'limited' : 'failed',
        }),
    );
  }

  if (gone) return <InvalidInvitation />;

  const stepping =
    view.kind === 'meal' ||
    view.kind === 'check' ||
    view.kind === 'withYou' ||
    view.kind === 'kitchen' ||
    view.kind === 'kitchenAfter';
  const alone = tell.kind !== 'card' || stepping;
  const dayOrder = leads && tell.kind === 'card' && forTheDay(page, view);
  const saved = savedPlates(page.meals, eaters);
  const paused = page.phase === 'paused' && !page.started;
  const marked = markedOpen(meal.plates, eaters, courses, allergies).length;
  const cards = (head: 'check' | 'back') => (
    <MealCards
      eaters={eaters}
      courses={courses}
      plates={meal.plates}
      allergies={allergies}
      timeZone={event.timeZone}
      busy={meal.busy || (view.kind === 'check' && view.busy)}
      head={head}
      hosts={hosts}
      pending={(key) => head === 'back' && !samePlate(meal.plates[key], saved[key])}
      refused={meal.refused}
      unsaved={meal.unsaved}
      locked={head === 'back' && paused}
      lineOf={(eater, course, shut) =>
        defaultLine(page.meals, course, eater, meal.plates[keyOf(eater.key, course.id)], shut)
      }
      onChange={changeMeal}
    />
  );
  const mealScreen = (() => {
    if (view.kind !== 'meal') return null;
    const eater = eaters[view.eater];
    const course = courses[view.course];
    if (eater == null || course == null) return null;
    const steps = stepsOf(course, meal.draft);
    const step = steps[view.step] ?? steps[0];
    if (step == null) return null;

    return (
      <MealScreen
        eater={eater}
        course={course}
        n={view.course + 1}
        total={courses.length}
        step={step}
        first={view.step === 0}
        plate={meal.draft}
        allergies={allergies(eater.key)}
        other={view.course === 0 ? others(eater.key) : null}
        cleared={meal.cleared[keyOf(eater.key, course.id)] ?? null}
        refusal={meal.pressed ? refusalOf(step, meal.draft, view.step === 0) : null}
        timeZone={event.timeZone}
        line={defaultLine(
          page.meals,
          course,
          eater,
          meal.draft ?? meal.plates[keyOf(eater.key, course.id)],
          course.picksClose.closed,
        )}
        onPlate={(plate) => setMeal((was) => ({ ...was, draft: plate, pressed: false }))}
        onBack={mealBack}
        onNext={mealNext}
      />
    );
  })();
  const picksShut = courses.every((one) => one.picksClose.closed);
  const comingBack =
    courses.length > 0 &&
    guest.reply?.answer === 'coming' &&
    (page.answersOpen || picksShut || paused) ? (
      <MealsSaved
        told={meal.told}
        marked={marked}
        busy={meal.busy}
        savedUntil={paused ? null : oneCloseDay(courses, (at) => dayOf(at, event.timeZone))}
        kitchen={
          page.answersOpen || paused ? (
            <KitchenRow
              kitchen={kitchen ?? kitchenOf(page, partyOf(page), null)}
              busy={meal.busy}
              pending={kitchenPending}
              onKitchen={page.answersOpen && !picksShut ? savedKitchen : null}
            />
          ) : null
        }
        ending={paused ? 'none' : picksShut ? 'askHosts' : 'send'}
        hosts={hosts}
        onSend={sendChanges}
      >
        {cards('back')}
      </MealsSaved>
    ) : null;
  const checkMeals =
    courses.length > 0 ? (
      <>
        {cards('check')}
        {meal.told === 'marked' && marked > 0 && <MarkedLine count={marked} />}
      </>
    ) : null;
  const tagged = guest.reply != null && view.kind !== 'check';

  return (
    <div ref={columns} className="gp-columns">
      <PhaseNotice phase={page.phase} />
      {preview == null && <LanguageUnsaved token={token} />}
      <Cover
        page={page}
        tagged={tagged && !ended(page.phase)}
        dayOrder={dayOrder}
        band={dayOrder && phone}
      />
      {dayOrder && (
        <div className="gp-under is-day">
          {page.checkInCode != null && (
            <YourCode qrSvg={page.checkInCode.qrSvg} withCompanions={companionsComing(page)} />
          )}
          <WhereBlock page={page} when={when} />
          <YourTable page={page} onTheDay />
          <Programme page={page} onTheDay />
          <DayAnswer
            view={view}
            page={page}
            party={party}
            kitchenSaved={kitchenSaved}
            onChange={() => {
              setView({ kind: 'changing', busy: null, failed: false });
              focus('newHead');
            }}
            onKitchenAfter={kitchenAfter}
          />
          {comingBack}
          {page.calendar != null && <AddToCalendar calendar={page.calendar} />}
        </div>
      )}
      {!dayOrder && (
        <div className="gp-under">
          {tell.kind === 'card' && (
            <Shown
              view={view}
              page={page}
              party={party}
              kitchen={kitchen}
              preview={preview != null}
              onCard={card}
              onKitchenBack={kitchenBack}
              onKitchenNext={kitchenNext}
              onKitchenSkip={kitchenSkip}
              kitchenSaved={kitchenSaved}
              onKitchenAfter={kitchenAfter}
              onKitchenAfterLeave={kitchenAfterLeave}
              onKitchenAfterSave={kitchenAfterSave}
              onParty={(change, on) => {
                setParty(change);
                if (on != null) focus(on);
              }}
              onPartyNext={partyNext}
              onPartyChange={withYou}
              onCheckBack={checkBack}
              onCheckKitchen={checkKitchen}
              mealScreen={mealScreen}
              checkMeals={checkMeals}
              comingBack={comingBack}
              onChoose={choose}
              onSend={sendComing}
              onBack={back}
              onChange={() => {
                setView({ kind: 'changing', busy: null, failed: false });
                focus('newHead');
              }}
              onKeep={() => {
                setKitchen(null);
                setView({ kind: 'recorded', same: false });
                focus('change');
              }}
            />
          )}
          {tell.kind === 'card' && (view.kind === 'recorded' || view.kind === 'closed') && (
            <YourTable page={page} />
          )}
          {tell.kind === 'card' && forTheDay(page, view) && page.checkInCode != null && (
            <DoorCode qrSvg={page.checkInCode.qrSvg} withCompanions={companionsComing(page)} />
          )}
          {tell.kind === 'card' && forTheDay(page, view) && page.calendar != null && (
            <AddToCalendar calendar={page.calendar} />
          )}
          {tell.kind === 'asking' && (
            <section className="gp-tell" aria-labelledby="gp-tell-h">
              <h2 id="gp-tell-h" className="gp-h2" tabIndex={-1} data-focus="tellHead">
                {t('guest.tellQuestion', { hosts })}
              </h2>
              <p className="gp-sub">{t('guest.tellLine', { name: guest.fullName, count })}</p>
              {tell.result === 'failed' && <Notice kind="broken">{t('guest.tellFailed')}</Notice>}
              {tell.result === 'limited' && (
                <Notice kind="attention" alert>
                  {t('guest.tellLimited')}
                </Notice>
              )}
              <Filled busy={tell.busy} onClick={tellThem}>
                {t('guest.tellThem')}
              </Filled>
              <button
                className="gp-outlined"
                type="button"
                onClick={() => {
                  setTell({ kind: 'card' });
                  focus('tell');
                }}
              >
                {t('guest.goBack')}
              </button>
            </section>
          )}
          {tell.kind === 'told' && (
            <div className="gp-told" role="status" aria-live="polite">
              <span className="gp-mark is-coming" aria-hidden="true">
                <Glyph name="tick" size={17} weight={3} />
              </span>
              <p tabIndex={-1} data-focus="thanks">
                {t('guest.tellThanks', { hosts, count })}
              </p>
            </div>
          )}
        </div>
      )}
      {!alone && <Details page={page} hosts={hosts} dayOrder={dayOrder} />}
      {!alone && (
        <div className="gp-foot">
          {page.answersOpen && (
            <>
              <p>{t('guest.noAccountNeeded')}</p>
              <hr />
            </>
          )}
          <p>{t('guest.closing')}</p>
          <button
            className="gp-text"
            type="button"
            data-focus="tell"
            onClick={() => {
              setTell({ kind: 'asking', busy: false, result: null });
              focus('tellHead');
            }}
          >
            <span>{t('guest.tell', { name: guest.fullName })}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** For Coming, while there is still something to attend (pm, 7 Nov): the demo's forTheDay. */
function forTheDay(page: GuestPage, view: View): boolean {
  return (
    page.guest.reply?.answer === 'coming' &&
    page.phase === 'live' &&
    (view.kind === 'recorded' || view.kind === 'closed')
  );
}

/** sc-1439's recorded and closed views under Your answer on the day, without the place, which shows once, in Where (sc-24381). */
function DayAnswer({
  view,
  page,
  party,
  kitchenSaved,
  onChange,
  onKitchenAfter,
}: {
  view: View;
  page: GuestPage;
  party: Party;
  kitchenSaved: boolean;
  onChange: () => void;
  onKitchenAfter: () => void;
}) {
  const { t } = useTranslation();
  const { reply } = page.guest;

  if (reply == null) return null;
  const day = dayOf(reply.at, page.event.timeZone);
  const closed = view.kind === 'closed';
  const closedOn = page.started ? null : (page.answersClosedOn ?? null);

  return (
    <section className="gp-day-block" aria-labelledby="gp-day-answer-h">
      <h2 id="gp-day-answer-h" className="gp-h2">
        {t('guest.yourAnswer')}
      </h2>
      <p className="gp-day-answered" tabIndex={-1} data-focus={closed ? 'closedHead' : 'greeting'}>
        {reply.recordedBy == null
          ? t(ANSWERED[reply.answer], { date: day })
          : t('guest.recordedFor', { name: reply.recordedBy, date: day })}
      </p>
      {view.kind === 'recorded' && view.same && (
        <p className="gp-sub is-ink">{t('guest.same', { answer: t(WORD[reply.answer]) })}</p>
      )}
      {view.kind === 'recorded' && hasStep(party) && (
        <p className="gp-sub">{partyLine(partyOf(page), t)}</p>
      )}
      {closed && kitchenSaved && !page.started && <KitchenSaved />}
      {closed && (
        <p className="gp-sub">
          {closedOn == null
            ? t('guest.closed')
            : t('guest.closedBy', { date: wallDayOf(closedOn) })}
        </p>
      )}
      {!closed && (
        <TextAction focus="change" onClick={onChange}>
          {t('guest.change')}
        </TextAction>
      )}
      {closed && !page.started && (
        <TextAction
          focus="kitchen"
          {...(kitchenSaved ? { describedBy: KITCHEN_SAVED_ID } : {})}
          icon={
            <svg
              className="gp-line"
              width={18}
              height={18}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              strokeWidth={2.2}
            >
              <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
            </svg>
          }
          onClick={onKitchenAfter}
        >
          {t('guest.kitchen')}
        </TextAction>
      )}
    </section>
  );
}

/** A companion counts as coming unless the guest said they are not (sc-3779), named or not. */
function companionsComing(page: GuestPage): boolean {
  return [...page.guest.companions, ...page.guest.unnamed].some((one) => one.coming);
}

/** sc-1301: the code the door scans, black on white whatever the page's theme, with the instruction in words beside it. */
function DoorCode({ qrSvg, withCompanions }: { qrSvg: string; withCompanions: boolean }) {
  const { t } = useTranslation();

  return (
    <section className="gp-block" aria-labelledby="gp-door">
      <h2 id="gp-door" className="gp-h2 is-19">
        {t('guest.doorTitle')}
      </h2>
      <p className="gp-sub">{t(withCompanions ? 'guest.doorLine' : 'guest.doorLineAlone')}</p>
      <div className="gp-code">
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
          alt={t('guest.doorCode')}
          width={196}
          height={196}
        />
      </div>
    </section>
  );
}

/** sc-3627: one subscribed feed, offered to Apple and Outlook by webcal and to Google Calendar by URL. */
function AddToCalendar({ calendar }: { calendar: GuestCalendarLink }) {
  const { t } = useTranslation();
  const row = (name: string, href: string, outside: boolean) => (
    <a
      className="gp-row gp-cal"
      href={href}
      aria-describedby="gp-calendar-line"
      {...(outside ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span className="gp-lead">
        <Glyph name="calendar" size={22} />
      </span>
      <span className="gp-row-title">{name}</span>
      <span className="gp-out">
        <svg
          className="gp-line"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          strokeWidth={2}
        >
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
      </span>
    </a>
  );

  return (
    <section className="gp-block" aria-labelledby="gp-calendar">
      <h2 id="gp-calendar" className="gp-h2 is-19">
        {t('guest.calendarTitle')}
      </h2>
      <p id="gp-calendar-line" className="gp-sub">
        {t('guest.calendarLine')}
      </p>
      <div className="gp-cal-rows">
        {row(t('guest.calendarApple'), calendar.webcal, false)}
        {row(t('guest.calendarGoogle'), calendar.google, true)}
      </div>
    </section>
  );
}

function Shown({
  view,
  page,
  party,
  kitchen,
  preview,
  onCard,
  onKitchenBack,
  onKitchenNext,
  onKitchenSkip,
  kitchenSaved,
  onKitchenAfter,
  onKitchenAfterLeave,
  onKitchenAfterSave,
  onParty,
  onPartyNext,
  onPartyChange,
  onCheckBack,
  onCheckKitchen,
  mealScreen,
  checkMeals,
  comingBack,
  onChoose,
  onSend,
  onBack,
  onChange,
  onKeep,
}: {
  view: View;
  page: GuestPage;
  party: Party;
  kitchen: Kitchen | null;
  preview: boolean;
  onCard: (key: string, change: (one: Person) => Partial<Person>, focus?: string) => void;
  onKitchenBack: () => void;
  onKitchenNext: () => void;
  onKitchenSkip: () => void;
  kitchenSaved: boolean;
  onKitchenAfter: () => void;
  onKitchenAfterLeave: () => void;
  onKitchenAfterSave: () => void;
  onParty: (change: (was: Party) => Party, focus?: string) => void;
  onPartyNext: () => void;
  onPartyChange: () => void;
  onCheckBack: () => void;
  onCheckKitchen: () => void;
  mealScreen: ReactNode;
  checkMeals: ReactNode;
  comingBack: ReactNode;
  onChoose: (answer: GuestAnswer) => void;
  onSend: () => void;
  onBack: () => void;
  onChange: () => void;
  onKeep: () => void;
}) {
  const { t } = useTranslation();
  const now = useServerNow();
  const { reply, fullName } = page.guest;
  const day = reply == null ? '' : dayOf(reply.at, page.event.timeZone);
  const places = hasStep(party);
  const answerBy =
    page.answersClosedOn == null &&
    page.event.replyBy != null &&
    page.event.replyBy >= wallDay(now, page.event.timeZone)
      ? page.event.replyBy
      : null;

  switch (view.kind) {
    case 'answer':
      return (
        <section className="gp-ask" aria-labelledby="gp-answer-h">
          <h2 id="gp-answer-h" className="gp-h2">
            {t('guest.yourAnswer')}
          </h2>
          {answerBy != null && (
            <p className="gp-sub">{t('guest.replyBy', { date: wallDayOf(answerBy) })}</p>
          )}
          {view.note === 'unsent' && <Notice kind="attention">{t('guest.unsent')}</Notice>}
          {view.note === 'notSentTap' && <Notice kind="broken">{t('guest.notSentTap')}</Notice>}
          <AnswerRows busy={view.busy} onChoose={onChoose} />
        </section>
      );
    case 'withYou':
      return (
        <WithYou
          party={party}
          fullName={fullName}
          hosts={hostsLine(page.event.hosts, currentLocale())}
          oneHost={page.event.hosts.length <= 1}
          onChange={onParty}
          onBack={onBack}
          onNext={onPartyNext}
        />
      );
    case 'kitchen':
      if (kitchen == null) return null;

      return (
        <KitchenStep
          kitchen={kitchen}
          hosts={hostsLine(page.event.hosts, currentLocale())}
          hostCount={Math.max(page.event.hosts.length, 1)}
          timeZone={page.event.timeZone}
          onChange={onCard}
          onBack={preview && view.returns == null ? null : onKitchenBack}
          onNext={onKitchenNext}
          onSkip={onKitchenSkip}
        />
      );
    case 'meal':
      return mealScreen;
    case 'kitchenAfter':
      if (kitchen == null) return null;

      return (
        <KitchenStep
          kitchen={kitchen}
          hosts={hostsLine(page.event.hosts, currentLocale())}
          hostCount={Math.max(page.event.hosts.length, 1)}
          timeZone={page.event.timeZone}
          after={{ busy: view.busy, failed: view.failed }}
          onChange={onCard}
          onBack={onKitchenAfterLeave}
          onNext={onKitchenAfterSave}
          onSkip={onKitchenAfterLeave}
        />
      );
    case 'check':
      if (kitchen != null && view.refused !== true) {
        return (
          <KitchenCheck
            kitchen={kitchen}
            busy={view.busy}
            alert={
              view.unsaved === true
                ? t('guestKitchen.notSaved')
                : view.failed
                  ? t('guest.notSent')
                  : null
            }
            party={places ? { line: partyLine(party, t) } : null}
            onBack={onCheckBack}
            onAnswer={onBack}
            onParty={onPartyChange}
            onKitchen={onCheckKitchen}
            onSend={onSend}
            preview={preview}
          >
            {checkMeals}
          </KitchenCheck>
        );
      }

      return (
        <section className="gp-check" aria-labelledby="gp-check-h">
          {view.refused === true ? (
            <Notice kind="broken">{t('guest.refused')}</Notice>
          ) : (
            <TextAction
              ink
              icon={<Glyph name="back" size={18} weight={2.2} />}
              onClick={onCheckBack}
            >
              {t('guest.back')}
            </TextAction>
          )}
          <h2 id="gp-check-h" className="gp-h2 is-24" tabIndex={-1} data-focus="checkHead">
            {t('guest.check')}
          </h2>
          <div className="gp-row gp-check-row">
            <span className="gp-lead">
              <Mark answer="coming" />
            </span>
            <span className="gp-answer-words">
              {t('guest.answerLine', { answer: t(WORD.coming) })}
            </span>
            {view.refused !== true && (
              <TextAction onClick={onBack}>{t('guest.changeShort')}</TextAction>
            )}
          </div>
          {places && (
            <div className="gp-party-row">
              <div className="gp-party-words">
                <p className="gp-party-label">{t('guest.withYouRow')}</p>
                <p className="gp-party-value">{partyLine(party, t)}</p>
              </div>
              {view.refused !== true && (
                <TextAction off={view.busy} onClick={onPartyChange}>
                  <span className="visually-hidden">{t('guest.withYouChange')}</span>
                  <span aria-hidden="true">{t('guest.changeShort')}</span>
                </TextAction>
              )}
            </div>
          )}
          {view.failed && <Notice kind="broken">{t('guest.notSent')}</Notice>}
          {view.refused !== true && (
            <>
              <Filled busy={view.busy} focus="send" onClick={onSend}>
                {t('guest.send')}
              </Filled>
              <p className="gp-small">{t('guest.nothingSent')}</p>
            </>
          )}
        </section>
      );
    case 'recorded':
      if (reply == null) return null;

      return (
        <>
          <section className="gp-recorded" aria-labelledby="gp-greeting">
            <div className="gp-greet">
              <Mark answer={reply.answer} />
              <h2 id="gp-greeting" className="gp-h2" tabIndex={-1} data-focus="greeting">
                {reply.recordedBy == null
                  ? t(GREETING[reply.answer], { name: fullName })
                  : t(ANSWER_IS[reply.answer])}
              </h2>
            </div>
            <div className="gp-indent">
              {reply.recordedBy == null ? (
                <p className="gp-sub">{t(ANSWERED[reply.answer], { date: day })}</p>
              ) : (
                <p className="gp-sub is-recorded">
                  {t('guest.recordedFor', { name: reply.recordedBy, date: day })}
                </p>
              )}
              {view.same && (
                <p className="gp-sub is-ink">
                  {t('guest.same', { answer: t(WORD[reply.answer]) })}
                </p>
              )}
              {places && reply.answer === 'coming' && (
                <p className="gp-sub">{partyLine(partyOf(page), t)}</p>
              )}
              {places && reply.answer === 'notComing' && (
                <p className="gp-sub">{t('guest.companionsNotComing')}</p>
              )}
              {places && reply.answer === 'maybe' && (
                <p className="gp-sub">{t('guest.companionsOnHold')}</p>
              )}
              <TextAction focus="change" onClick={onChange}>
                {t('guest.change')}
              </TextAction>
            </div>
          </section>
          {reply.answer === 'coming' && comingBack}
        </>
      );
    case 'changing':
      return (
        <section className="gp-changing" aria-labelledby="gp-new-h">
          {reply != null && (
            <p className="gp-sub">
              {reply.recordedBy == null
                ? t(ANSWERED[reply.answer], { date: day })
                : t(ANSWER_IS[reply.answer])}
            </p>
          )}
          <h2 id="gp-new-h" className="gp-h2" tabIndex={-1} data-focus="newHead">
            {t('guest.newAnswer')}
          </h2>
          {view.failed && <Notice kind="broken">{t('guest.notSentTap')}</Notice>}
          <AnswerRows current={reply?.answer ?? null} busy={view.busy} onChoose={onChoose} />
          <TextAction focus="keep" onClick={onKeep}>
            {t('guest.keep')}
          </TextAction>
        </section>
      );
    case 'closed': {
      const said =
        reply == null
          ? t('guest.didNotAnswer')
          : reply.recordedBy != null
            ? t(ANSWER_IS[reply.answer])
            : t(ANSWERED[reply.answer], { date: day });

      if (page.phase === 'calledOff') return null;
      if (page.phase === 'finished') {
        return (
          <div className="gp-ended">
            {page.event.thankYou != null && (
              <Thanks
                line={page.event.thankYou}
                hosts={page.event.hosts}
                locale={currentLocale()}
              />
            )}
            <p className="gp-sub">{said}</p>
          </div>
        );
      }

      const closedOn = page.started ? null : (page.answersClosedOn ?? null);
      const closedLine =
        closedOn == null
          ? t('guest.closed')
          : t(
              reply == null || reply.answer === 'maybe'
                ? 'guest.closedByNotSure'
                : 'guest.closedBy',
              {
                date: wallDayOf(closedOn),
              },
            );
      const kitchenAfter = page.phase === 'live' && !page.started && reply?.answer === 'coming';

      return (
        <>
          <section
            className={page.phase === 'live' ? 'gp-closed is-live' : 'gp-closed'}
            aria-labelledby="gp-closed-h"
          >
            <h2 id="gp-closed-h" className="gp-h2 is-19" tabIndex={-1} data-focus="closedHead">
              {said}
            </h2>
            {page.phase === 'live' && reply?.recordedBy != null && (
              <p className="gp-sub is-recorded">
                {t('guest.recordedOn', { name: reply.recordedBy, date: day })}
              </p>
            )}
            {kitchenAfter && kitchenSaved && <KitchenSaved />}
            {page.phase === 'live' && <p className="gp-sub">{closedLine}</p>}
            {kitchenAfter && (
              <TextAction
                focus="kitchen"
                {...(kitchenSaved ? { describedBy: KITCHEN_SAVED_ID } : {})}
                icon={
                  <svg
                    className="gp-line"
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                    strokeWidth={2.2}
                  >
                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                  </svg>
                }
                onClick={onKitchenAfter}
              >
                {t('guest.kitchen')}
              </TextAction>
            )}
            {page.phase === 'paused' && !page.started && (
              <>
                <TextAction off focus="change" describedBy="gp-reason">
                  {t('guest.change')}
                </TextAction>
                <p id="gp-reason" className="gp-sub">
                  {t('guest.pausedReason')}
                </p>
              </>
            )}
          </section>
          {reply?.answer === 'coming' && comingBack}
        </>
      );
    }
  }
}

/** The three answers, full-width rows of 56: Yes leads on to Check and send; the other two record in one tap. */
function AnswerRows({
  current = null,
  busy,
  onChoose,
}: {
  current?: GuestAnswer | null;
  busy: GuestAnswer | null;
  onChoose: (answer: GuestAnswer) => void;
}) {
  const { t } = useTranslation();
  const changing = current != null;

  return (
    <div className="gp-answers">
      {GUEST_ANSWERS.map((answer) => (
        <button
          key={answer}
          className={`gp-answer${current === answer ? ' is-lit' : ''}`}
          type="button"
          data-focus={`row-${answer}`}
          aria-pressed={changing ? current === answer : undefined}
          aria-busy={busy === answer || undefined}
          {...offButton(busy != null, { dim: false })}
          onClick={() => onChoose(answer)}
        >
          <span className="gp-lead">
            {busy === answer ? (
              <span className="gp-spin" aria-hidden="true" />
            ) : (
              <Mark answer={answer} />
            )}
          </span>
          <span className="gp-answer-words">{t(CHOICE[answer])}</span>
          {current === answer ? (
            <span className="gp-now">
              <Glyph name="tick" size={14} weight={3} />
              {t('guest.answerNow')}
            </span>
          ) : (
            answer === 'coming' && (
              <span className="gp-chev" aria-hidden="true">
                <Glyph name="chevron" size={18} weight={2.2} />
              </span>
            )
          )}
        </button>
      ))}
    </div>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

function placeWords(t: Translate) {
  return {
    yourGuest: t('guestKitchen.yourGuest'),
    yourGuestN: (n: number) => t('guestKitchen.yourGuestN', { n }),
  };
}

function label(party: Party, one: PartyPerson, t: Translate): string {
  return labelOf(party, one, placeWords(t));
}

/** "You, Obi Okonkwo and Your guest 2 · 3 people": the guest and each place left Coming, named or not (sc-48740). */
function partyLine(party: Party, t: Translate): string {
  const names = [t('guest.withYouYou'), ...comingWith(party).map((one) => label(party, one, t))];

  return t('guest.withYouPeople', {
    names: listFormat(currentLocale(), { type: 'conjunction' }).format(names),
    count: names.length,
  });
}

/** sc-3779's Who's coming with you?, after Coming and before Check and send, as the guest demo draws it. */
function WithYou({
  party,
  fullName,
  hosts,
  oneHost,
  onChange,
  onBack,
  onNext,
}: {
  party: Party;
  fullName: string;
  hosts: string;
  oneHost: boolean;
  onChange: (change: (was: Party) => Party, focus?: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <section className="gp-with" aria-labelledby={`${id}-h`}>
      <TextAction ink icon={<Glyph name="back" size={18} weight={2.2} />} onClick={onBack}>
        {t('guest.back')}
      </TextAction>
      <h2 id={`${id}-h`} className="gp-h2 is-24" tabIndex={-1} data-focus="withYouHead">
        {t('guest.withYouTitle')}
      </h2>
      <p className="gp-sub">
        {t(oneHost ? 'guest.withYouPlacesByOne' : 'guest.withYouPlaces', {
          hosts,
          count: party.places,
        })}
      </p>
      <ul className="gp-with-rows">
        <li className="gp-with-row is-on">
          <span className="gp-with-words">
            <span className="gp-with-name">{fullName}</span>
            <span className="gp-with-sub">{t('guest.withYouThatsYou')}</span>
          </span>
          <span className="gp-with-tag">{t('guest.withYouSelfComing')}</span>
        </li>
        {party.people.map((one) => {
          const called = label(party, one, t);

          return (
            <li key={one.id} className={one.coming ? 'gp-with-row is-on' : 'gp-with-row'}>
              <span className="gp-with-words">
                {party.renaming === one.id ? (
                  <span className="gp-with-edit">
                    <label htmlFor={`${id}-rename`} className="gp-with-label">
                      {t('guest.withYouTheirName')}
                    </label>
                    <input
                      id={`${id}-rename`}
                      className="gp-with-input"
                      type="text"
                      value={party.draft}
                      autoComplete="off"
                      data-focus="renameField"
                      aria-invalid={party.tried}
                      onChange={(event) => {
                        const draft = event.target.value;
                        onChange((was) => ({ ...was, draft, tried: false }));
                      }}
                    />
                    <button
                      type="button"
                      className="gp-outlined"
                      onClick={() => onChange(renamed, `rename-${one.id}`)}
                    >
                      {party.tried ? t('guest.withYouTypeTheirName') : t('guest.withYouDone')}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="gp-with-name is-button"
                    aria-label={
                      one.name == null
                        ? t('guest.withYouAddName', { label: called })
                        : t('guest.withYouRename', { name: called })
                    }
                    data-focus={`rename-${one.id}`}
                    onClick={() => onChange((was) => renaming(was, one.id), 'renameField')}
                  >
                    <span>{called}</span>
                    <Pencil />
                  </button>
                )}
                <span className="gp-with-sub">
                  {one.name == null
                    ? t('guest.withYouNoName')
                    : one.byGuest
                      ? t('guest.withYouByYou')
                      : t('guest.withYouByInvitation')}
                </span>
              </span>
              <button
                type="button"
                className={one.coming ? 'gp-with-toggle is-on' : 'gp-with-toggle'}
                aria-pressed={one.coming}
                aria-label={t('guest.withYouIsComing', { name: called })}
                onClick={() => onChange((was) => toggled(was, one.id))}
              >
                {one.coming && <Glyph name="tick" size={16} weight={2.6} />}
                <span>{one.coming ? t('guest.withYouComing') : t('guest.withYouNotComing')}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="visually-hidden" role="status">
        {party.tried ? t('guest.withYouTypeTheirName') : null}
      </p>
      <Filled busy={false} focus="withYouNext" onClick={onNext}>
        {t('guest.withYouNext')}
      </Filled>
    </section>
  );
}

function Pencil() {
  return (
    <svg
      className="gp-line"
      width={15}
      height={15}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      strokeWidth={2.2}
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  );
}

/** The answer's mark (replyStates): a tick on a disc, a bar on a grey disc, a question in a ring; beside its words, so hidden. */
function Mark({
  answer,
  size = 28,
  cover = false,
}: {
  answer: GuestAnswer;
  size?: 20 | 28;
  cover?: boolean;
}) {
  return (
    <span
      className={`gp-mark is-${KEBAB[answer]} is-${size}${cover ? ' on-cover' : ''}`}
      aria-hidden="true"
    >
      {answer === 'coming' && <Glyph name="tick" size={Math.round(size * 0.6)} weight={3} />}
      {answer === 'notComing' && <span className="gp-bar" />}
      {answer === 'maybe' && '?'}
    </span>
  );
}

/** One notice at the top, in a status region mounted while Live so a pause is announced (WCAG 2.2 §4.1.3); its chip's shape tells it apart as well as its colour (§1.4.1). */
function PhaseNotice({ phase }: { phase: GuestPagePhase }) {
  return (
    <div className="gp-phase-live" role="status" aria-live="polite" aria-atomic="true">
      {phase !== 'live' && <PhaseWords phase={phase} />}
    </div>
  );
}

function PhaseWords({ phase }: { phase: Exclude<GuestPagePhase, 'live'> }) {
  const { t } = useTranslation();

  const paused = phase === 'paused';
  const chip = paused
    ? t('events.paused')
    : phase === 'calledOff'
      ? t('events.calledOff')
      : t('events.finished');
  const sentence = paused
    ? t('guest.pausedNotice')
    : phase === 'calledOff'
      ? t('guest.calledOffNotice')
      : t('guest.finishedNotice');

  return (
    <div className="gp-phase">
      <span className={`gp-chip is-${paused ? 'paused' : 'ended'}`}>
        <span className="gp-chip-mark" aria-hidden="true">
          {paused ? (
            <>
              <span />
              <span />
            </>
          ) : (
            <Glyph name="tick" size={9} weight={3.2} />
          )}
        </span>
        {chip}
      </span>
      <p>{sentence}</p>
    </div>
  );
}

/** The page switched, but the guest's record did not take the choice: said in the new language, as an alert, with Try again (sc-3790). */
function LanguageUnsaved({ token }: { token: string }) {
  const { t } = useTranslation();
  const { unsaved, saving } = useGuestLanguage();

  if (unsaved == null) return null;

  return (
    <div className="gp-notice is-attention gp-unsaved" role="alert">
      <span className="gp-notice-mark" aria-hidden="true" />
      <div className="gp-unsaved-words">
        <p>{t('guest.languageNotSaved')}</p>
        <TextAction off={saving} focus="saveAgain" onClick={() => void saveAgain(token)}>
          {saving ? t('session.retrying') : t('error.retry')}
        </TextAction>
      </div>
    </div>
  );
}

/** The start's time in the event's zone, naming the zone when the reader's browser is in another. */
function useWhen(event: GuestPage['event']): string {
  const { t } = useTranslation();
  const time = formatEventClock(event.startsAt, event.timeZone, dateLocale());

  return readerZone() === event.timeZone
    ? time
    : t('calendar.timeInZone', { time, timeZone: event.timeZone });
}

/** When, where and who, as Events A writes them, and the host's arrival note under the Where line, never translated. */
function Details({ page, hosts, dayOrder }: { page: GuestPage; hosts: string; dayOrder: boolean }) {
  const { t } = useTranslation();
  const { event } = page;
  const when = useWhen(event);
  const name = event.venue?.name ?? null;
  const address = event.venue?.address ?? null;
  const where = name != null || address != null;
  const named = event.hosts.length > 0 && page.phase !== 'calledOff';
  const note = page.phase === 'live' ? event.arrivalNote : null;
  const noteLine = note != null && (
    <p className="gp-note" dir="auto">
      {note}
    </p>
  );
  const hostsRow = named && (
    <Row lead={<Glyph name="users" size={22} />} title={hosts} line={t('eventHosts.heading')} />
  );

  if (dayOrder)
    return hostsRow === false ? null : <div className="gp-details gp-left-after">{hostsRow}</div>;

  return (
    <div className="gp-details gp-left-after">
      <Row
        lead={<Glyph name="calendar" size={22} />}
        title={format(event.startsAt, event.timeZone, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
        line={when}
      />
      {where && (
        <div className={named ? 'gp-where has-rule' : 'gp-where'}>
          <Row
            lead={<Glyph name="pin" size={22} />}
            title={name ?? address}
            line={name == null ? null : address}
          />
          {address != null && (
            <a
              className="gp-text gp-maps"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Glyph name="map" weight={2.2} />
              <span>{t('eventPage.openInMaps')}</span>
            </a>
          )}
          {noteLine}
        </div>
      )}
      {!where && noteLine !== false && (
        <div className={named ? 'gp-where has-rule' : 'gp-where'}>{noteLine}</div>
      )}
      {hostsRow}
      <Programme page={page} />
    </div>
  );
}

function Row({ lead, title, line }: { lead: ReactNode; title: ReactNode; line?: ReactNode }) {
  return (
    <div className="gp-row">
      <span className="gp-lead">{lead}</span>
      <span className="gp-row-words">
        <span className="gp-row-title">{title}</span>
        {line != null && <span className="gp-row-line">{line}</span>}
      </span>
    </div>
  );
}

/** The cover the event's page shows: the organiser's photo, or its colour from meshFor, under the scrim; the answer as a tag once given. */
function Cover({
  page,
  tagged,
  dayOrder,
  band,
}: {
  page: GuestPage;
  tagged: boolean;
  dayOrder: boolean;
  band: boolean;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const { event, guest } = page;
  const over = ended(page.phase);
  const photo = event.cover != null && !failed ? event.cover : null;
  const when = useWhen(event);
  const line = [
    format(event.startsAt, event.timeZone, { weekday: 'short', month: 'short', day: 'numeric' }),
    dayOrder && hasWhere(placeOf(page)) ? null : when,
    dayOrder ? null : event.venue?.name,
  ]
    .filter((part) => part != null)
    .join(' · ');
  const look = `today-cover ${photo == null ? `is-${meshFor(event.id)}` : 'is-photo'}`;
  const head = over ? (
    <h1 id="gp-h1" className="gp-cover-name" tabIndex={-1} data-focus="h1">
      {event.name}
    </h1>
  ) : (
    <>
      <h1 id="gp-h1" className="gp-cover-h1" tabIndex={-1} data-focus="h1">
        {t('guest.invitationTitle')}
      </h1>
      <p className="gp-cover-guest">{guest.fullName}</p>
      <p className="gp-cover-name">{event.name}</p>
    </>
  );

  if (band) {
    return (
      <>
        <span className={`gp-band gp-left ev-card ${look}`} aria-hidden="true">
          {photo != null && <Photo cover={photo} onFail={() => setFailed(true)} />}
          <span className="ev-scrim" />
        </span>
        <section className="gp-head" aria-labelledby="gp-h1">
          {head}
          <p className="gp-cover-line">{line}</p>
        </section>
      </>
    );
  }

  return (
    <section
      className={`gp-cover gp-left ev-card ${look}${page.phase === 'calledOff' ? ' is-grey' : ''}`}
      aria-labelledby="gp-h1"
    >
      {photo != null && <Photo cover={photo} onFail={() => setFailed(true)} />}
      <span className="ev-scrim" aria-hidden="true" />
      {photo == null &&
        PIECES.map((piece) => (
          <span key={piece} className={`gp-piece p${piece}`} aria-hidden="true" />
        ))}
      <div className={tagged ? 'gp-cover-inner has-tag' : 'gp-cover-inner'}>
        {tagged && guest.reply != null && (
          <p className="gp-tag">
            <Mark answer={guest.reply.answer} size={20} cover />
            {t(WORD[guest.reply.answer])}
          </p>
        )}
        {head}
        <p className="gp-cover-line">{line}</p>
      </div>
    </section>
  );
}

/** Its description is its text alternative; one without is decorative (WCAG 2.2 §1.1.1). */
function Photo({ cover, onFail }: { cover: EventCover; onFail: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const { position } = cover;

  // Through the CSSOM: the CSP has no 'unsafe-inline', which governs a style attribute too.
  useLayoutEffect(() => {
    if (image.current != null) image.current.style.objectPosition = `50% ${position}%`;
  }, [position]);

  return (
    <img
      ref={image}
      className="ev-photo"
      src={cover.sizes[0]?.url}
      srcSet={
        cover.sizes.length > 1
          ? cover.sizes.map(({ width, url }) => `${url} ${width}w`).join(', ')
          : undefined
      }
      sizes={cover.sizes.length > 1 ? '(min-width: 64rem) 560px, 100vw' : undefined}
      alt={cover.description ?? ''}
      draggable={false}
      onError={onFail}
    />
  );
}
