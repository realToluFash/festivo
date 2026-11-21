<?php

declare(strict_types=1);

namespace App\Enum;

/** How a job, or one person on it, is paid for an event (sc-101): by each scheduled hour, or one fee for the event whatever their shifts. */
enum StaffPay: string
{
    case Hourly = 'hourly';
    case Flat = 'flat';
}
