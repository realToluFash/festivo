<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * One place's room screen link (sc-3897). Its token is never stored: the seed it is signed from is, with the token's SHA-256 to find the row by. A replaced link keeps its row, so its screen can say it was replaced; each place has one link not yet replaced.
 */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'screen_links')]
#[ORM\UniqueConstraint(name: 'uniq_screen_link_token_hash', columns: ['token_hash'])]
#[ORM\UniqueConstraint(name: 'uniq_screen_link_place', columns: ['event_id', 'place'], options: ['where' => '(replaced_at IS NULL)'])]
class ScreenLink
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** A schedule item's place as stored; empty is the event's one track, Main. */
    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $place;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $seed;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $replacedAt = null;

    public function __construct(Event $event, string $place, string $seed, string $tokenHash)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->place = $place;
        $this->seed = $seed;
        $this->tokenHash = $tokenHash;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getPlace(): string
    {
        return $this->place;
    }

    public function getSeed(): string
    {
        return $this->seed;
    }

    public function getTokenHash(): string
    {
        return $this->tokenHash;
    }

    public function getReplacedAt(): ?DateTimeImmutable
    {
        return $this->replacedAt;
    }

    public function setReplacedAt(DateTimeImmutable $replacedAt): void
    {
        $this->replacedAt = $replacedAt;
    }
}
