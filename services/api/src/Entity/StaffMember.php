<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\StaffBriefStatus;
use App\Enum\StaffLinkStatus;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One person working an event, on its roster without being a member of the organisation (sc-3906). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_members')]
#[ORM\Index(name: 'idx_staff_member_mobile', columns: ['event_id', 'mobile'])]
#[ORM\UniqueConstraint(name: 'uniq_staff_floor_lead', columns: ['event_id'], options: ['where' => 'floor_lead'])]
class StaffMember
{
    use Timestampable;

    public const int NAME_MAXIMUM = 200;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** As the organiser typed it, never split into first and last. */
    #[ORM\Column(type: Types::STRING, length: 800)]
    private string $fullName;

    /** E.164. */
    #[ORM\Column(type: Types::STRING, length: 32, nullable: true)]
    private ?string $mobile;

    #[ORM\Column(type: Types::STRING, length: 180, nullable: true)]
    private ?string $email;

    /** The organisation's member whose verified mobile number or email this entry was added with. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $member;

    /** The person's own account, once a code to this entry's number signed it in (sc-4235); deleting the account leaves the entry its name and hours. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $account = null;

    /** One job on the event (sc-3908), and every shift of theirs is of it; kept through the erasure. */
    #[ORM\ManyToOne(targetEntity: StaffJob::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?StaffJob $job = null;

    /** Set 30 days after the event finishes, when the mobile number, email and member link go. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $contactsErasedAt = null;

    /** The roster's one station (sc-3910). */
    #[ORM\ManyToOne(targetEntity: StaffStation::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?StaffStation $station = null;

    /** The one more that Team's As well adds for their shift (sc-36034 writes it). */
    #[ORM\ManyToOne(targetEntity: StaffStation::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?StaffStation $asWellStation = null;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $floorLead = false;

    /** Their own link (sc-3912): the person, never a token, carries how far it got. */
    #[ORM\Column(type: Types::STRING, length: 16, enumType: StaffLinkStatus::class, options: ['default' => 'none'])]
    private StaffLinkStatus $linkStatus = StaffLinkStatus::None;

    /** Who copied or marked it as sent; never set for Opened. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $linkBy = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $linkAt = null;

    /** Their briefing (sc-3917): sent, by a text or by Mark as sent after a copy, then read once they open their link. */
    #[ORM\Column(type: Types::STRING, length: 16, enumType: StaffBriefStatus::class, options: ['default' => 'none'])]
    private StaffBriefStatus $briefStatus = StaffBriefStatus::None;

    /** What the briefing they were given said (BriefingPrinter), so a later change to it reads as Changed since sent. */
    #[ORM\Column(type: Types::STRING, length: 64, nullable: true)]
    private ?string $briefPrint = null;

    /** The last copy of their link from the briefing, and who copied or marked it. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $briefCopyBy = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $briefCopyAt = null;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $briefCopyMarked = false;

    /**
     * What the person was last told of their shifts, job, date and venue, by their briefing or their last change notice (sc-4333); null before the briefing went.
     *
     * @var ?array<string, mixed>
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $told = null;

    /** The lead who added them at the door from Who's here (sc-3918), who may give them a number without staff.manage. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $walkOnBy = null;

    /** Whom they were moved to cover from Who's here (sc-3918), the station they left and when. A move from Stations clears it. */
    #[ORM\ManyToOne(targetEntity: StaffMember::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?StaffMember $covering = null;

    #[ORM\Column(type: Types::STRING, length: 240, nullable: true)]
    private ?string $movedFrom = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $movedAt = null;

    public function __construct(Event $event, string $fullName, ?string $mobile, ?string $email, ?User $member)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->fullName = $fullName;
        $this->mobile = $mobile;
        $this->email = $email;
        $this->member = $member;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getFullName(): string
    {
        return $this->fullName;
    }

    public function getMobile(): ?string
    {
        return $this->mobile;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function getMember(): ?User
    {
        return $this->member;
    }

    public function getAccount(): ?User
    {
        return $this->account;
    }

    public function linkAccount(?User $account): void
    {
        $this->account = $account;
    }

    public function getJob(): ?StaffJob
    {
        return $this->job;
    }

    public function setJob(?StaffJob $job): void
    {
        $this->job = $job;
    }

    public function getContactsErasedAt(): ?DateTimeImmutable
    {
        return $this->contactsErasedAt;
    }

    public function rename(string $fullName): void
    {
        $this->fullName = $fullName;
    }

    public function reach(?string $mobile, ?string $email, ?User $member): void
    {
        $this->mobile = $mobile;
        $this->email = $email;
        $this->member = $member;
    }

    public function eraseContacts(DateTimeImmutable $at): void
    {
        $this->mobile = null;
        $this->email = null;
        $this->member = null;
        $this->contactsErasedAt = $at;
    }

    public function getStation(): ?StaffStation
    {
        return $this->station;
    }

    public function setStation(?StaffStation $station): void
    {
        $this->station = $station;
    }

    public function getAsWellStation(): ?StaffStation
    {
        return $this->asWellStation;
    }

    public function setAsWellStation(?StaffStation $station): void
    {
        $this->asWellStation = $station;
    }

    public function isFloorLead(): bool
    {
        return $this->floorLead;
    }

    public function setFloorLead(bool $floorLead): void
    {
        $this->floorLead = $floorLead;
    }

    public function getLinkStatus(): StaffLinkStatus
    {
        return $this->linkStatus;
    }

    public function getLinkBy(): ?User
    {
        return $this->linkBy;
    }

    public function getLinkAt(): ?DateTimeImmutable
    {
        return $this->linkAt;
    }

    public function linkMoved(StaffLinkStatus $status, ?User $by, ?DateTimeImmutable $at): void
    {
        $this->linkStatus = $status;
        $this->linkBy = $by;
        $this->linkAt = $at;
    }

    public function getBriefStatus(): StaffBriefStatus
    {
        return $this->briefStatus;
    }

    public function getBriefPrint(): ?string
    {
        return $this->briefPrint;
    }

    public function setBrief(StaffBriefStatus $status, ?string $print): void
    {
        $this->briefStatus = $status;
        $this->briefPrint = $print;
    }

    public function getBriefCopyBy(): ?User
    {
        return $this->briefCopyBy;
    }

    public function getBriefCopyAt(): ?DateTimeImmutable
    {
        return $this->briefCopyAt;
    }

    public function isBriefCopyMarked(): bool
    {
        return $this->briefCopyMarked;
    }

    public function setBriefCopy(?User $by, ?DateTimeImmutable $at, bool $marked): void
    {
        $this->briefCopyBy = $by;
        $this->briefCopyAt = $at;
        $this->briefCopyMarked = $marked;
    }

    /** @return ?array<string, mixed> */
    public function getTold(): ?array
    {
        return $this->told;
    }

    /** @param ?array<string, mixed> $told */
    public function told(?array $told): void
    {
        $this->told = $told;
    }

    public function getWalkOnBy(): ?User
    {
        return $this->walkOnBy;
    }

    public function setWalkOnBy(?User $walkOnBy): void
    {
        $this->walkOnBy = $walkOnBy;
    }

    public function getCovering(): ?StaffMember
    {
        return $this->covering;
    }

    public function getMovedFrom(): ?string
    {
        return $this->movedFrom;
    }

    public function getMovedAt(): ?DateTimeImmutable
    {
        return $this->movedAt;
    }

    public function setCover(?StaffMember $covering, ?string $movedFrom, ?DateTimeImmutable $movedAt): void
    {
        $this->covering = $covering;
        $this->movedFrom = $movedFrom;
        $this->movedAt = $movedAt;
    }
}
