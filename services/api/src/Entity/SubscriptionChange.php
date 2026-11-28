<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\Actor;
use App\Enum\SubscriptionChangeKind;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One line of a subscription's history: a person (`actorId`), staff (`actorLabel` their name) or a provider (`actorLabel` its event id). */
#[ORM\Entity]
#[ORM\Table(name: 'subscription_changes')]
#[ORM\Index(name: 'idx_subscription_change_subscription', columns: ['subscription_id'])]
// A provider's event writes at most one line of each kind, however often it is delivered (sc-3933).
#[ORM\UniqueConstraint(name: 'uniq_subscription_change_provider_event', columns: ['actor_label', 'kind'], options: ['where' => "((actor_type)::text = 'system'::text) AND (actor_label IS NOT NULL)"])]
class SubscriptionChange
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Subscription::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Subscription $subscription;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: SubscriptionChangeKind::class)]
    private SubscriptionChangeKind $kind;

    #[ORM\Column(type: Types::STRING, length: 64, nullable: true)]
    private ?string $fromValue;

    #[ORM\Column(type: Types::STRING, length: 64, nullable: true)]
    private ?string $toValue;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: Actor::class)]
    private Actor $actorType;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $actorId;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $actorLabel;

    #[ORM\Column(type: Types::STRING, length: 2000, nullable: true)]
    private ?string $reason;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $occurredAt;

    public function __construct(
        Subscription $subscription,
        SubscriptionChangeKind $kind,
        ?string $fromValue,
        ?string $toValue,
        Actor $actorType,
        ?Uuid $actorId,
        ?string $actorLabel,
        ?string $reason,
        DateTimeImmutable $occurredAt,
    ) {
        $this->id = Uuid::v7();
        $this->subscription = $subscription;
        $this->kind = $kind;
        $this->fromValue = $fromValue;
        $this->toValue = $toValue;
        $this->actorType = $actorType;
        $this->actorId = $actorId;
        $this->actorLabel = $actorLabel;
        $this->reason = $reason;
        $this->occurredAt = $occurredAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getSubscription(): Subscription
    {
        return $this->subscription;
    }

    public function getKind(): SubscriptionChangeKind
    {
        return $this->kind;
    }

    public function getFromValue(): ?string
    {
        return $this->fromValue;
    }

    public function getToValue(): ?string
    {
        return $this->toValue;
    }

    public function getActorType(): Actor
    {
        return $this->actorType;
    }

    public function getActorId(): ?Uuid
    {
        return $this->actorId;
    }

    public function getActorLabel(): ?string
    {
        return $this->actorLabel;
    }

    public function getReason(): ?string
    {
        return $this->reason;
    }

    public function getOccurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }
}
