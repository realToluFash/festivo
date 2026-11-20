<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A payment due to an engaged vendor (sc-87), in the event's currency's minor unit, due on a day in the event's time zone. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'scheduled_payments')]
#[ORM\Index(name: 'idx_scheduled_payment_engagement', columns: ['engagement_id'])]
class ScheduledPayment
{
    use Timestampable;

    public const int DESCRIPTION_MAXIMUM = 100;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: VendorEngagement::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private VendorEngagement $engagement;

    #[ORM\Column(type: Types::STRING, length: 400)]
    private string $description;

    #[ORM\Column(type: Types::BIGINT)]
    private string $amountMinor;

    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    private DateTimeImmutable $dueOn;

    public function __construct(VendorEngagement $engagement, string $description, int $amountMinor, DateTimeImmutable $dueOn)
    {
        $this->id = Uuid::v7();
        $this->engagement = $engagement;
        $this->description = $description;
        $this->amountMinor = (string) $amountMinor;
        $this->dueOn = $dueOn;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEngagement(): VendorEngagement
    {
        return $this->engagement;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getAmountMinor(): int
    {
        return (int) $this->amountMinor;
    }

    public function getDueOn(): DateTimeImmutable
    {
        return $this->dueOn;
    }

    public function amend(string $description, int $amountMinor, DateTimeImmutable $dueOn): void
    {
        $this->description = $description;
        $this->amountMinor = (string) $amountMinor;
        $this->dueOn = $dueOn;
    }
}
