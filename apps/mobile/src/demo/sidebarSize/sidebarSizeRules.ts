export type SidebarSize =
  'device' | 'default' | 'eighth' | 'ninth' | 'tenth' | 'eleventh' | 'twelfth';
export type SidebarLanguage = 'en' | 'es' | 'fr';
export type SidebarAt = 'today' | 'events' | 'calendar' | 'members' | 'event';
export type SidebarOrg = 'ire' | 'qa';
export type SidebarWaiting = 'none' | 'one' | 'two';

export const SIDEBAR_SIZES: readonly { key: SidebarSize; label: string }[] = [
  { key: 'device', label: 'This iPad' },
  { key: 'default', label: 'Default' },
  { key: 'eighth', label: 'Eighth step (AX1)' },
  { key: 'ninth', label: 'Ninth step (AX2)' },
  { key: 'tenth', label: 'Tenth step (AX3)' },
  { key: 'eleventh', label: 'Eleventh step (AX4)' },
  { key: 'twelfth', label: 'Twelfth step (AX5)' },
];

export const SIDEBAR_LANGUAGES: readonly { key: SidebarLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Spanish' },
  { key: 'fr', label: 'French' },
];

export const SIDEBAR_PLACES: readonly { key: SidebarAt; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'events', label: 'Events' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'members', label: 'Settings › Members' },
  { key: 'event', label: 'An event' },
];

// Ire Events fits the pill at main's size at the eighth step, so the board needs a longer name there to show one stepped down (sc-72307).
export const SIDEBAR_ORGS: readonly { key: SidebarOrg; label: string }[] = [
  { key: 'ire', label: 'Ire Events' },
  { key: 'qa', label: 'QA Organisation' },
];

export const SIDEBAR_WAITING: readonly { key: SidebarWaiting; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'one', label: 'One' },
  { key: 'two', label: 'Two' },
];

// React Native's fontScale on iOS at each step, so the board draws what the app draws.
const SCALES: Readonly<Record<Exclude<SidebarSize, 'device'>, number>> = {
  default: 1,
  eighth: 1.786,
  ninth: 2.143,
  tenth: 2.643,
  eleventh: 3.143,
  twelfth: 3.571,
};

export function sidebarScale(size: SidebarSize, deviceScale: number): number {
  return size === 'device' ? deviceScale : SCALES[size];
}

export function sidebarSizeOf(name: string | undefined): SidebarSize {
  return SIDEBAR_SIZES.find((size) => size.key === name)?.key ?? 'device';
}

export function sidebarLanguageOf(name: string | undefined): SidebarLanguage {
  return SIDEBAR_LANGUAGES.find((language) => language.key === name)?.key ?? 'en';
}

export function sidebarAtOf(name: string | undefined): SidebarAt {
  return SIDEBAR_PLACES.find((place) => place.key === name)?.key ?? 'members';
}

export function sidebarOrgOf(name: string | undefined): SidebarOrg {
  return SIDEBAR_ORGS.find((org) => org.key === name)?.key ?? 'ire';
}

export function sidebarOrgName(org: SidebarOrg): string {
  return SIDEBAR_ORGS.find((one) => one.key === org)?.label ?? 'Ire Events';
}

export function sidebarWaitingOf(name: string | undefined): SidebarWaiting {
  return SIDEBAR_WAITING.find((waiting) => waiting.key === name)?.key ?? 'none';
}
