<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a member who joined through the company domain was suspended (sc-564), which decides what Restore needs. */
enum DomainSuspension: string
{
    case AddressGone = 'address_gone';
    case DomainClosed = 'domain_closed';
    case DomainManagedElsewhere = 'domain_managed_elsewhere';

    /** Only an address that went has to come back: the other two were nothing the person did. */
    public function needsTheAddress(): bool
    {
        return self::AddressGone === $this;
    }
}
