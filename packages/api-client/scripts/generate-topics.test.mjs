import { describe, expect, it } from 'vitest';

import { render } from './generate-topics.mjs';

describe('the generated topics', () => {
  it('declare each of the API topics under its own name', () => {
    expect(render({ UserNotifications: 'users/{id}/notifications' })).toContain(
      "  UserNotifications: 'users/{id}/notifications',\n",
    );
  });
});
