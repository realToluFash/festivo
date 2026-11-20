/** Generated from the API's App\Enum\RealtimeTopic by `npm run generate:topics`: never edit it. */
export const REALTIME_TOPICS = {
  UserNotifications: 'users/{id}/notifications',
  EventSeating: 'events/{id}/seating',
  EventSeatingChoices: 'events/{id}/seating/choices',
  EventGuests: 'events/{id}/guests',
  EventHeadcount: 'events/{id}/headcount',
  EventStaff: 'events/{id}/staff',
  EventSchedule: 'events/{id}/schedule',
  EventMenu: 'events/{id}/menu',
  EventScreens: 'events/{id}/screens',
  EventGuestPages: 'events/{id}/guest-pages',
  EventBudget: 'events/{id}/budget',
  EventBudgetMargin: 'events/{id}/budget/margin',
  EventQuotes: 'events/{id}/budget/quotes',
} as const;

export type RealtimeTopicName = keyof typeof REALTIME_TOPICS;

export function realtimeTopic(name: RealtimeTopicName, id: string): string {
  return REALTIME_TOPICS[name].replace('{id}', id);
}
