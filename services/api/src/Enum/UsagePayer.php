<?php

declare(strict_types=1);

namespace App\Enum;

/** What paid for a usage record: the period's included amount, or the billing account's credits once any were taken. */
enum UsagePayer: string
{
    case Included = 'included';
    case Credits = 'credits';
}
