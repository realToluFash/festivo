<?php

declare(strict_types=1);

namespace App\Enum;

enum RefreshTokenDelivery: string
{
    case Body = 'body';
    case Cookie = 'cookie';
}
