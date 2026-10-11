<?php

declare(strict_types=1);

namespace App\Assistant;

use RuntimeException;

/**
 * Something we got wrong.
 *
 * A malformed request, a rejected key, a payload we cannot read. Separate from
 * AssistantUnavailable so that the two can be treated differently where it
 * matters: the provider being busy is traffic, and this is a bug, and a single
 * exception for both means either every busy minute pages somebody or no bug
 * ever does.
 */
final class AssistantFailed extends RuntimeException
{
}
