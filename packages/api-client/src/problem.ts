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
  /** On `team_seats_in_use`: how many team seats the plan has. On `plan_limit_reached`: which limit was met (sc-3930). */
  limit?: number | 'live_events' | 'guests_per_event' | 'team_seats';
  /** On `plan_limit_reached`: the plan's key, such as `free` (sc-3930). */
  plan?: string;
  /** On `plan_limit_reached`: how many the limit counts now, and how many the plan allows. */
  used?: number;
  allowed?: number;
  /** On `plan_limit_reached` for people, or `event_capacity_reached`: how many people the refused change would add. */
  adding?: number;
  /** On `event_capacity_reached`: the people per event no plan lifts, and how many are on the event. */
  ceiling?: number;
  onEvent?: number;
  /** On `two_factor_required` straight after a Google or Apple sign-in: the address that sign-in vouched for. */
  providerEmail?: string;
  /** On `oauth_only`, `session_timed_out`, `provider_kept_by_rule` or `two_factor_kept_by_rule`: the organisation whose rule it is (sc-69, sc-609). */
  organisation?: string;
  /** On `domain_managed` (sc-563), with `organisation` naming the home organisation: the managed address's domain. */
  domain?: string;
  /** On `oauth_only`: the providers this account may sign in with instead. */
  providers?: string[];
  /** On `session_timed_out`: the limit that ended it. With `oauth_only` too, the address to sign back in with. */
  days?: number;
  email?: string;
  /** On a `validation_failed` shift (sc-3908): how many people are on it as the API now has them. */
  onShift?: number;
  /** On `join_request_cooling_off`: when they may ask that organisation again (sc-562). */
  until?: string;
  /** On `provider_kept_by_rule`: the provider that must stay linked. */
  provider?: string;
  /** On `organisation_two_factor_required`: the permission kept back. */
  permission?: string;
  /** On a service's `permission_required` for the half a level does not work: the half it does (sc-4015). */
  worksAt?: 'floor' | 'pass';
  /** On a seating plan's `precondition_failed`: who changed it since (sc-3998). */
  changedBy?: string;
  /** On a Floor plan step's `precondition_failed`: every item a colleague changed since, so the whole step was refused (sc-5028). */
  stale?: string[];
  /** On `seating_items_outside`: the tables the refused room size would leave outside it (sc-4000). */
  outside?: string[];
  /** On `menu_default_move`: the people given the default who would move to the new one, and those who would go back to not chosen (sc-1362). */
  move?: number;
  back?: number;
  /** On `meal_picks_closed`: the closed courses a send would have changed, none of them saved (sc-3907). */
  courses?: string[];
  /** On `meal_pick_ruled_out`: each person the plate's allergens rule out, nothing saved until sent again with `anyway` (sc-3909). */
  people?: { id: string; allergens: string[] }[];
  /** On `seating_table_short`: the place's free chairs and the party's size (sc-4013). */
  free?: number;
  party?: number;
  /** On `seating_seat_taken` for a chosen chair: who sits in it now. */
  takenBy?: string;
  /** On `seating_guests_seated`: the field the refusal belongs beside, `seats`, `unusableSeats` or `unusable`. */
  field?: string;
  /** On `guest_replied`: the reply that keeps them invited and when, in the event's zone (sc-3788). */
  reply?: string;
  repliedAt?: string;
  /** On `staff_number_shared`: the first roster entry already on that number (sc-3906). */
  sharedWith?: string;
  /** On `dish_name_shared`: whether the only dish holding the name is archived (sc-3901). */
  archived?: boolean;
  /** On a schedule item's `precondition_failed`: the item as it is stored now, which `asScheduleItem` reads (sc-3893). */
  current?: unknown;
  /** On `payer_covers_costs` (sc-91): the costs the payer covers, in the budget's order, and how many. */
  lineIds?: string[];
  /** And on `menu_change_asks` (sc-3913): how many people the change asks again, for `course`, `whom` they are, and on `allergen` the added allergens they have recorded. */
  count?: number;
  course?: { id: string; name: string };
  whom?: 'picked' | 'everyone' | 'allergen';
  allergens?: string[];
  /** On a night-screen press that changed nothing: the earlier press it lost to, its presser's name and when, in the event's zone (sc-3895). */
  superseded_by?: { name: string; at: string };
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
