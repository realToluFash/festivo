<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One step in a membership's history: who caused it, when, and through which channel. Never edited. */
#[ORM\Entity]
#[ORM\Table(name: 'membership_transitions')]
#[ORM\Index(name: 'idx_membership_transition_membership', columns: ['membership_id', 'occurred_at'])]
class MembershipTransition
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Membership::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Membership $membership;

    /** Null for the step that created the row. */
    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: MembershipStatus::class)]
    private ?MembershipStatus $fromStatus;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: MembershipStatus::class)]
    private MembershipStatus $toStatus;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: MembershipChannel::class)]
    private MembershipChannel $channel;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $actor;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $occurredAt;

    public function __construct(
        Membership $membership,
        ?MembershipStatus $fromStatus,
        MembershipStatus $toStatus,
        MembershipChannel $channel,
        ?User $actor,
        DateTimeImmutable $occurredAt,
    ) {
        $this->id = Uuid::v7();
        $this->membership = $membership;
        $this->fromStatus = $fromStatus;
        $this->toStatus = $toStatus;
        $this->channel = $channel;
        $this->actor = $actor;
        $this->occurredAt = $occurredAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getMembership(): Membership
    {
        return $this->membership;
    }

    public function getFromStatus(): ?MembershipStatus
    {
        return $this->fromStatus;
    }

    public function getToStatus(): MembershipStatus
    {
        return $this->toStatus;
    }

    public function getChannel(): MembershipChannel
    {
        return $this->channel;
    }

    public function getActor(): ?User
    {
        return $this->actor;
    }

    public function getOccurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }
}
