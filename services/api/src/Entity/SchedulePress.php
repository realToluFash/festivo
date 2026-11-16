<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Doctrine\Type\MillisecondDateTimeType;
use App\Enum\PressKind;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One Done, Start now or Skip on the night screen, kept so an item's state is replayed from every press in the order they were pressed (sc-3895). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'schedule_presses')]
#[ORM\UniqueConstraint(name: 'uniq_schedule_press_key', columns: ['pressed_by_id', 'idempotency_key'])]
#[ORM\Index(name: 'idx_schedule_press_event', columns: ['event_id', 'pressed_at'])]
class SchedulePress
{
    use Timestampable;

    public const int KEY_MAXIMUM = 255;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: ScheduleItem::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ScheduleItem $item;

    #[ORM\Column(type: Types::STRING, length: 8, enumType: PressKind::class)]
    private PressKind $kind;

    /** UTC to the millisecond, as the presser's corrected clock read it, clamped by the server. */
    #[ORM\Column(type: MillisecondDateTimeType::NAME)]
    private DateTimeImmutable $pressedAt;

    #[ORM\Column(type: Types::STRING, length: self::KEY_MAXIMUM)]
    private string $idempotencyKey;

    /** The press as it was sent, hashed, so the same key with a different body is told apart from a retry. */
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $fingerprint;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $pressedBy;

    /** Kept with the press, so "Already started by {name}" still names somebody who has since left. */
    #[ORM\Column(type: Types::STRING, length: 480)]
    private string $pressedByName;

    /** What the press was answered the first time, sent again for the same key: null when it was applied, or the error code it lost with. */
    #[ORM\Column(type: Types::STRING, length: 40, nullable: true)]
    private ?string $answer = null;

    public function __construct(Event $event, ScheduleItem $item, PressKind $kind, DateTimeImmutable $pressedAt, string $idempotencyKey, string $fingerprint, ?User $pressedBy, string $pressedByName)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->item = $item;
        $this->kind = $kind;
        $this->pressedAt = $pressedAt;
        $this->idempotencyKey = $idempotencyKey;
        $this->fingerprint = $fingerprint;
        $this->pressedBy = $pressedBy;
        $this->pressedByName = $pressedByName;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getItem(): ScheduleItem
    {
        return $this->item;
    }

    public function getKind(): PressKind
    {
        return $this->kind;
    }

    public function getPressedAt(): DateTimeImmutable
    {
        return $this->pressedAt;
    }

    public function getIdempotencyKey(): string
    {
        return $this->idempotencyKey;
    }

    public function getFingerprint(): string
    {
        return $this->fingerprint;
    }

    public function getPressedBy(): ?User
    {
        return $this->pressedBy;
    }

    public function getPressedByName(): string
    {
        return $this->pressedByName;
    }

    public function getAnswer(): ?string
    {
        return $this->answer;
    }

    public function setAnswer(?string $answer): void
    {
        $this->answer = $answer;
    }
}
