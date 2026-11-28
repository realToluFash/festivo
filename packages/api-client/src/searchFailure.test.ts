import { describe, expect, it } from 'vitest';

import { ApiError, ApiUnreachableError } from './problem.ts';
import { searchFailure } from './searchFailure.ts';

const problem = (status: number) => new ApiError({ type: 'about:blank', title: '', status });

describe('a failed search (sc-39534)', () => {
  it('is offline only when the API cannot be reached', () => {
    expect(searchFailure(new ApiUnreachableError())).toBe('offline');
  });

  it('is a failure on a working connection for a server fault or an unreadable reply', () => {
    expect(searchFailure(problem(500))).toBe('failed');
    expect(searchFailure(new Error('Unexpected /search reply'))).toBe('failed');
  });

  it('is a refusal, shown as no match, for a 403', () => {
    expect(searchFailure(problem(403))).toBe('refused');
  });
});
