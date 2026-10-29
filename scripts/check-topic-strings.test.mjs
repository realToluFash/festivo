import { describe, expect, it } from 'vitest';

import { declaredTemplates, strayTopics } from './check-topic-strings.mjs';

const generated = `export const REALTIME_TOPICS = {
  UserNotifications: 'users/{id}/notifications',
  EventMessages: 'events/{id}/messages',
} as const;`;

const file = (contents) => [{ path: 'apps/web/src/x.ts', contents }];

describe('a topic written outside the generated copy', () => {
  it('reads the templates the generated copy declares', () => {
    expect(declaredTemplates(generated)).toEqual([
      'users/{id}/notifications',
      'events/{id}/messages',
    ]);
  });

  it.each([
    ['a literal id', "const topic = 'users/0199d4a2/notifications';"],
    ['an interpolated id', 'const topic = `users/${user.id}/notifications`;'],
    ['the template itself', "subscribe('events/{id}/messages');"],
  ])('is refused with %s', (_name, contents) => {
    expect(strayTopics(declaredTemplates(generated), file(contents))).toEqual([
      `apps/web/src/x.ts:1: ${contents}`,
    ]);
  });

  it.each([
    ['the generated builder', "realtimeTopic('UserNotifications', user.id);"],
    ['an API path that shares a word', "client.get('/api/users/me/notification-settings');"],
    ['a route with a different end', "navigate('/users/42/profile');"],
  ])('is not %s', (_name, contents) => {
    expect(strayTopics(declaredTemplates(generated), file(contents))).toEqual([]);
  });
});
