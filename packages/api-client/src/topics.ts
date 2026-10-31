/** Generated from the API's App\Enum\RealtimeTopic by `npm run generate:topics`: never edit it. */
export const REALTIME_TOPICS = {
  UserNotifications: 'users/{id}/notifications',
} as const;

export type RealtimeTopicName = keyof typeof REALTIME_TOPICS;

export function realtimeTopic(name: RealtimeTopicName, id: string): string {
  return REALTIME_TOPICS[name].replace('{id}', id);
}
