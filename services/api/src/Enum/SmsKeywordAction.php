<?php

declare(strict_types=1);

namespace App\Enum;

/** What a text sent to Soirely's number asks for (sc-3946). */
enum SmsKeywordAction: string
{
    case Stop = 'stop';
    case Start = 'start';
    case Help = 'help';
}
