<?php

declare(strict_types=1);

namespace App\Enum;

/** How a phone code reached the person (sc-750): what the screen says, and what the monthly fallback rate counts. */
enum PhoneCodeRoute: string
{
    case WhatsApp = 'whatsapp';
    case SmsFallback = 'sms_fallback';
    case SmsChosen = 'sms_chosen';
    /** A later code for a number that chose texts: a new code, so the screen does not say "the same". */
    case SmsPreferred = 'sms_preferred';
    case SmsOnly = 'sms_only';
}
