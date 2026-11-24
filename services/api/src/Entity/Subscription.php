<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\Plan;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** An organisation's current subscription, one per organisation; what it was before is its `SubscriptionChange` history (sc-3927). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'subscriptions')]
#[ORM\UniqueConstraint(name: 'uniq_subscription_organisation', columns: ['organisation_id'])]
#[ORM\Index(name: 'idx_subscription_billing_account', columns: ['billing_account_id'])]
class Subscription
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\ManyToOne(targetEntity: BillingAccount::class)]
    #[ORM\JoinColumn(nullable: false)]
    private BillingAccount $billingAccount;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: Plan::class)]
    private Plan $plan;

    /** The plans version it was sold on, whose terms it keeps until staff move it (sc-3928). */
    #[ORM\ManyToOne(targetEntity: CatalogueVersion::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'RESTRICT')]
    private CatalogueVersion $catalogueVersion;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $periodStart;

    /** Null runs on with no end, as Free does. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $periodEnd = null;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: SubscriptionStatus::class)]
    private SubscriptionStatus $status;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: SubscriptionSource::class)]
    private SubscriptionSource $source;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $externalRef = null;

    /** The provider's time for the event it was last set from: an older event never overwrites it (sc-3933). */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $providerUpdatedAt = null;

    public function __construct(
        Organisation $organisation,
        BillingAccount $billingAccount,
        Plan $plan,
        CatalogueVersion $catalogueVersion,
        SubscriptionStatus $status,
        SubscriptionSource $source,
        DateTimeImmutable $periodStart,
    ) {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->billingAccount = $billingAccount;
        $this->plan = $plan;
        $this->catalogueVersion = $catalogueVersion;
        $this->status = $status;
        $this->source = $source;
        $this->periodStart = $periodStart;
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

    public function getPlan(): Plan
    {
        return $this->plan;
    }

    /** Only `SubscriptionChanger` calls this, so the change is recorded in the history. */
    public function changePlan(Plan $plan, SubscriptionSource $source): void
    {
        $this->plan = $plan;
        $this->source = $source;
    }

    public function getCatalogueVersion(): CatalogueVersion
    {
        return $this->catalogueVersion;
    }

    /** Only `SubscriptionChanger` calls this, so the move is recorded in the history. */
    public function setCatalogueVersion(CatalogueVersion $catalogueVersion): void
    {
        $this->catalogueVersion = $catalogueVersion;
    }

    public function getPeriodStart(): DateTimeImmutable
    {
        return $this->periodStart;
    }

    /** Only `SubscriptionChanger` calls this, so the move is recorded in the history. */
    public function startPeriodAt(DateTimeImmutable $periodStart): void
    {
        $this->periodStart = $periodStart;
    }

    public function getPeriodEnd(): ?DateTimeImmutable
    {
        return $this->periodEnd;
    }

    public function getStatus(): SubscriptionStatus
    {
        return $this->status;
    }

    public function getSource(): SubscriptionSource
    {
        return $this->source;
    }

    public function getExternalRef(): ?string
    {
        return $this->externalRef;
    }

    /** Only `SubscriptionChanger` calls this. */
    public function linkToProvider(SubscriptionSource $source, string $externalRef): void
    {
        $this->source = $source;
        $this->externalRef = $externalRef;
    }

    /** Only `SubscriptionChanger` calls this. A renewal never moves the period start (sc-3929): only a change billed from a new date does. */
    public function changePeriod(?DateTimeImmutable $periodEnd, ?DateTimeImmutable $billedFrom = null): void
    {
        $this->periodEnd = $periodEnd;

        if (null !== $billedFrom) {
            $this->periodStart = $billedFrom;
        }
    }

    /** Only `SubscriptionChanger` calls this, so the change is recorded in the history. */
    public function changeStatus(SubscriptionStatus $status): void
    {
        $this->status = $status;
    }

    public function getProviderUpdatedAt(): ?DateTimeImmutable
    {
        return $this->providerUpdatedAt;
    }

    public function setProviderUpdatedAt(DateTimeImmutable $at): void
    {
        $this->providerUpdatedAt = $at;
    }
}
