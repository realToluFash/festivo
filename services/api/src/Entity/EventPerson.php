<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\EventRole;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One member's role on one event (sc-29912). Kept through a suspension; removal from the organisation deletes it. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'event_people')]
#[ORM\UniqueConstraint(name: 'uniq_event_person', columns: ['event_id', 'membership_id'])]
#[ORM\Index(name: 'idx_event_person_membership', columns: ['membership_id'])]
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
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Membership $membership;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: EventRole::class)]
    private EventRole $role;

    #[ORM\Column(type: Types::STRING, length: 60, nullable: true)]
    private ?string $jobLabel;

    public function __construct(Event $event, Membership $membership, EventRole $role, ?string $jobLabel)
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

    public function getMembership(): Membership
    {
        return $this->membership;
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
