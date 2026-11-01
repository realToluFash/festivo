<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * One person's subscription link to one organisation's calendar (sc-3626). The link's token is never stored: the seed it is signed from is, with the token's SHA-256 to find the row by.
 */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'calendar_feeds')]
#[ORM\UniqueConstraint(name: 'uniq_calendar_feed_token_hash', columns: ['token_hash'])]
#[ORM\UniqueConstraint(name: 'uniq_calendar_feed_member', columns: ['user_id', 'organisation_id'])]
class CalendarFeed
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $seed;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    public function __construct(User $user, Organisation $organisation, string $seed, string $tokenHash)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->organisation = $organisation;
        $this->seed = $seed;
        $this->tokenHash = $tokenHash;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getSeed(): string
    {
        return $this->seed;
    }

    public function setSeed(string $seed): void
    {
        $this->seed = $seed;
    }

    public function getTokenHash(): string
    {
        return $this->tokenHash;
    }

    public function setTokenHash(string $tokenHash): void
    {
        $this->tokenHash = $tokenHash;
    }
}
