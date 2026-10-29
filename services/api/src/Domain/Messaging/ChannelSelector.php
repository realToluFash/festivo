<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Interfaces\NotificationPreferencesInterface;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** The one place that decides which of a type's channels a person gets (epic 36, §5). */
final readonly class ChannelSelector
{
    public function __construct(
        private NotificationPreferencesInterface $notificationPreferences,
    ) {
    }

    /**
     * @param non-empty-list<NotificationChannel> $offered
     *
     * @return list<NotificationChannel>
     */
    public function select(NotificationAudienceKind $kind, Uuid $recipientId, NotificationCategory $category, array $offered): array
    {
        if (NotificationAudienceKind::Guest === $kind) {
            return Vec\filter($offered, static fn (NotificationChannel $channel): bool => NotificationChannel::Push !== $channel);
        }

        $chosen = Vec\filter($offered, fn (NotificationChannel $channel): bool => match ($channel) {
            NotificationChannel::InApp => true,
            NotificationChannel::Email => NotificationCategory::AccountSecurity === $category
                || $this->notificationPreferences->allows($recipientId, $category, $channel),
            NotificationChannel::Push => false,
        });

        // Push rides along and is never the only way somebody hears: a closed tab or a muted phone would be silence.
        if ([] !== $chosen && Iter\contains($offered, NotificationChannel::Push) && $this->notificationPreferences->allows($recipientId, $category, NotificationChannel::Push)) {
            $chosen[] = NotificationChannel::Push;
        }

        return $chosen;
    }
}
