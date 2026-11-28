<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** What one payment reminder named, in its order, so its link opens Due now on those payments as they are now (sc-1331). Written by the reminder as it renders. */
#[ORM\Entity]
#[ORM\Table(name: 'payment_reminder_sends')]
class PaymentReminderSend
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $sentAt;

    public function __construct(Uuid $id, DateTimeImmutable $sentAt)
    {
        $this->id = $id;
        $this->sentAt = $sentAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getSentAt(): DateTimeImmutable
    {
        return $this->sentAt;
    }
}
