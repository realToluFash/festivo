<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Model;

/** A plan's list price in one currency, in its ISO 4217 minor unit, excluding tax (sc-3940). */
final readonly class Price
{
    /**
     * @param int<0, max> $monthly
     * @param int<0, max> $yearly
     */
    public function __construct(
        public int $monthly,
        public int $yearly,
    ) {
    }
}
