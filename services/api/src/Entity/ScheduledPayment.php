<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A payment due to an engaged vendor (sc-87), in the event's currency's minor unit, due on a day in the event's time zone. Marked paid or cancelled, never both (sc-88). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'scheduled_payments')]
#[ORM\Index(name: 'idx_scheduled_payment_engagement', columns: ['engagement_id'])]
#[ORM\Index(name: 'idx_scheduled_payment_paid_by', columns: ['paid_by_id'])]
#[ORM\Index(name: 'idx_scheduled_payment_cancelled_by', columns: ['cancelled_by_id'])]
class ScheduledPayment
{
    use Timestampable;

    public const int DESCRIPTION_MAXIMUM = 100;

    public const int REFERENCE_MAXIMUM = 100;

    public const int REASON_MAXIMUM = 200;

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

    #[ORM\Column(type: Types::BIGINT, nullable: true)]
    private ?string $paidAmountMinor = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $paidOn = null;

    #[ORM\Column(type: Types::STRING, length: 400, nullable: true)]
    private ?string $paidReference = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $paidAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $paidBy = null;

    /** Added through "Add a payment already made": the plan never owed it, so Undo deletes it rather than leaving it owed. */
    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $addedAsPaid = false;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $cancelledAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $cancelledBy = null;

    #[ORM\Column(type: Types::STRING, length: 800, nullable: true)]
    private ?string $cancelReason = null;

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

    public function isPaid(): bool
    {
        return null !== $this->paidAt;
    }

    public function isCancelled(): bool
    {
        return null !== $this->cancelledAt;
    }

    public function isAddedAsPaid(): bool
    {
        return $this->addedAsPaid;
    }

    public function getPaidAmountMinor(): ?int
    {
        return null === $this->paidAmountMinor ? null : (int) $this->paidAmountMinor;
    }

    public function getPaidOn(): ?DateTimeImmutable
    {
        return $this->paidOn;
    }

    public function getPaidReference(): ?string
    {
        return $this->paidReference;
    }

    public function getPaidAt(): ?DateTimeImmutable
    {
        return $this->paidAt;
    }

    public function getPaidBy(): ?User
    {
        return $this->paidBy;
    }

    public function getCancelledAt(): ?DateTimeImmutable
    {
        return $this->cancelledAt;
    }

    public function getCancelledBy(): ?User
    {
        return $this->cancelledBy;
    }

    public function getCancelReason(): ?string
    {
        return $this->cancelReason;
    }

    public function markPaid(int $amountMinor, DateTimeImmutable $paidOn, ?string $reference, DateTimeImmutable $at, User $by): void
    {
        $this->paidAmountMinor = (string) $amountMinor;
        $this->paidOn = $paidOn;
        $this->paidReference = $reference;
        $this->paidAt = $at;
        $this->paidBy = $by;
    }

    public function addedAsPaid(): void
    {
        $this->addedAsPaid = true;
    }

    public function unmark(): void
    {
        $this->paidAmountMinor = null;
        $this->paidOn = null;
        $this->paidReference = null;
        $this->paidAt = null;
        $this->paidBy = null;
    }

    public function cancel(?string $reason, DateTimeImmutable $at, User $by): void
    {
        $this->cancelReason = $reason;
        $this->cancelledAt = $at;
        $this->cancelledBy = $by;
    }

    public function restore(): void
    {
        $this->cancelReason = null;
        $this->cancelledAt = null;
        $this->cancelledBy = null;
    }
}
