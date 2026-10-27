<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Entity\NotificationPreference;
use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Repository\NotificationPreferenceRepository;
use Doctrine\ORM\EntityManagerInterface;

/** One switch in Notification settings. The row is kept when it matches the default, so a later change to a default leaves a member's choice alone. */
final readonly class NotificationPreferenceSetter
{
    public function __construct(
        private NotificationPreferenceRepository $notificationPreferenceRepository,
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function set(User $user, NotificationCategory $category, NotificationChannel $channel, bool $on): void
    {
        $preference = $this->notificationPreferenceRepository->findOneFor($user->getId(), $category, $channel);

        if (null === $preference) {
            $this->entityManager->persist(new NotificationPreference($user, $category, $channel, $on));
        } else {
            $preference->setAllowed($on);
        }

        $this->entityManager->flush();
    }
}
