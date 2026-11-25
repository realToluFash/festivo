<?php

declare(strict_types=1);

namespace App\WebAuthn\Exception;

use RuntimeException;

/** A credential that does not check out. The message says which check, for the log, never for the member. */
final class CeremonyRefused extends RuntimeException
{
}
