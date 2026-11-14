<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Symfony\Component\Uid\Uuid;

/** An email address or a phone number: proved by a code, with one set of rules for both. */
interface VerifiableContact
{
    public function getId(): Uuid;

    public function getUser(): User;

    public function isVerified(): bool;

    public function setVerifiedAt(?DateTimeImmutable $verifiedAt): void;
}
