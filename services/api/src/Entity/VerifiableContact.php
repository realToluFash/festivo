<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Symfony\Component\Uid\Uuid;

/** An email address, a phone number, or a number signing in by phone: proved by a code, with one set of rules for all. */
interface VerifiableContact
{
    public function getId(): Uuid;

    public function isVerified(): bool;

    public function setVerifiedAt(?DateTimeImmutable $verifiedAt): void;
}
