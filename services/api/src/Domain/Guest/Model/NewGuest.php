<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** A guest as GuestRules accepted them: trimmed, the mobile number in E.164, a blank companion name null, the Language one of SupportedLocales::ALL or null, needs as GuestNeeds says. */
final readonly class NewGuest
{
    /**
     * @param list<?string>     $companions
     * @param ?GuestNeeds       $needs          null leaves the guest's as they are
     * @param list<?GuestNeeds> $companionNeeds beside `$companions`; null leaves a kept companion's as they are, and gives one added none
     */
    public function __construct(
        public string $fullName,
        public string $nameKey,
        public ?string $email,
        public ?string $mobile,
        public array $companions,
        public ?string $language = null,
        public ?GuestNeeds $needs = null,
        public array $companionNeeds = [],
    ) {
    }
}
