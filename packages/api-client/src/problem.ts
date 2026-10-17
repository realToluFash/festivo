/**
 * An error from the API, as both clients see it.
 *
 * The API answers failures as RFC 7807 problem documents. A client that reads
 * the HTTP status alone cannot tell two different 409s apart; the `type` is the
 * stable identifier it should branch on.
 */

export const ERROR_TYPE_PREFIX = 'https://soirely.com/errors/';

export interface Violation {
  propertyPath: string;
  message: string;
  code: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  violations?: Violation[];
  /** On a 429 that names its instant for the reader, such as "Sunday, Oct 18 at 17:09 WAT". */
  retryAt?: string;
  /** On a refused two-factor code after the first factor passed: send it back with the next code instead. */
  pendingProof?: string;
}

/**
 * The error every call rejects with.
 *
 * Carries the whole problem document, so a caller can branch on the code, show
 * the title, mark the offending fields, and quote the correlation id into a
 * support ticket — without reaching back into the response.
 */
export class ApiError extends Error {
  constructor(
    readonly problem: Problem,
    readonly response?: Response,
  ) {
    super(problem.title || `Request failed with ${problem.status}`);
    this.name = 'ApiError';
  }

  /** The bare code — `not_found` rather than the whole URI. */
  get code(): string {
    return this.problem.type.startsWith(ERROR_TYPE_PREFIX)
      ? this.problem.type.slice(ERROR_TYPE_PREFIX.length)
      : this.problem.type;
  }

  get status(): number {
    return this.problem.status;
  }

  get correlationId(): string | undefined {
    return this.problem.correlationId;
  }

  is(code: string): boolean {
    return this.code === code;
  }

  /** Violations keyed by field, for marking inputs in a form. */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const violation of this.problem.violations ?? []) {
      // First violation per field wins. An input carrying four stacked
      // messages is not more helpful than one carrying its first.
      errors[violation.propertyPath] ??= violation.message;
    }

    return errors;
  }
}

/** No answer at all, or a gateway with nothing behind it. Not a refusal, so never a sign-out. */
export class ApiUnreachableError extends Error {
  constructor(cause?: unknown) {
    super('The API could not be reached.', { cause });
    this.name = 'ApiUnreachableError';
  }
}

/**
 * Read a problem document out of a failed response.
 *
 * Falls back to a synthesised one rather than throwing, because the cases where
 * a body is not a problem document — a proxy returning HTML, a connection cut
 * mid-response — are exactly when a caller most needs a usable error rather
 * than a parse failure.
 */
export async function toProblem(response: Response): Promise<Problem> {
  try {
    const body = (await response.json()) as Partial<Problem>;

    if (typeof body?.type === 'string' && typeof body?.status === 'number') {
      return body as Problem;
    }
  } catch {
    // Not JSON, or truncated. Fall through.
  }

  return {
    type: `${ERROR_TYPE_PREFIX}${response.status >= 500 ? 'internal_error' : 'bad_request'}`,
    title: response.statusText || 'The request failed.',
    status: response.status,
  };
}
