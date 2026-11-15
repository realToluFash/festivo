<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\OwnerClaimOutcome;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** An Administrator proving the organisation's domain afresh to become its Owner while none is active (sc-6640). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'owner_claims')]
#[ORM\UniqueConstraint(name: 'uniq_open_owner_claim', columns: ['organisation_id'], options: ['where' => '(ended_at IS NULL)'])]
#[ORM\Index(name: 'idx_owner_claim_organisation', columns: ['organisation_id'])]
#[ORM\Index(name: 'idx_owner_claim_claimant', columns: ['claimant_id'])]
#[ORM\Index(name: 'idx_owner_claim_stopped_by', columns: ['stopped_by_id'])]
class OwnerClaim
{
    use Timestampable;

    /** A record not found in 7 × 24 h ends the claim. */
    public const string LAPSES_AFTER = 'PT168H';

    /** Ownership passes 72 × 24 h after the record is found, if it is still there then. */
    public const string PASSES_AFTER = 'PT72H';

    /** How often the record is looked up while it has not been found. */
    public const string CHECKED_EVERY = 'PT1H';

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $claimant;

    #[ORM\Column(type: Types::STRING, length: 253)]
    private string $domain;

    /** Fresh for this claim, never the value of an earlier proof. */
    #[ORM\Column(type: Types::STRING, length: 100)]
    private string $recordValue;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $startedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $lapsesAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $checkedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $foundAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $passesAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $endedAt = null;

    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: OwnerClaimOutcome::class)]
    private ?OwnerClaimOutcome $outcome = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $stoppedBy = null;

    /** @var list<array{id: string, as: string}> who was emailed when the record was found, and as what: they hear how it ends */
    #[ORM\Column(type: Types::JSON)]
    private array $told = [];

    public function __construct(Organisation $organisation, User $claimant, string $domain, string $recordValue, DateTimeImmutable $startedAt)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->claimant = $claimant;
        $this->domain = $domain;
        $this->recordValue = $recordValue;
        $this->startedAt = $startedAt;
        $this->lapsesAt = $startedAt->add(new DateInterval(self::LAPSES_AFTER));
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getClaimant(): User
    {
        return $this->claimant;
    }

    public function getDomain(): string
    {
        return $this->domain;
    }

    public function getRecordValue(): string
    {
        return $this->recordValue;
    }

    public function getStartedAt(): DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function getLapsesAt(): DateTimeImmutable
    {
        return $this->lapsesAt;
    }

    public function getCheckedAt(): ?DateTimeImmutable
    {
        return $this->checkedAt;
    }

    public function setCheckedAt(?DateTimeImmutable $checkedAt): void
    {
        $this->checkedAt = $checkedAt;
    }

    public function getFoundAt(): ?DateTimeImmutable
    {
        return $this->foundAt;
    }

    public function setFoundAt(?DateTimeImmutable $foundAt): void
    {
        $this->foundAt = $foundAt;
        $this->passesAt = $foundAt?->add(new DateInterval(self::PASSES_AFTER));
    }

    public function getPassesAt(): ?DateTimeImmutable
    {
        return $this->passesAt;
    }

    public function getEndedAt(): ?DateTimeImmutable
    {
        return $this->endedAt;
    }

    public function getOutcome(): ?OwnerClaimOutcome
    {
        return $this->outcome;
    }

    public function setOutcome(OwnerClaimOutcome $outcome, DateTimeImmutable $at): void
    {
        $this->outcome = $outcome;
        $this->endedAt = $at;
    }

    public function isOpen(): bool
    {
        return null === $this->endedAt;
    }

    public function getStoppedBy(): ?User
    {
        return $this->stoppedBy;
    }

    public function setStoppedBy(?User $stoppedBy): void
    {
        $this->stoppedBy = $stoppedBy;
    }

    /** @return list<array{id: string, as: string}> */
    public function getTold(): array
    {
        return $this->told;
    }

    /** @param list<array{id: string, as: string}> $told */
    public function setTold(array $told): void
    {
        $this->told = $told;
    }
}
