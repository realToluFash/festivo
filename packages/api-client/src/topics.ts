/** Generated from the API's App\Enum\RealtimeTopic by `npm run generate:topics`: never edit it. */
export const REALTIME_TOPICS = {
  UserNotifications: 'users/{id}/notifications',
  EventSeating: 'events/{id}/seating',
  EventSeatingChoices: 'events/{id}/seating/choices',
  EventGuests: 'events/{id}/guests',
  EventHeadcount: 'events/{id}/headcount',
  EventCheckIn: 'events/{id}/check-in',
  EventStaff: 'events/{id}/staff',
  EventWhosHere: 'events/{id}/whos-here',
  EventSchedule: 'events/{id}/schedule',
  EventMenu: 'events/{id}/menu',
  EventService: 'events/{id}/service',
  EventScreens: 'events/{id}/screens',
  EventGuestPages: 'events/{id}/guest-pages',
  EventMessages: 'events/{id}/messages',
  EventBudget: 'events/{id}/budget',
  EventBudgetMargin: 'events/{id}/budget/margin',
  EventQuotes: 'events/{id}/budget/quotes',
  OrganisationUsage: 'orgs/{id}/usage',
} as const;

export type RealtimeTopicName = keyof typeof REALTIME_TOPICS;

export function realtimeTopic(name: RealtimeTopicName, id: string): string {
  return REALTIME_TOPICS[name].replace('{id}', id);
}
