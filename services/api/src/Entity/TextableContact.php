<?php

declare(strict_types=1);

namespace App\Entity;

/** A number a phone code goes to (sc-750): an account's own, or one signing in by phone that has no account behind it yet (sc-4235). */
interface TextableContact extends VerifiableContact
{
    public function getNumber(): string;

    public function getCountryCode(): ?string;

    public function wantsCodesByText(): bool;

    public function chooseCodesByText(): void;
}
