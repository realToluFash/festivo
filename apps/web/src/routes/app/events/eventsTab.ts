export const TABS = ['upcoming', 'drafts', 'past'] as const;

export type Tab = (typeof TABS)[number];

let chosen: { organisationId: string; tab: Tab } | null = null;

/** Kept while the person moves around the app and back; another organisation opens on Upcoming (sc-3594). */
export function rememberedTab(organisationId: string): Tab {
  return chosen?.organisationId === organisationId ? chosen.tab : 'upcoming';
}

export function rememberTab(organisationId: string, tab: Tab): void {
  chosen = { organisationId, tab };
}

export function forgetEventsTab(): void {
  chosen = null;
}
