import type { ListState } from '../events/EventsModel.ts';

export const WAY_IN_STATES = [
  'eventsEnterprise',
  'eventsFree',
  'eventsFirstRun',
  'eventsLoading',
  'eventsFailed',
  'wayInOffline',
  'eventsSearch',
  'wayInFr',
  'wayInEs',
  'wayInPt',
  'enquiriesBack',
] as const;
export type WayInState = (typeof WAY_IN_STATES)[number];

export function wayInStateOf(value: string | undefined | null): WayInState | null {
  return WAY_IN_STATES.find((state) => state === value) ?? null;
}

export interface WayIn {
  list: ListState | null;
  enterprise: boolean;
  language: 'en' | 'es' | 'fr' | 'pt';
  opensEnquiries: boolean;
}

const LIST_OF: Record<WayInState, ListState | null> = {
  eventsEnterprise: null,
  eventsFree: null,
  eventsFirstRun: 'first',
  eventsLoading: 'loading',
  eventsFailed: 'failed',
  wayInOffline: 'offline',
  eventsSearch: 'search',
  wayInFr: null,
  wayInEs: null,
  wayInPt: null,
  enquiriesBack: null,
};

const LANGUAGE_OF: Partial<Record<WayInState, WayIn['language']>> = {
  wayInEs: 'es',
  wayInFr: 'fr',
  wayInPt: 'pt',
};

/** Every way-in state is on Enterprise but Free, which shows Events as it is today. */
export function wayInOf(state: WayInState): WayIn {
  return {
    list: LIST_OF[state],
    enterprise: state !== 'eventsFree',
    language: LANGUAGE_OF[state] ?? 'en',
    opensEnquiries: state === 'enquiriesBack',
  };
}

export const WAY_IN_WORDS: Record<WayIn['language'], string> = {
  en: 'Enquiries',
  es: 'Consultas',
  fr: 'Demandes',
  pt: 'Pedidos',
};
