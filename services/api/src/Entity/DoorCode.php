<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\EventRole;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A door code (sc-72): lets up to its use cap of people onto one event at its level, without joining the organisation, until it expires or is stopped. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'door_codes')]
#[ORM\UniqueConstraint(name: 'uniq_door_code_code', columns: ['code'])]
#[ORM\Index(name: 'idx_door_code_event', columns: ['event_id'])]
class DoorCode
{
    use Timestampable;

    public const int USE_CAP_MOST = 500;

    /** What a code may give (sc-72, sc-4002): never edit, never running the floor. */
    public const array ROLES = [EventRole::CanView, EventRole::CanCheckIn, EventRole::CanWorkFloor, EventRole::CanWorkPass];

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** Eight characters of Crockford's base32, upper case, with no separator. */
    #[ORM\Column(type: Types::STRING, length: 8)]
    private string $code;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: EventRole::class)]
    private EventRole $role;

    #[ORM\Column(type: Types::STRING, length: 240, nullable: true)]
    private ?string $jobLabel;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $useCap;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $stoppedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $madeBy;

    /** The code Make a new code put in its place; People no longer shows a replaced code. */
    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?DoorCode $replacedBy = null;

    /** The shift a redeemer is put on and clocked in to (sc-234); null for a code that names none. */
    #[ORM\ManyToOne(targetEntity: StaffShift::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?StaffShift $shift;

    public function __construct(Event $event, string $code, EventRole $role, ?string $jobLabel, int $useCap, DateTimeImmutable $expiresAt, User $madeBy, ?StaffShift $shift = null)
    {
        $this->shift = $shift;
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->code = $code;
        $this->role = $role;
        $this->jobLabel = $jobLabel;
        $this->useCap = $useCap;
        $this->expiresAt = $expiresAt;
        $this->madeBy = $madeBy;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getRole(): EventRole
    {
        return $this->role;
    }

    public function getJobLabel(): ?string
    {
        return $this->jobLabel;
    }

    public function getUseCap(): int
    {
        return $this->useCap;
    }

    public function getExpiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function getStoppedAt(): ?DateTimeImmutable
    {
        return $this->stoppedAt;
    }

    public function setStoppedAt(DateTimeImmutable $stoppedAt): void
    {
        $this->stoppedAt = $stoppedAt;
    }

    public function getMadeBy(): ?User
    {
        return $this->madeBy;
    }

    public function getReplacedBy(): ?DoorCode
    {
        return $this->replacedBy;
    }

    public function setReplacedBy(DoorCode $replacedBy): void
    {
        $this->replacedBy = $replacedBy;
    }

    public function getShift(): ?StaffShift
    {
        return $this->shift;
    }
}
