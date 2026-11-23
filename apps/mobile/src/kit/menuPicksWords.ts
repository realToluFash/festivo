import type {
  EventMenu,
  EventPicks,
  PicksCourse,
  PicksExcluded,
  PicksRoomPerson,
} from '@soirely/api-client';
import {
  against,
  defaultPick,
  defaultedOn,
  excludedOf,
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
  row: { holders: readonly string[] | null; allergens: readonly string[] },
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
