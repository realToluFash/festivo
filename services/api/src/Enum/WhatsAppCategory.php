<?php

declare(strict_types=1);

namespace App\Enum;

/** The category Meta charged a WhatsApp message in, which sets its unit cost (sc-3928, sc-3950). */
enum WhatsAppCategory: string
{
    case Utility = 'utility';
    case Marketing = 'marketing';

    /** A non-template message inside the customer-service window, charged at the utility rate (sc-3929, 7 Nov). */
    case Service = 'service';
}
