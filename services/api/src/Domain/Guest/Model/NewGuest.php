<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** A guest as GuestRules accepted them: trimmed, the mobile number in E.164, a blank companion name null. */
final readonly class NewGuest
{
    /**
     * @param list<?string> $companions
     */
    public function __construct(
        public string $fullName,
        public string $nameKey,
        public ?string $email,
        public ?string $mobile,
        public array $companions,
    ) {
    }
}
