import { type Access, type ShiftStation } from '../station/wayIn.ts';

/** sc-4002: who opens the floor, by a level (personal link, job or join code) or a role. */
const OPENS: readonly Access[] = [
  'Can work the floor',
  'Can run the floor',
  'Owner',
  'Admin',
  'Lead',
  'Can edit',
];

export function opensFloor(access: Access): boolean {
  return OPENS.includes(access);
}

export const FL = {
  title: 'Floor',
  open: 'Open Floor',
  allTables: 'All tables',
  noSection: 'No section yet',
  label: (line: string) => `Floor, ${line}`,
} as const;

export interface OnFloor {
  /** The person's own sections, in section order (sc-3910, sc-36034's As well). */
  sections: readonly string[];
  /** service.manage on no section reads every table. */
  manages: boolean;
  /** The latest fired course, null before any is fired. */
  course: string | null;
}

/** The row's one line (sc-98893): their sections as a CLDR list, All tables, or No section yet. */
export function floorLine(on: OnFloor, locale: string): string {
  if (on.sections.length === 0 && !on.manages) return FL.noSection;

  const where =
    on.sections.length === 0
      ? FL.allTables
      : new Intl.ListFormat(locale, { type: 'conjunction' }).format(on.sections);

  return on.course == null ? where : `${where} · ${on.course}`;
}

/** Open Floor on Your night: a section station and access that opens the floor, in the app and in a browser. */
export function openFloorButton(station: ShiftStation, access: Access): string | null {
  return station?.kind === 'section' && opensFloor(access) ? FL.open : null;
}
