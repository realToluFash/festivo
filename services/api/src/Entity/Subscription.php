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

    /** Empty until the plan catalogue exists (sc-3928). */
    #[ORM\Column(type: Types::STRING, length: 40, nullable: true)]
    private ?string $catalogueVersion = null;

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

    public function __construct(
        Organisation $organisation,
        BillingAccount $billingAccount,
        Plan $plan,
        SubscriptionStatus $status,
        SubscriptionSource $source,
        DateTimeImmutable $periodStart,
    ) {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->billingAccount = $billingAccount;
        $this->plan = $plan;
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

    public function setPlan(Plan $plan): void
    {
        $this->plan = $plan;
    }

    public function getCatalogueVersion(): ?string
    {
        return $this->catalogueVersion;
    }

    public function setCatalogueVersion(?string $catalogueVersion): void
    {
        $this->catalogueVersion = $catalogueVersion;
    }

    public function getPeriodStart(): DateTimeImmutable
    {
        return $this->periodStart;
    }

    public function setPeriodStart(DateTimeImmutable $periodStart): void
    {
        $this->periodStart = $periodStart;
    }

    public function getPeriodEnd(): ?DateTimeImmutable
    {
        return $this->periodEnd;
    }

    public function setPeriodEnd(?DateTimeImmutable $periodEnd): void
    {
        $this->periodEnd = $periodEnd;
    }

    public function getStatus(): SubscriptionStatus
    {
        return $this->status;
    }

    public function setStatus(SubscriptionStatus $status): void
    {
        $this->status = $status;
    }

    public function getSource(): SubscriptionSource
    {
        return $this->source;
    }

    public function setSource(SubscriptionSource $source): void
    {
        $this->source = $source;
    }

    public function getExternalRef(): ?string
    {
        return $this->externalRef;
    }

    public function setExternalRef(?string $externalRef): void
    {
        $this->externalRef = $externalRef;
    }
}
