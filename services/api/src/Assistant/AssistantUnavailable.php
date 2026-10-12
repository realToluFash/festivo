<?php

declare(strict_types=1);

namespace App\Assistant;

use RuntimeException;

/**
 * We could not ask, or the provider was too busy to answer.
 *
 * Handled, not a defect. A user is waiting, so there is no in-process retry:
 * tell them it is busy and let them decide whether to send again. Retrying
 * inside the request turns a five-second wait into a fifteen-second one and
 * then fails anyway.
 *
 * Distinct from AssistantRefused because the advice differs: this one means
 * "try again", and that one means "trying again will not help".
 */
final class AssistantUnavailable extends RuntimeException
{
}
