export interface CalendarHeaderBoard {
  title: string;
  what: string;
  href: string;
}

const SIZES = [
  ['ax1', 'AX1'],
  ['ax5', 'AX5'],
] as const;
const LANGUAGES = [
  ['en', 'English', 'Subscribe in your calendar app'],
  ['es', 'Spanish', 'Suscribirse en su aplicación de calendario'],
] as const;

/** sc-79265's pairs: the iPad header at AX1 and AX5, English and Spanish, with and without Refreshing…; upright and on its side by turning the iPad. */
export const CALENDAR_HEADER_BOARDS: readonly CalendarHeaderBoard[] = [
  {
    title: 'Calendar header · default size · English',
    what: 'As on main: Subscribe ends the title’s row',
    href: '/demo/calendar-header?size=default&lang=en',
  },
  {
    title: 'Calendar header · default size · Spanish',
    what: 'As on main',
    href: '/demo/calendar-header?size=default&lang=es',
  },
  ...SIZES.flatMap(([size, sizeLabel]) =>
    LANGUAGES.flatMap(([lang, langLabel, label]) =>
      (['off', 'on'] as const).map((refreshing) => ({
        title: `Calendar header · ${sizeLabel} · ${langLabel}${refreshing === 'on' ? ' · Refreshing…' : ''}`,
        what:
          refreshing === 'on'
            ? 'Refreshing… just before Subscribe, on the row under the title'
            : `${label} on its own row under the title, every word whole`,
        href: `/demo/calendar-header?size=${size}&lang=${lang}&refreshing=${refreshing}`,
      })),
    ),
  ),
];
