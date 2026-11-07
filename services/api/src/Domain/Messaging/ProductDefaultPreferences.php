<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Interfaces\NotificationPreferencesInterface;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Symfony\Component\Uid\Uuid;

/** Epic 36's product defaults (§5): what a member gets for a switch they never changed. */
final readonly class ProductDefaultPreferences implements NotificationPreferencesInterface
{
    public function allows(Uuid $userId, NotificationCategory $category, NotificationChannel $channel): bool
    {
        return match ($channel) {
            NotificationChannel::InApp => true,
            NotificationChannel::Push => NotificationCategory::AccountSecurity !== $category,
            NotificationChannel::Email => NotificationCategory::EventDay !== $category,
        };
    }
}
