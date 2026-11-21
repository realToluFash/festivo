<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One version of what a vendor quoted (sc-87): a revision supersedes it and keeps it, a correction changes it in place. The amount is in the event's currency's minor unit. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'quotes')]
#[ORM\Index(name: 'idx_quote_engagement', columns: ['engagement_id'])]
#[ORM\UniqueConstraint(name: 'uniq_current_quote', columns: ['engagement_id'], options: ['where' => '(superseded_at IS NULL)'])]
class Quote
{
    use Timestampable;

    public const int COVERS_MAXIMUM = 500;

    public const int REFERENCE_MAXIMUM = 64;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: VendorEngagement::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private VendorEngagement $engagement;

    #[ORM\Column(type: Types::STRING, length: 2000)]
    private string $covers;

    #[ORM\Column(type: Types::BIGINT)]
    private string $amountMinor;

    /** A day in the event's time zone. */
    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    private DateTimeImmutable $quotedOn;

    #[ORM\Column(type: Types::STRING, length: 256, nullable: true)]
    private ?string $reference;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $supersededAt = null;

    public function __construct(VendorEngagement $engagement, string $covers, int $amountMinor, DateTimeImmutable $quotedOn, ?string $reference)
    {
        $this->id = Uuid::v7();
        $this->engagement = $engagement;
        $this->covers = $covers;
        $this->amountMinor = (string) $amountMinor;
        $this->quotedOn = $quotedOn;
        $this->reference = $reference;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEngagement(): VendorEngagement
    {
        return $this->engagement;
    }

    public function getCovers(): string
    {
        return $this->covers;
    }

    public function getAmountMinor(): int
    {
        return (int) $this->amountMinor;
    }

    public function getQuotedOn(): DateTimeImmutable
    {
        return $this->quotedOn;
    }

    public function getReference(): ?string
    {
        return $this->reference;
    }

    public function correct(string $covers, ?string $reference): void
    {
        $this->covers = $covers;
        $this->reference = $reference;
    }

    public function getSupersededAt(): ?DateTimeImmutable
    {
        return $this->supersededAt;
    }

    public function supersede(DateTimeImmutable $at): void
    {
        $this->supersededAt = $at;
    }
}
