<?php

declare(strict_types=1);

namespace App\WebAuthn\Model;

/** What a checked assertion says about its credential now. */
final readonly class CheckedAssertion
{
    public function __construct(
        public bool $backedUp,
        public int $signCount,
    ) {
    }
}
