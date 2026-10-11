<?php

declare(strict_types=1);

namespace App\Address;

use RuntimeException;

/**
 * The provider is down, or refusing us.
 *
 * Distinct from AddressNotFound on purpose: one means "no such address", the
 * other means "we cannot ask". A caller must be able to tell them apart,
 * because autocomplete being unavailable is never a reason to stop somebody
 * saving a venue they typed out themselves.
 */
final class ProviderUnavailable extends RuntimeException
{
}
