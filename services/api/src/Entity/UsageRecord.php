<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\UsageKind;
use App\Enum\UsagePayer;
use App\Enum\WhatsAppCategory;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use LogicException;
use Symfony\Component\Uid\Uuid;

/** One billable use, written once under the key of what caused it and never edited (sc-3929): a correction is a record of its own that names this one. A storage measurement is the exception, a gauge a later measurement of the same day replaces. */
#[ORM\Entity]
#[ORM\Table(name: 'usage_records')]
#[ORM\UniqueConstraint(name: 'uniq_usage_record_key', columns: ['organisation_id', 'key_scope', 'idempotency_key'])]
#[ORM\Index(name: 'idx_usage_record_period', columns: ['organisation_id', 'period_start', 'kind'])]
class UsageRecord
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\ManyToOne(targetEntity: BillingAccount::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private BillingAccount $billingAccount;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: UsageKind::class)]
    private UsageKind $kind;

    /** `UsageKind::keyScope()`: the three message kinds share one, so one message is recorded once whichever channel reports it. */
    #[ORM\Column(type: Types::STRING, length: 20)]
    private string $keyScope;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $idempotencyKey;

    #[ORM\Column(type: Types::BIGINT)]
    private int $quantity;

    #[ORM\Column(type: Types::STRING, length: 2, nullable: true)]
    private ?string $country;

    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: WhatsAppCategory::class)]
    private ?WhatsAppCategory $whatsAppCategory;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $occurredAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $periodStart;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: UsagePayer::class)]
    private UsagePayer $paidBy;

    /** How much of the quantity the included amount paid for; credits paid for the rest. */
    #[ORM\Column(type: Types::BIGINT)]
    private int $includedQuantity;

    #[ORM\Column(type: Types::INTEGER)]
    private int $creditsTaken;

    /** Null on a storage measurement, which is never priced. */
    #[ORM\ManyToOne(targetEntity: CatalogueVersion::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'RESTRICT')]
    private ?CatalogueVersion $unitCostVersion;

    #[ORM\Column(type: Types::INTEGER)]
    private int $creditsPerUnit;

    #[ORM\ManyToOne(targetEntity: UsageReservation::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?UsageReservation $reservation;

    /** Settled after its reservation was released. */
    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $late;

    /** The record this one corrects, such as a credit back (sc-3952). */
    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?UsageRecord $corrects;

    public function __construct(
        Organisation $organisation,
        BillingAccount $billingAccount,
        UsageKind $kind,
        string $idempotencyKey,
        int $quantity,
        ?string $country,
        ?WhatsAppCategory $whatsAppCategory,
        DateTimeImmutable $occurredAt,
        DateTimeImmutable $periodStart,
        UsagePayer $paidBy,
        int $includedQuantity,
        int $creditsTaken,
        ?CatalogueVersion $unitCostVersion,
        int $creditsPerUnit,
        ?UsageReservation $reservation,
        bool $late,
        ?self $corrects = null,
    ) {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->billingAccount = $billingAccount;
        $this->kind = $kind;
        $this->keyScope = $kind->keyScope();
        $this->idempotencyKey = $idempotencyKey;
        $this->quantity = $quantity;
        $this->country = $country;
        $this->whatsAppCategory = $whatsAppCategory;
        $this->occurredAt = $occurredAt;
        $this->periodStart = $periodStart;
        $this->paidBy = $paidBy;
        $this->includedQuantity = $includedQuantity;
        $this->creditsTaken = $creditsTaken;
        $this->unitCostVersion = $unitCostVersion;
        $this->creditsPerUnit = $creditsPerUnit;
        $this->reservation = $reservation;
        $this->late = $late;
        $this->corrects = $corrects;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getBillingAccount(): BillingAccount
    {
        return $this->billingAccount;
    }

    public function getKind(): UsageKind
    {
        return $this->kind;
    }

    public function getKeyScope(): string
    {
        return $this->keyScope;
    }

    public function getIdempotencyKey(): string
    {
        return $this->idempotencyKey;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function getCountry(): ?string
    {
        return $this->country;
    }

    public function getWhatsAppCategory(): ?WhatsAppCategory
    {
        return $this->whatsAppCategory;
    }

    public function getOccurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function getPeriodStart(): DateTimeImmutable
    {
        return $this->periodStart;
    }

    public function getPaidBy(): UsagePayer
    {
        return $this->paidBy;
    }

    public function getIncludedQuantity(): int
    {
        return $this->includedQuantity;
    }

    public function getCreditsTaken(): int
    {
        return $this->creditsTaken;
    }

    public function getUnitCostVersion(): ?CatalogueVersion
    {
        return $this->unitCostVersion;
    }

    public function getCreditsPerUnit(): int
    {
        return $this->creditsPerUnit;
    }

    public function getReservation(): ?UsageReservation
    {
        return $this->reservation;
    }

    public function isLate(): bool
    {
        return $this->late;
    }

    public function getCorrects(): ?self
    {
        return $this->corrects;
    }

    public function remeasure(int $bytes, DateTimeImmutable $at, DateTimeImmutable $periodStart): void
    {
        if (UsageKind::StorageBytes !== $this->kind) {
            throw new LogicException('Only a storage measurement is ever measured again.');
        }

        $this->quantity = $bytes;
        $this->includedQuantity = $bytes;
        $this->occurredAt = $at;
        $this->periodStart = $periodStart;
    }
}
