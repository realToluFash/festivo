<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use App\Entity\Vendor;
use DateTimeInterface;

final readonly class VendorSerialiser
{
    /** @return array<string, mixed> every optional field null when blank; the phone in E.164 beside the country it was typed for */
    public static function vendor(Vendor $vendor): array
    {
        return [
            'id' => $vendor->getId()->toRfc4122(),
            'name' => $vendor->getName(),
            'category' => $vendor->getCategory()->value,
            'contactName' => $vendor->getContactName(),
            'emailAddress' => $vendor->getEmailAddress(),
            'phoneNumber' => $vendor->getPhoneNumber(),
            'phoneCountryCode' => $vendor->getPhoneCountryCode(),
            'website' => $vendor->getWebsite(),
            'address' => $vendor->getAddress(),
            'note' => $vendor->getNote(),
            'archivedAt' => $vendor->getArchivedAt()?->format(DateTimeInterface::ATOM),
        ];
    }
}
