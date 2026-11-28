<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Exception;

use RuntimeException;
use Throwable;

/** Nothing to send to on this channel: no address, say. Recorded Failed at once, since a retry would find the same. */
final class Unreachable extends RuntimeException
{
    /** @param bool $providerBlocked the provider refused the address from its own suppression list (sc-3942): Not sent, never a bounce */
    public function __construct(
        string $message,
        public readonly bool $providerBlocked = false,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public static function providerBlocked(Throwable $refused): self
    {
        return new self($refused->getMessage(), true, $refused);
    }
}
