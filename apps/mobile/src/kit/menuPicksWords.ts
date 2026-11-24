import type {
  EventMenu,
  EventPicks,
  PicksCourse,
  PicksExcluded,
  PicksHostLine,
  PicksRoomPerson,
} from '@soirely/api-client';
import {
  against,
  defaultPick,
  defaultedOn,
  excludedOf,
  formatTimeOfDay,
  listFormat,
  menuClose,
  menuCloseFrom,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

/** Allergens inside a sentence: each name lower-cased in the shown language, joined as it lists. */
export function allergensInSentence(
  t: TFunction,
  language: string,
  codes: readonly string[],
): string {
  return listFormat(language, { type: 'conjunction' }).format(
    codes.map((code) => t(`guestNeeds.allergen.${code}`).toLocaleLowerCase(language)),
  );
}

/** "Wednesday, 26 May": a close's day in the event's zone. */
export function closeDay(at: string, timeZone: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(at));
}

/** The header's close as sc-3905 has it: "from" while the open courses differ, "closed on" once all have closed; null while no course asks guests anything. */
export function headerClose(
  t: TFunction,
  menu: EventMenu,
  timeZone: string,
  language: string,
): string | null {
  const close = menuClose(menu.courses);
  if (close == null) return null;
  const date = closeDay(close.at, timeZone, language);
  if (close.closed) return t('menuPicks.closeAll', { date });

  return t(menuCloseFrom(menu.courses) ? 'menuPicks.closeFrom' : 'menuPicks.closeOne', { date });
}

/** The counts' freshness, in the device's zone as the offline band above it is; the event's zone is for times the event sets (sc-89448). */
export function freshLine(t: TFunction, updatedAt: string, stale: boolean, locale: string): string {
  const at = formatTimeOfDay(updatedAt, locale);

  return t(stale ? 'menuPicks.stale' : 'menuPicks.live', { at });
}

/** Under a course with a default: what it is and when it is given, or, once given, to how many. */
export function defaultLine(
  t: TFunction,
  menu: EventMenu,
  course: PicksCourse,
  language: string,
): string | null {
  if (course.default == null) return null;
  const pick = defaultPick(menu, { course: course.id, ...course.default });
  if (pick === '') return null;
  const date = closeDay(`${course.default.chooseBy}T12:00:00Z`, 'UTC', language);
  if (!course.closed) return t('menuPicks.defaultLine', { pick, date });
  const count = defaultedOn(course);

  return count === 0
    ? t('menuPicks.defaultLineNobody', { pick, date })
    : t('menuPicks.defaultLineGiven', { pick, date, count });
}

/** A course a person is never given the default on, with why: "Main course · allergy", "· Other diet", or the unmet diet by name. */
export function excludedOn(
  t: TFunction,
  course: string,
  excluded: Pick<PicksExcluded, 'reason'>,
): string {
  const kind = excludedOf(excluded.reason);
  if (kind === 'allergy') return t('menuPicks.excludedAllergy', { course });
  const diet =
    kind === 'other' ? t('menuPicks.otherDiet') : t(`guestNeeds.dietName.${excluded.reason}`);

  return t('menuPicks.excludedDiet', { course, diet });
}

/** "Not chosen: Main course · Vegetarian and Dessert": a waiting person's courses, each never-given one with its reason. */
export function openWords(
  t: TFunction,
  language: string,
  person: { courses: readonly string[]; excluded: readonly PicksExcluded[] },
  courseName: (id: string) => string,
): string {
  return t('menuPicks.notChosenOn', {
    courses: listFormat(language, { type: 'conjunction' }).format(
      person.courses.map((id) => {
        const excluded = person.excluded.find((one) => one.course === id);

        return excluded == null ? courseName(id) : excludedOn(t, courseName(id), excluded);
      }),
    ),
  });
}

/** What the screen offers (sc-3909): Choose for them and Choose who gets it with guests.manage, names with guests.read, else counts alone. */
export function picksAccess(
  picks: Pick<EventPicks, 'canChoose' | 'people'>,
): 'manage' | 'read' | 'counts' {
  if (picks.people == null) return 'counts';

  return picks.canChoose ? 'manage' : 'read';
}

/** What a save on Choose who gets it changes: who newly given it it rules out, asked about first, and who had it and goes back. */
export function whoChanges(
  row: { holders: readonly string[] | null; allergens: readonly string[] | null },
  ticked: ReadonlySet<string>,
  people: readonly PicksRoomPerson[],
): { ruled: PicksRoomPerson[]; leaving: string[] } {
  const holders = row.holders ?? [];

  return {
    ruled: people.filter(
      (one) =>
        ticked.has(one.id) &&
        !holders.includes(one.id) &&
        against(row.allergens, one.allergens).length > 0,
    ),
    leaving: holders.filter((id) => !ticked.has(id)),
  };
}

type InSentence = (codes: readonly string[]) => string;

/** A plate never stated is ruled out (sc-3907) and never said to contain anything (sc-87421). */
export function ruledOutWords(
  t: TFunction,
  allergens: InSentence,
  ruled: readonly string[],
  plate: readonly string[] | null,
  who: string,
): string | null {
  if (ruled.length === 0) return null;

  return plate == null
    ? t('menuPicks.ruledOutNotStated')
    : t('menuPicks.ruledOut', { allergens: allergens(ruled), name: who });
}

export function overrideBody(
  t: TFunction,
  allergens: InSentence,
  dish: string,
  asking: readonly string[],
  plate: readonly string[] | null,
  who: string,
): string {
  return plate == null
    ? t('menuPicks.overrideBodyNotStated', { dish, name: who })
    : t('menuPicks.overrideBody', { dish, allergens: allergens(asking), name: who });
}

export function savedOverride(
  t: TFunction,
  allergens: InSentence,
  dish: string,
  ruled: readonly string[],
  plate: readonly string[] | null,
  who: string,
): string {
  return plate == null
    ? t('menuPicks.savedOverrideNotStated', { name: who, dish })
    : t('menuPicks.savedOverride', { name: who, dish, allergens: allergens(ruled) });
}

export function hostLine(
  t: TFunction,
  allergens: InSentence,
  line: PicksHostLine,
  course: string,
): string {
  if (line.reason === 'nothing') return t('menuPicks.nothingFor', { course });

  return t(line.notStated ? 'menuPicks.allergyForNotStated' : 'menuPicks.allergyFor', {
    course,
    dish: line.pick ?? '',
    allergens: allergens(line.allergens),
  });
}
