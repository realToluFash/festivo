<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Enum\VendorCategory;

/** A vendor's fields once checked: trimmed, the phone in E.164 beside its country, the website with its scheme, and every blank optional one null. */
final readonly class VendorFields
{
    public function __construct(
        public string $name,
        public VendorCategory $category,
        public ?string $contactName,
        public ?string $emailAddress,
        public ?string $phoneNumber,
        public ?string $phoneCountryCode,
        public ?string $website,
        public ?string $address,
        public ?string $note,
    ) {
    }
}
