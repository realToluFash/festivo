<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a guest's email delivery never reached them (sc-3942), each shown to the host in words. */
enum DeliveryNotSentReason: string
{
    case NoAddress = 'no_address';
    case Bouncing = 'bouncing';
    case Complained = 'complained';
    case ProviderBlocked = 'provider_blocked';
    /** Out of retries. */
    case Failed = 'failed';
}
