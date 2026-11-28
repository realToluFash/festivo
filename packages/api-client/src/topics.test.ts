import { describe, expect, it } from 'vitest';

import { realtimeTopic } from './topics.ts';

describe('realtimeTopic', () => {
  it("names one member's notifications", () => {
    expect(realtimeTopic('UserNotifications', '0199d4a2-7b1e')).toBe(
      'users/0199d4a2-7b1e/notifications',
    );
  });
});
