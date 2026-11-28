<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\UsageKind;
use App\Enum\WhatsAppCategory;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Units set aside before a send, from the period's included amount and then the billing account's credits, at the price of the version in force (sc-3929). */
#[ORM\Entity]
#[ORM\Table(name: 'usage_reservations')]
#[ORM\Index(name: 'idx_usage_reservation_unreleased', columns: ['reserved_at'], options: ['where' => '(released_at IS NULL)'])]
class UsageReservation
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

    /** @var int<1, max> */
    #[ORM\Column(type: Types::INTEGER)]
    private int $quantity;

    /** ISO 3166-1 alpha-2, where the country sets the price. */
    #[ORM\Column(type: Types::STRING, length: 2, nullable: true)]
    private ?string $country;

    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: WhatsAppCategory::class)]
    private ?WhatsAppCategory $whatsAppCategory;

    #[ORM\ManyToOne(targetEntity: CatalogueVersion::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'RESTRICT')]
    private CatalogueVersion $unitCostVersion;

    #[ORM\Column(type: Types::INTEGER)]
    private int $creditsPerUnit;

    /** The period whose included amount it holds from. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $periodStart;

    #[ORM\Column(type: Types::INTEGER)]
    private int $includedUnits;

    #[ORM\Column(type: Types::INTEGER)]
    private int $creditUnits;

    /** what is still held from the included amount */
    #[ORM\Column(type: Types::INTEGER)]
    private int $includedHeld;

    /** what is still held from credits, in units at `creditsPerUnit` */
    #[ORM\Column(type: Types::INTEGER)]
    private int $creditUnitsHeld;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $reservedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $releasedAt = null;

    /** @param int<1, max> $quantity */
    public function __construct(
        Organisation $organisation,
        BillingAccount $billingAccount,
        UsageKind $kind,
        int $quantity,
        ?string $country,
        ?WhatsAppCategory $whatsAppCategory,
        CatalogueVersion $unitCostVersion,
        int $creditsPerUnit,
        DateTimeImmutable $periodStart,
        int $includedUnits,
        int $creditUnits,
        DateTimeImmutable $reservedAt,
    ) {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->billingAccount = $billingAccount;
        $this->kind = $kind;
        $this->quantity = $quantity;
        $this->country = $country;
        $this->whatsAppCategory = $whatsAppCategory;
        $this->unitCostVersion = $unitCostVersion;
        $this->creditsPerUnit = $creditsPerUnit;
        $this->periodStart = $periodStart;
        $this->includedUnits = $includedUnits;
        $this->creditUnits = $creditUnits;
        $this->includedHeld = $includedUnits;
        $this->creditUnitsHeld = $creditUnits;
        $this->reservedAt = $reservedAt;
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

    /** @return int<1, max> */
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

    public function getUnitCostVersion(): CatalogueVersion
    {
        return $this->unitCostVersion;
    }

    public function getCreditsPerUnit(): int
    {
        return $this->creditsPerUnit;
    }

    public function getPeriodStart(): DateTimeImmutable
    {
        return $this->periodStart;
    }

    public function getIncludedUnits(): int
    {
        return $this->includedUnits;
    }

    public function getCreditUnits(): int
    {
        return $this->creditUnits;
    }

    public function getIncludedHeld(): int
    {
        return $this->includedHeld;
    }

    public function setIncludedHeld(int $includedHeld): void
    {
        $this->includedHeld = $includedHeld;
    }

    public function getCreditUnitsHeld(): int
    {
        return $this->creditUnitsHeld;
    }

    public function setCreditUnitsHeld(int $creditUnitsHeld): void
    {
        $this->creditUnitsHeld = $creditUnitsHeld;
    }

    public function getReservedAt(): DateTimeImmutable
    {
        return $this->reservedAt;
    }

    public function getReleasedAt(): ?DateTimeImmutable
    {
        return $this->releasedAt;
    }

    public function setReleasedAt(?DateTimeImmutable $releasedAt): void
    {
        $this->releasedAt = $releasedAt;
    }
}
