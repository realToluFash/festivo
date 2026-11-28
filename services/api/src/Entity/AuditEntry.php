<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\Actor;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
#[ORM\Table(name: 'audit_entries')]
#[ORM\Index(name: 'idx_audit_subject', columns: ['subject_type', 'subject_id'])]
#[ORM\Index(name: 'idx_audit_occurred', columns: ['occurred_at'])]
#[ORM\Index(name: 'idx_audit_actor', columns: ['actor_type', 'actor_id'])]
#[ORM\Index(name: 'idx_audit_organisation', columns: ['organisation_id', 'occurred_at'])]
class AuditEntry
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $occurredAt;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: Actor::class)]
    private Actor $actorType;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $actorId;

    #[ORM\Column(type: Types::STRING, length: 720, nullable: true)]
    private ?string $actorLabel;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $subjectType;

    #[ORM\Column(type: 'uuid')]
    private Uuid $subjectId;

    #[ORM\Column(type: Types::STRING, length: 60)]
    private string $action;

    /** @var array<string, array{0: mixed, 1: mixed}> */
    #[ORM\Column(type: Types::JSON)]
    private array $changes;

    #[ORM\Column(type: Types::STRING, length: 45, nullable: true)]
    private ?string $ip;

    #[ORM\Column(type: Types::STRING, length: 36, nullable: true)]
    private ?string $correlationId;

    /** Whose log it shows in, read when it was recorded (sc-611); null for an entry about a person's own account. */
    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $organisationId;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $eventId;

    #[ORM\Column(type: Types::STRING, length: 240, nullable: true)]
    private ?string $eventName;

    /** The name of what it was done to, as it was then. */
    #[ORM\Column(type: Types::STRING, length: 720, nullable: true)]
    private ?string $target;

    #[ORM\Column(type: Types::STRING, length: 512, nullable: true)]
    private ?string $userAgent;

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    public function __construct(
        Actor $actorType,
        ?Uuid $actorId,
        ?string $actorLabel,
        string $subjectType,
        Uuid $subjectId,
        string $action,
        array $changes = [],
        ?string $ip = null,
        ?string $correlationId = null,
        ?DateTimeImmutable $occurredAt = null,
        ?Uuid $organisationId = null,
        ?Uuid $eventId = null,
        ?string $eventName = null,
        ?string $target = null,
        ?string $userAgent = null,
    ) {
        $this->id = Uuid::v7();
        $this->occurredAt = $occurredAt ?? new DateTimeImmutable();
        $this->actorType = $actorType;
        $this->actorId = $actorId;
        $this->actorLabel = $actorLabel;
        $this->subjectType = $subjectType;
        $this->subjectId = $subjectId;
        $this->action = $action;
        $this->changes = $changes;
        $this->ip = $ip;
        $this->correlationId = $correlationId;
        $this->organisationId = $organisationId;
        $this->eventId = $eventId;
        $this->eventName = $eventName;
        $this->target = $target;
        $this->userAgent = $userAgent;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOccurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
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

    public function getSubjectType(): string
    {
        return $this->subjectType;
    }

    public function getSubjectId(): Uuid
    {
        return $this->subjectId;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    /** @return array<string, array{0: mixed, 1: mixed}> */
    public function getChanges(): array
    {
        return $this->changes;
    }

    public function getCorrelationId(): ?string
    {
        return $this->correlationId;
    }

    public function getIp(): ?string
    {
        return $this->ip;
    }

    public function getOrganisationId(): ?Uuid
    {
        return $this->organisationId;
    }

    public function getEventId(): ?Uuid
    {
        return $this->eventId;
    }

    public function getEventName(): ?string
    {
        return $this->eventName;
    }

    public function getTarget(): ?string
    {
        return $this->target;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }
}
