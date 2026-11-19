<?php

declare(strict_types=1);

namespace App\Entity;

use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A domain an organisation proves it owns by DNS (sc-560): its own list, apart from company domain joining's. */
#[ORM\Entity]
#[ORM\Table(name: 'organisation_email_domains')]
#[ORM\UniqueConstraint(name: 'uniq_email_domain_organisation', columns: ['organisation_id', 'domain'])]
#[ORM\UniqueConstraint(name: 'uniq_email_domain_proved', columns: ['domain'], options: ['where' => '(proved_at IS NOT NULL)'])]
#[ORM\Index(name: 'idx_email_domain_organisation', columns: ['organisation_id'])]
#[ORM\Index(name: 'idx_email_domain_domain', columns: ['domain'])]
class EmailDomain
{
    public const string CHECKS_FOR = 'P7D';
    public const string RECHECK_EVERY = 'P30D';
    public const string PUT_BACK_WITHIN = 'P14D';

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 253)]
    private string $domain;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $recordValue;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $addedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $checkedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $provedAt = null;

    /** The next 30-day re-check counts from here. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $foundAt = null;

    /** When a proved domain's record was first found gone; it stops being proved 14 days on. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $missingSince = null;

    /** Its checks ended, or its proof lapsed; Verify still proves it. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $failedAt = null;

    public function __construct(Organisation $organisation, string $domain, string $recordValue, DateTimeImmutable $addedAt)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->domain = $domain;
        $this->recordValue = $recordValue;
        $this->addedAt = $addedAt;
        $this->checkedAt = $addedAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getDomain(): string
    {
        return $this->domain;
    }

    public function getRecordValue(): string
    {
        return $this->recordValue;
    }

    public function getAddedAt(): DateTimeImmutable
    {
        return $this->addedAt;
    }

    public function getCheckedAt(): DateTimeImmutable
    {
        return $this->checkedAt;
    }

    public function getProvedAt(): ?DateTimeImmutable
    {
        return $this->provedAt;
    }

    public function getFoundAt(): ?DateTimeImmutable
    {
        return $this->foundAt;
    }

    public function getMissingSince(): ?DateTimeImmutable
    {
        return $this->missingSince;
    }

    public function getFailedAt(): ?DateTimeImmutable
    {
        return $this->failedAt;
    }

    public function isProved(): bool
    {
        return null !== $this->provedAt;
    }

    /** The one instant the hourly checks stop: added plus 7 × 24 hours. */
    public function checksEndAt(): DateTimeImmutable
    {
        return $this->addedAt->add(new DateInterval(self::CHECKS_FOR));
    }

    /** The one instant a missing record must be back by: first found missing plus 14 × 24 hours. */
    public function putBackBy(): ?DateTimeImmutable
    {
        return $this->missingSince?->add(new DateInterval(self::PUT_BACK_WITHIN));
    }

    public function recheckAt(): ?DateTimeImmutable
    {
        return $this->foundAt?->add(new DateInterval(self::RECHECK_EVERY));
    }

    public function checked(DateTimeImmutable $at): void
    {
        $this->checkedAt = $at;
    }

    public function found(DateTimeImmutable $at): void
    {
        $this->provedAt ??= $at;
        $this->failedAt = null;
        $this->foundAt = $at;
        $this->missingSince = null;
        $this->checkedAt = $at;
    }

    public function missing(DateTimeImmutable $at): void
    {
        $this->missingSince ??= $at;
        $this->checkedAt = $at;
    }

    public function fail(DateTimeImmutable $at): void
    {
        $this->failedAt = $at;
    }

    public function lapse(DateTimeImmutable $at): void
    {
        $this->failedAt = $at;
        $this->provedAt = null;
        $this->foundAt = null;
        $this->missingSince = null;
    }
}
