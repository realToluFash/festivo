<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\GuestReply;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Somebody on an event's guest list (sc-1468). A companion is a guest of their own with a `host`,
 * no contact details, no reply and no link: whether they come follows their host's reply.
 */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'guests')]
class Guest
{
    use Timestampable;

    public const int NAME_MAXIMUM = 200;

    public const int COMPANIONS_MAXIMUM = 10;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?Guest $host;

    /** Exactly as typed, title and all; null only for a companion left unnamed. */
    #[ORM\Column(type: Types::STRING, length: 200, nullable: true)]
    private ?string $fullName;

    /** The name without case or accents, for "already on the list". */
    #[ORM\Column(type: Types::STRING, length: 800, nullable: true)]
    private ?string $nameKey;

    #[ORM\Column(type: Types::STRING, length: 254, nullable: true)]
    private ?string $email;

    /** E.164. */
    #[ORM\Column(type: Types::STRING, length: 20, nullable: true)]
    private ?string $mobile;

    #[ORM\Column(type: Types::STRING, length: 16, nullable: true, enumType: GuestReply::class)]
    private ?GuestReply $reply;

    /** A companion's place under their host, from 1; a host's is 0. */
    #[ORM\Column(type: Types::SMALLINT, options: ['default' => 0])]
    private int $position;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $addedBy;

    private function __construct(Event $event, ?Guest $host, ?string $fullName, ?string $nameKey, ?string $email, ?string $mobile, ?GuestReply $reply, int $position, ?User $addedBy)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->host = $host;
        $this->fullName = $fullName;
        $this->nameKey = $nameKey;
        $this->email = $email;
        $this->mobile = $mobile;
        $this->reply = $reply;
        $this->position = $position;
        $this->addedBy = $addedBy;
    }

    public static function invited(Event $event, string $fullName, string $nameKey, ?string $email, ?string $mobile, ?User $addedBy): self
    {
        return new self($event, null, $fullName, $nameKey, $email, $mobile, GuestReply::NoReply, 0, $addedBy);
    }

    public static function companionOf(self $host, ?string $fullName, ?string $nameKey, int $position, ?User $addedBy): self
    {
        return new self($host->event, $host, $fullName, $nameKey, null, null, null, $position, $addedBy);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getHost(): ?Guest
    {
        return $this->host;
    }

    public function getFullName(): ?string
    {
        return $this->fullName;
    }

    public function getNameKey(): ?string
    {
        return $this->nameKey;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function getMobile(): ?string
    {
        return $this->mobile;
    }

    public function getReply(): ?GuestReply
    {
        return $this->reply;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getAddedBy(): ?User
    {
        return $this->addedBy;
    }
}
