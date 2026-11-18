<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\OrganisationExportStatus;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One archive of everything an organisation holds, asked for by an Owner and downloaded once by them (sc-612). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'organisation_exports')]
#[ORM\Index(name: 'idx_organisation_export_organisation', columns: ['organisation_id', 'asked_at'])]
#[ORM\Index(name: 'idx_organisation_export_asked_by', columns: ['asked_by_id'])]
#[ORM\Index(name: 'idx_organisation_export_preparing', columns: ['status'], options: ['where' => "(status = 'preparing')"])]
class OrganisationExport
{
    use Timestampable;

    /** One export per organisation in this long, counted from when the last one was asked for. */
    public const string LIMIT_WINDOW = 'PT24H';

    /** The download works for this long from when the archive is ready. */
    public const string LINK_LIFETIME = 'PT24H';

    /** Tries in the background before the export is Didn't finish. */
    public const int MOST_ATTEMPTS = 3;

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

    #[ORM\Column(type: Types::STRING, length: 20, enumType: OrganisationExportStatus::class)]
    private OrganisationExportStatus $status = OrganisationExportStatus::Preparing;

    #[ORM\Column(type: Types::SMALLINT, options: ['default' => 0])]
    private int $attempts = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $attemptedAt = null;

    /** Where the archive is kept, in the private bucket. */
    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $archiveKey = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $readyAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $downloadedAt = null;

    public function __construct(Organisation $organisation, User $askedBy, DateTimeImmutable $askedAt)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->askedBy = $askedBy;
        $this->askedAt = $askedAt;
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

    public function getAskedAt(): DateTimeImmutable
    {
        return $this->askedAt;
    }

    public function getStatus(): OrganisationExportStatus
    {
        return $this->status;
    }

    public function getAttempts(): int
    {
        return $this->attempts;
    }

    public function getAttemptedAt(): ?DateTimeImmutable
    {
        return $this->attemptedAt;
    }

    public function getArchiveKey(): ?string
    {
        return $this->archiveKey;
    }

    public function getReadyAt(): ?DateTimeImmutable
    {
        return $this->readyAt;
    }

    public function getDownloadedAt(): ?DateTimeImmutable
    {
        return $this->downloadedAt;
    }

    public function expiresAt(): ?DateTimeImmutable
    {
        return $this->readyAt?->add(new DateInterval(self::LINK_LIFETIME));
    }

    /** When the next export may be asked for, while this one holds the limit. */
    public function nextAllowedAt(): ?DateTimeImmutable
    {
        return OrganisationExportStatus::Failed === $this->status ? null : $this->askedAt->add(new DateInterval(self::LIMIT_WINDOW));
    }

    public function isAskedBy(User $user): bool
    {
        return $this->askedBy->getId()->equals($user->getId());
    }

    public function attempting(DateTimeImmutable $at): void
    {
        ++$this->attempts;
        $this->attemptedAt = $at;
    }

    public function ready(string $archiveKey, DateTimeImmutable $at): void
    {
        $this->status = OrganisationExportStatus::Ready;
        $this->archiveKey = $archiveKey;
        $this->readyAt = $at;
    }

    /** Tried again later, unless it has had its tries. */
    public function attemptFailed(): void
    {
        if ($this->attempts >= self::MOST_ATTEMPTS) {
            $this->status = OrganisationExportStatus::Failed;
        }
    }
}
