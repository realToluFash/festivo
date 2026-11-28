import { type Href, router } from 'expo-router';

import { eventHref } from './EventsModel.ts';

export function openEvent(id: string, query?: Readonly<Record<string, string>>): void {
  router.push(eventHref(id, query) as Href);
}
