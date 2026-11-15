<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Interfaces\NotificationPreferencesInterface;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Repository\NotificationPreferenceRepository;
use Symfony\Component\Uid\Uuid;

/** Each member's own switches (sc-3980), with epic 36's product defaults wherever they changed nothing. */
final readonly class StoredNotificationPreferences implements NotificationPreferencesInterface
{
    public function __construct(
        private NotificationPreferenceRepository $notificationPreferenceRepository,
        private ProductDefaultPreferences $productDefaultPreferences,
    ) {
    }

    public function allows(Uuid $userId, NotificationCategory $category, NotificationChannel $channel): bool
    {
        if (!self::isSwitchable($category, $channel)) {
            return true;
        }

        return $this->notificationPreferenceRepository->findOneFor($userId, $category, $channel)?->isAllowed()
            ?? $this->productDefaultPreferences->allows($userId, $category, $channel);
    }

    /** In-app always goes, and Account & security email can't be switched off (epic 36, §5). */
    public static function isSwitchable(NotificationCategory $category, NotificationChannel $channel): bool
    {
        return NotificationChannel::InApp !== $channel
            && !(NotificationCategory::AccountSecurity === $category && NotificationChannel::Email === $channel);
    }
}
