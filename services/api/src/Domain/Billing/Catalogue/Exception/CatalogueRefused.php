<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Exception;

use RuntimeException;

/** A catalogue document, or a staff action on a version, that cannot be accepted; the message says why, for the member of staff. */
final class CatalogueRefused extends RuntimeException
{
}
