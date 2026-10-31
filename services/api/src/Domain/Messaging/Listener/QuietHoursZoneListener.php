<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Listener;

use App\Entity\User;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\NotificationHold;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;
use Psr\Clock\ClockInterface;

/** A member who changes zone in the night has their held pushes read on the new clock now, rather than at the old one's 08:00 (sc-20494). */
#[AsEntityListener(event: Events::preUpdate, entity: User::class)]
final readonly class QuietHoursZoneListener
{
    public function __construct(
        private ClockInterface $clock,
    ) {
    }

    public function preUpdate(User $user, PreUpdateEventArgs $event): void
    {
        if (!$event->hasChangedField('timezone')) {
            return;
        }

        $now = $this->clock->now();
        $event->getObjectManager()->getConnection()->executeStatement(
            <<<'SQL'
                UPDATE notification_deliveries
                SET next_attempt_at = :now
                WHERE recipient_id = :user AND status = :pending AND held = :quietHours AND attempts = 0 AND next_attempt_at > :now
                SQL,
            [
                'now' => $now,
                'user' => $user->getId()->toRfc4122(),
                'pending' => NotificationDeliveryStatus::Pending->value,
                'quietHours' => NotificationHold::QuietHours->value,
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }
}
