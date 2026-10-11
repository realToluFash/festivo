<?php

declare(strict_types=1);

namespace App\Entity;

use App\Audit\Actor;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * One recorded change. Append-only.
 *
 * There is deliberately no setter and no way to delete one from the
 * application. An audit trail the application can edit answers "who changed
 * this" with "somebody who could also change the answer".
 *
 * It survives the soft deletion of its subject, because the history of a
 * deleted event is exactly what somebody will ask about.
 */
#[ORM\Entity]
#[ORM\Table(name: 'audit_entry')]
#[ORM\Index(name: 'idx_audit_subject', columns: ['subject_type', 'subject_id'])]
#[ORM\Index(name: 'idx_audit_occurred', columns: ['occurred_at'])]
#[ORM\Index(name: 'idx_audit_actor', columns: ['actor_type', 'actor_id'])]
class AuditEntry
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $occurredAt;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: Actor::class)]
    private Actor $actorType;

    /** Null for the system, which has no identity to record. */
    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $actorId;

    /**
     * Who the actor was AT THE TIME, as text.
     *
     * Denormalised on purpose. A name resolved at read time shows who that id
     * belongs to now, which is a different question from who did this — and
     * after the account is deleted it answers nothing at all.
     */
    #[ORM\Column(type: Types::STRING, length: 180, nullable: true)]
    private ?string $actorLabel;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $subjectType;

    #[ORM\Column(type: 'uuid')]
    private Uuid $subjectId;

    #[ORM\Column(type: Types::STRING, length: 60)]
    private string $action;

    /**
     * What changed, as field => [before, after].
     *
     * Before AND after. "Role changed" is not an answer to "changed from what?",
     * and the before is the half that cannot be reconstructed later.
     *
     * @var array<string, array{0: mixed, 1: mixed}>
     */
    #[ORM\Column(type: Types::JSON)]
    private array $changes;

    #[ORM\Column(type: Types::STRING, length: 45, nullable: true)]
    private ?string $ip;

    #[ORM\Column(type: Types::STRING, length: 36, nullable: true)]
    private ?string $correlationId;

    /**
     * @param array<string, array{0: mixed, 1: mixed}> $changes
     */
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
    ) {
        $this->id = Uuid::v7();
        $this->occurredAt = new DateTimeImmutable();
        $this->actorType = $actorType;
        $this->actorId = $actorId;
        $this->actorLabel = $actorLabel;
        $this->subjectType = $subjectType;
        $this->subjectId = $subjectId;
        $this->action = $action;
        $this->changes = $changes;
        $this->ip = $ip;
        $this->correlationId = $correlationId;
    }

    public function id(): Uuid
    {
        return $this->id;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function actorType(): Actor
    {
        return $this->actorType;
    }

    public function actorId(): ?Uuid
    {
        return $this->actorId;
    }

    public function actorLabel(): ?string
    {
        return $this->actorLabel;
    }

    public function subjectType(): string
    {
        return $this->subjectType;
    }

    public function subjectId(): Uuid
    {
        return $this->subjectId;
    }

    public function action(): string
    {
        return $this->action;
    }

    /** @return array<string, array{0: mixed, 1: mixed}> */
    public function changes(): array
    {
        return $this->changes;
    }

    public function correlationId(): ?string
    {
        return $this->correlationId;
    }

    public function ip(): ?string
    {
        return $this->ip;
    }
}
