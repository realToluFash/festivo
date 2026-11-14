<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Interfaces;

use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Symfony\Component\Uid\Uuid;

/** A member's own Push and Email switch per category. sc-3980 owns the one store; nothing else keeps preferences. */
interface NotificationPreferencesInterface
{
    public function allows(Uuid $userId, NotificationCategory $category, NotificationChannel $channel): bool;
}
