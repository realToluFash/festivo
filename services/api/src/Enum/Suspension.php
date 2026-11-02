<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a member was suspended: by the company domain (sc-564) or by somebody who manages members (sc-3575), which decides what Restore needs. */
enum Suspension: string
{
    case AddressGone = 'address_gone';
    case DomainClosed = 'domain_closed';
    case DomainManagedElsewhere = 'domain_managed_elsewhere';
    case Manual = 'manual';

    /** Only an address that went has to come back: the other two were nothing the person did. */
    public function needsTheAddress(): bool
    {
        return self::AddressGone === $this;
    }

    /** A suspension somebody chose lasts until somebody restores it: only the domain's run out after 30 days. */
    public function runsOut(): bool
    {
        return self::Manual !== $this;
    }
}
