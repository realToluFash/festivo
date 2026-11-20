<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\AuditExportStatus;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** The audit log's filtered entries, prepared in the background and downloaded by the person who asked, signed in, for 24 hours (sc-611). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'audit_exports')]
#[ORM\Index(name: 'idx_audit_export_organisation', columns: ['organisation_id', 'asked_at'])]
#[ORM\Index(name: 'idx_audit_export_asked_by', columns: ['asked_by_id'])]
#[ORM\Index(name: 'idx_audit_export_preparing', columns: ['status'], options: ['where' => "(status = 'preparing')"])]
class AuditExport implements PreparedFile
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $askedBy;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $askedAt;

    #[ORM\Column(type: Types::STRING, length: 8)]
    private string $format;

    /** @var array<string, string> */
    #[ORM\Column(type: Types::JSON)]
    private array $filters;

    #[ORM\Column(type: Types::INTEGER)]
    private int $entries;

    #[ORM\Column(type: Types::STRING, length: 20)]
    private string $locale;

    /** The asker's zone when they asked, which the From and To days are read in on every try. */
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $zone;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: AuditExportStatus::class)]
    private AuditExportStatus $status = AuditExportStatus::Preparing;

    #[ORM\Column(type: Types::SMALLINT, options: ['default' => 0])]
    private int $attempts = 0;

    /** When the latest try was last seen writing or uploading its file; a try quiet for PreparedFile::RETRY_AFTER has stopped. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $workedAt = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $fileKey = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $readyAt = null;

    /** @param array<string, string> $filters */
    public function __construct(Organisation $organisation, User $askedBy, DateTimeImmutable $askedAt, string $format, array $filters, int $entries, string $locale, string $zone)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->askedBy = $askedBy;
        $this->askedAt = $askedAt;
        $this->format = $format;
        $this->filters = $filters;
        $this->entries = $entries;
        $this->locale = $locale;
        $this->zone = $zone;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getAskedBy(): User
    {
        return $this->askedBy;
    }

    public function isAskedBy(User $user): bool
    {
        return $this->askedBy->getId()->equals($user->getId());
    }

    public function getAskedAt(): DateTimeImmutable
    {
        return $this->askedAt;
    }

    public function getFormat(): string
    {
        return $this->format;
    }

    /** @return array<string, string> */
    public function getFilters(): array
    {
        return $this->filters;
    }

    public function getEntries(): int
    {
        return $this->entries;
    }

    public function getLocale(): string
    {
        return $this->locale;
    }

    public function getZone(): string
    {
        return $this->zone;
    }

    public function getAttempts(): int
    {
        return $this->attempts;
    }

    public function getWorkedAt(): ?DateTimeImmutable
    {
        return $this->workedAt;
    }

    public function getStatus(): AuditExportStatus
    {
        return $this->status;
    }

    public function isReady(): bool
    {
        return AuditExportStatus::Ready === $this->status;
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function getReadyAt(): ?DateTimeImmutable
    {
        return $this->readyAt;
    }

    public function expiresAt(): ?DateTimeImmutable
    {
        return $this->readyAt?->add(new DateInterval(self::LINK_LIFETIME));
    }
}
