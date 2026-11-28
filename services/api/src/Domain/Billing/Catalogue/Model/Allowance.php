<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Model;

/** An amount a plan allows, or unlimited: a value of its own, never a large number (sc-3928). */
final readonly class Allowance
{
    public const string UNLIMITED = 'unlimited';

    /** @param ?int<0, max> $amount null when unlimited */
    private function __construct(
        public ?int $amount,
    ) {
    }

    public static function unlimited(): self
    {
        return new self(null);
    }

    /** @param int<0, max> $amount */
    public static function of(int $amount): self
    {
        return new self($amount);
    }

    public function isUnlimited(): bool
    {
        return null === $this->amount;
    }

    /** Whether a total of `$count` stays within it. */
    public function covers(int $count): bool
    {
        return null === $this->amount || $count <= $this->amount;
    }

    /** @return int<0, max>|'unlimited' */
    public function written(): int|string
    {
        return $this->amount ?? self::UNLIMITED;
    }
}
