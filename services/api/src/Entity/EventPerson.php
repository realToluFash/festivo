<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\ContactKind;
use App\Enum\EventRole;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One person's role on one event: a member's (sc-29912), or someone from outside's (sc-71) by account or, until they have one, by address. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'event_people')]
#[ORM\UniqueConstraint(name: 'uniq_event_person', columns: ['event_id', 'membership_id'])]
#[ORM\UniqueConstraint(name: 'uniq_event_person_user', columns: ['event_id', 'user_id'])]
#[ORM\UniqueConstraint(name: 'uniq_event_person_address', columns: ['event_id', 'address'])]
#[ORM\Index(name: 'idx_event_person_membership', columns: ['membership_id'])]
#[ORM\Index(name: 'idx_event_person_user', columns: ['user_id'])]
#[ORM\Index(name: 'idx_event_person_address', columns: ['address'])]
class EventPerson
{
    use Timestampable;

    public const int JOB_LABEL_MAXIMUM = 60;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: Membership::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?Membership $membership;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?User $user = null;

    /** An email address in lower case, a mobile number in E.164. */
    #[ORM\Column(type: Types::STRING, length: 320, nullable: true)]
    private ?string $address = null;

    #[ORM\Column(type: Types::STRING, length: 10, nullable: true, enumType: ContactKind::class)]
    private ?ContactKind $addressKind = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $grantedBy = null;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: EventRole::class)]
    private EventRole $role;

    #[ORM\Column(type: Types::STRING, length: 240, nullable: true)]
    private ?string $jobLabel;

    public function __construct(Event $event, ?Membership $membership, EventRole $role, ?string $jobLabel)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->membership = $membership;
        $this->role = $role;
        $this->jobLabel = $jobLabel;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public static function outside(Event $event, User $user, EventRole $role, ?string $jobLabel, User $grantedBy): self
    {
        $person = new self($event, null, $role, $jobLabel);
        $person->user = $user;
        $person->grantedBy = $grantedBy;

        return $person;
    }

    public static function pending(Event $event, string $address, ContactKind $kind, EventRole $role, ?string $jobLabel, User $grantedBy): self
    {
        $person = new self($event, null, $role, $jobLabel);
        $person->address = $address;
        $person->addressKind = $kind;
        $person->grantedBy = $grantedBy;

        return $person;
    }

    /** Null for someone from outside the organisation. */
    public function getMembership(): ?Membership
    {
        return $this->membership;
    }

    public function isOutside(): bool
    {
        return null === $this->membership;
    }

    public function getUser(): ?User
    {
        return $this->membership?->getUser() ?? $this->user;
    }

    public function getAddress(): ?string
    {
        return $this->address;
    }

    public function getAddressKind(): ?ContactKind
    {
        return $this->addressKind;
    }

    public function getGrantedBy(): ?User
    {
        return $this->grantedBy;
    }

    /** The address is not kept once an account has proved it. */
    public function claimBy(User $user): void
    {
        $this->user = $user;
        $this->address = null;
        $this->addressKind = null;
    }

    public function getRole(): EventRole
    {
        return $this->role;
    }

    public function setRole(EventRole $role): void
    {
        $this->role = $role;
    }

    public function getJobLabel(): ?string
    {
        return $this->jobLabel;
    }

    public function setJobLabel(?string $jobLabel): void
    {
        $this->jobLabel = $jobLabel;
    }
}
