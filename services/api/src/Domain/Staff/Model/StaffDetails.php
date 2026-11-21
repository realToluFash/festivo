<?php

declare(strict_types=1);

namespace App\Domain\Staff\Model;

/** A roster entry as the add and edit forms send it, checked by StaffRules. */
final readonly class StaffDetails
{
    /** @param ?non-empty-string $mobile E.164 */
    public function __construct(
        public string $fullName,
        public ?string $mobile,
        public ?string $email,
    ) {
    }
}
