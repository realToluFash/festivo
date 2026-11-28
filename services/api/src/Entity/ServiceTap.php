<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * One service write by its Idempotency-Key (sc-4028), kept 24 hours so a tap sent again from a device that never heard the answer changes nothing and gets the first answer.
 *
 * @phpstan-type Refused array{code: string, message: string, members: array<string, mixed>, parameters: array<string, int|string>, headers: array<string, string>}
 */
#[ORM\Entity]
#[ORM\Table(name: 'service_taps')]
#[ORM\UniqueConstraint(name: 'uniq_service_tap_key', columns: ['by_id', 'idempotency_key'])]
#[ORM\Index(name: 'idx_service_tap_made', columns: ['made_at'])]
class ServiceTap
{
    public const int KEY_MAXIMUM = 255;

    public const int KEPT_HOURS = 24;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $by;

    #[ORM\Column(type: Types::STRING, length: self::KEY_MAXIMUM)]
    private string $idempotencyKey;

    /** The request as it was sent, hashed, so the same key with a different request is told apart from a retry. */
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $fingerprint;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $madeAt;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $status;

    /** @var array<array-key, mixed>|null */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $answer = null;

    /** @var Refused|null */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $refused = null;

    public function __construct(Event $event, User $by, string $idempotencyKey, string $fingerprint, DateTimeImmutable $madeAt, int $status)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->by = $by;
        $this->idempotencyKey = $idempotencyKey;
        $this->fingerprint = $fingerprint;
        $this->madeAt = $madeAt;
        $this->status = $status;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getFingerprint(): string
    {
        return $this->fingerprint;
    }

    public function getMadeAt(): DateTimeImmutable
    {
        return $this->madeAt;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    /** @return array<array-key, mixed>|null */
    public function getAnswer(): ?array
    {
        return $this->answer;
    }

    /** @return Refused|null */
    public function getRefused(): ?array
    {
        return $this->refused;
    }
}
