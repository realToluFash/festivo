<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exception;

use RuntimeException;

/** Nothing to send to on this channel: no address, say. Recorded Failed at once, since a retry would find the same. */
final class Unreachable extends RuntimeException
{
}
