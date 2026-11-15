<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One person working an event, on its roster without being a member of the organisation (sc-3906). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_members')]
#[ORM\Index(name: 'idx_staff_member_mobile', columns: ['event_id', 'mobile'])]
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
    #[ORM\Column(type: Types::STRING, length: 200)]
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

    /** Set 30 days after the event finishes, when the mobile number, email and member link go. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $contactsErasedAt = null;

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
}
