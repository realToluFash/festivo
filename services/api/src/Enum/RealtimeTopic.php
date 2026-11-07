<?php

declare(strict_types=1);

namespace App\Enum;

use Psl\Str;

/** Every Mercure topic the API publishes on, declared once; the clients read the copy generated from it into @soirely/api-client. */
enum RealtimeTopic: string
{
    case UserNotifications = 'users/{id}/notifications';

    public function for(string $id): string
    {
        return Str\replace($this->value, '{id}', $id);
    }
}
