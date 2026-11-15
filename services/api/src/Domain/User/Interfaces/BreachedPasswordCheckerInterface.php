<?php

declare(strict_types=1);

namespace App\Domain\User\Interfaces;

use SensitiveParameter;

interface BreachedPasswordCheckerInterface
{
    /**
     * Whether this password appears in a known breach corpus.
     *
     * Implementations must **fail open** — answer false when the service cannot
     * be reached — and say so in the log. Refusing registrations because a third
     * party is down trades a small security gain for a total outage of the front
     * door.
     */
    public function isBreached(#[SensitiveParameter] string $password): bool;
}
